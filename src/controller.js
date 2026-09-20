import { Meter, matches } from "./meter.js";
import { renderMeter, imageData } from "./render.js";

export class MeterController {
  constructor(client, notify = () => {}) {
    this.client = client;
    this.notify = notify;
    this.entries = new Map();
    this.inputs = [];
    this.revision = 0;
    this.listError = "";
    this.muteChanges = undefined;
    client.on("status", ({ status }) => {
      if (status !== "connected") {
        this.revision++;
        this.inputs = [];
        this.listError = "";
        this.muteChanges = undefined;
        for (const entry of this.entries.values()) entry.meter.reset();
      }
      this.notify();
    });
    client.on("ready", () => { void this.refreshSources(); });
    client.on("event", (type, data) => this.onEvent(type, data));
  }

  attach(action, settings = {}) {
    const entry = { action, settings, meter: new Meter(), lastImage: "", rendering: false };
    this.entries.set(action.id, entry);
    return entry;
  }

  detach(id) { this.entries.delete(id); }

  changeSettings(id, settings) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.settings = settings ?? {};
    entry.meter.reset();
    entry.lastImage = "";
  }

  onEvent(type, data) {
    if (type === "InputVolumeMeters") {
      const inputs = Array.isArray(data.inputs) ? data.inputs : [];
      for (const entry of this.entries.values()) {
        const source = inputs.find((input) => matches(input, entry.settings));
        if (source) entry.meter.update(source);
        else entry.meter.reset();
      }
    } else if (type === "InputMuteStateChanged") {
      this.muteChanges?.push(data);
      for (const input of this.inputs) {
        if (matches(data, input)) input.inputMuted = !!data.inputMuted;
      }
      for (const entry of this.entries.values()) {
        if (matches(data, entry.settings)) entry.meter.reset();
      }
      this.notify();
    } else if (["InputCreated", "InputRemoved", "InputNameChanged", "CurrentSceneCollectionChanged"].includes(type)) {
      // 古いOBSの名前指定では、名称変更時は新しい名前を選び直す。
      for (const entry of this.entries.values()) entry.meter.reset();
      void this.refreshSources();
    }
  }

  async refreshSources() {
    if (this.client.status !== "connected") { this.notify(); return; }
    const revision = ++this.revision;
    this.muteChanges = [];
    try {
      const result = await this.client.request("GetInputList");
      const inputs = await Promise.all((result.inputs ?? []).map(async (input) => {
        try {
          const mute = await this.client.request("GetInputMute", { inputName: input.inputName });
          return { inputName: input.inputName, inputUuid: input.inputUuid, inputMuted: !!mute.inputMuted };
        } catch (error) {
          // 音声を持たない映像ソースはリストから除外する。
          if (error.code === 604 || error.code === 600) return null;
          throw error;
        }
      }));
      if (revision !== this.revision) return;
      this.inputs = inputs.filter(Boolean).sort((a, b) => a.inputName.localeCompare(b.inputName, "ja"));
      for (const change of this.muteChanges) {
        const input = this.inputs.find((item) => matches(change, item));
        if (input) input.inputMuted = !!change.inputMuted;
      }
      this.muteChanges = undefined;
      this.listError = "";
    } catch {
      if (revision !== this.revision) return;
      this.listError = "ソース一覧を取得できません。「一覧を更新」で再試行してください。";
      this.muteChanges = undefined;
    }
    this.notify();
  }

  inspectorState() {
    return { type: "sources", status: this.client.status, message: this.listError || this.client.message, inputs: this.inputs };
  }

  model(entry, now) {
    const source = this.inputs.find((input) => matches(input, entry.settings));
    const snapshot = entry.meter.snapshot(now);
    let status = "";
    if (!entry.settings.inputUuid && !entry.settings.inputName) status = "ソースを選択";
    else if (this.client.status === "auth-error") status = "認証エラー";
    else if (this.client.status === "invalid") status = "接続設定エラー";
    else if (this.client.status !== "connected") status = "OBS未接続";
    else if (this.listError) status = "一覧取得エラー";
    else if (!source) status = "ソース未検出";
    else if (source.inputMuted) status = "MUTE";
    else if (snapshot.stale) status = "音声データ待機";
    return { ...snapshot, name: entry.settings.label || source?.inputName || entry.settings.inputName || "OBS Audio Meter", status };
  }

  async render(entry, now = Date.now()) {
    if (entry.rendering) return;
    const svg = renderMeter(this.model(entry, now), entry.action.isDial());
    if (svg === entry.lastImage) return;
    entry.rendering = true;
    try {
      const data = imageData(svg);
      if (entry.action.isDial()) await entry.action.setFeedback({ meter: data });
      else await entry.action.setImage(data);
      entry.lastImage = svg;
    } catch {
      // ページ切替中などで送れなければ次の表示更新で再試行する。
    } finally {
      entry.rendering = false;
    }
  }

  async renderAll(now = Date.now()) {
    await Promise.all([...this.entries.values()].map((entry) => this.render(entry, now)));
  }

  resetPeak(id) { this.entries.get(id)?.meter.resetPeak(); }
}
