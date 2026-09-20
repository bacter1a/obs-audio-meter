import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import WebSocket from "ws";

const hash = (value) => createHash("sha256").update(value).digest("base64");
export const subscriptions = (1 << 16) | (1 << 3) | (1 << 1);

export function connectionSettings(settings = {}) {
  const address = String(settings.address || "ws://127.0.0.1:4455").trim();
  const url = new URL(address);
  if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("接続先は ws://ホスト:ポート の形式で指定してください。");
  }
  return { address: url.href, password: String(settings.password ?? "") };
}

export class ObsClient extends EventEmitter {
  constructor({ retryMs = 1000, timeoutMs = 5000 } = {}) {
    super();
    this.retryMs = retryMs;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.status = "disconnected";
    this.message = "OBS未接続";
    this.running = false;
  }

  setStatus(status, message) {
    this.status = status;
    this.message = message;
    this.emit("status", { status, message });
  }

  start(settings = {}) {
    let config;
    try {
      config = connectionSettings(settings);
    } catch {
      this.stop();
      this.setStatus("invalid", "接続先は ws://ホスト:ポート の形式で指定してください。");
      return;
    }
    if (this.running && JSON.stringify(config) === JSON.stringify(this.config)) return;
    this.stop();
    this.config = config;
    this.running = true;
    this.attempt = 0;
    this.connect();
  }

  stop() {
    this.running = false;
    clearTimeout(this.retryTimer);
    clearTimeout(this.handshakeTimer);
    clearInterval(this.heartbeat);
    const socket = this.socket;
    this.socket = undefined;
    if (socket) socket.terminate();
    this.rejectPending();
    this.setStatus("disconnected", "OBS未接続");
  }

  rejectPending() {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("OBSとの接続が切れました。"));
    }
    this.pending.clear();
  }

  connect() {
    if (!this.running) return;
    this.setStatus("connecting", "OBSに接続中…");
    const socket = new WebSocket(this.config.address, { handshakeTimeout: this.timeoutMs });
    this.socket = socket;
    this.handshakeTimer = setTimeout(() => socket.terminate(), this.timeoutMs);
    socket.on("error", () => { /* closeで再接続する。認証情報をログに出さない。 */ });
    socket.on("message", (raw) => {
      if (this.socket !== socket) return;
      let packet;
      try { packet = JSON.parse(raw.toString()); } catch { socket.close(1002); return; }
      const data = packet?.d;
      if (!data || typeof data !== "object") return;
      if (packet.op === 0) {
        const identify = { rpcVersion: 1, eventSubscriptions: subscriptions };
        if (data.authentication) {
          const { salt, challenge } = data.authentication;
          if (typeof salt !== "string" || typeof challenge !== "string") { socket.close(1002); return; }
          identify.authentication = hash(hash(this.config.password + salt) + challenge);
        }
        socket.send(JSON.stringify({ op: 1, d: identify }));
      } else if (packet.op === 2) {
        clearTimeout(this.handshakeTimer);
        this.attempt = 0;
        let alive = true;
        socket.on("pong", () => { alive = true; });
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => {
          if (!alive) { socket.terminate(); return; }
          alive = false;
          socket.ping();
        }, 5000);
        this.setStatus("connected", "OBS接続済み");
        this.emit("ready");
      } else if (packet.op === 5) {
        this.emit("event", data.eventType, data.eventData ?? {});
      } else if (packet.op === 7) {
        const request = this.pending.get(data.requestId);
        if (!request) return;
        this.pending.delete(data.requestId);
        clearTimeout(request.timer);
        if (data.requestStatus?.result) request.resolve(data.responseData ?? {});
        else request.reject(Object.assign(new Error("OBSから取得できませんでした。"), { code: data.requestStatus?.code }));
      }
    });
    socket.on("close", (code) => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      clearTimeout(this.handshakeTimer);
      clearInterval(this.heartbeat);
      this.rejectPending();
      const authError = code === 4009;
      this.setStatus(authError ? "auth-error" : "disconnected", authError
        ? "認証失敗：パスワードを確認し「保存して接続」を押してください。"
        : "OBS未接続：起動とWebSocket設定を確認してください。自動再接続します。");
      if (authError) { this.running = false; return; }
      if (this.running) {
        const delay = Math.min(this.retryMs * 2 ** this.attempt++, 10000);
        this.retryTimer = setTimeout(() => this.connect(), delay);
      }
    });
  }

  request(requestType, requestData = {}) {
    if (this.status !== "connected" || this.socket?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("OBS未接続"));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("OBSの応答がタイムアウトしました。"));
      }, this.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    });
  }
}
