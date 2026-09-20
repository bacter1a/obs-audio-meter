let socket, context, actionUuid;
let settings = {}, globalSettings = {}, inputs = [];
let globalLoaded = false;
const source = document.getElementById("source");
const label = document.getElementById("label");
const address = document.getElementById("address");
const password = document.getElementById("password");
const status = document.getElementById("status");
const connect = document.getElementById("connect");

function send(event, payload = {}) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: actionUuid, context, event, payload }));
}

function renderSources() {
  source.replaceChildren(new Option("ソースを選択してください", ""));
  for (const [index, input] of inputs.entries()) source.add(new Option(input.inputName, String(index)));
  const index = inputs.findIndex((input) => settings.inputUuid ? input.inputUuid === settings.inputUuid : input.inputName === settings.inputName);
  if (index >= 0) source.value = String(index);
  else if (settings.inputName || settings.inputUuid) {
    source.add(new Option(`${settings.inputName || settings.inputUuid}（未検出）`, "missing"));
    source.value = "missing";
  }
}

window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
  const actionData = JSON.parse(actionInfo);
  context = uuid;
  actionUuid = actionData.action;
  settings = actionData.payload?.settings ?? {};
  label.value = settings.label || "";
  renderSources();
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event: registerEvent, uuid }));
    send("getGlobalSettings");
    send("getSettings");
    send("sendToPlugin", { op: "list" });
  };
  socket.onclose = () => { status.textContent = "Stream Deckとの接続が切れました。設定画面を開き直してください。"; connect.disabled = true; };
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.event === "didReceiveSettings") {
      settings = message.payload.settings ?? {};
      label.value = settings.label || "";
      renderSources();
    } else if (message.event === "didReceiveGlobalSettings") {
      globalSettings = message.payload.settings ?? {};
      address.value = globalSettings.address || "ws://127.0.0.1:4455";
      password.value = globalSettings.password || "";
      globalLoaded = true;
      connect.disabled = false;
    } else if (message.event === "sendToPropertyInspector" && message.payload?.type === "sources") {
      inputs = message.payload.inputs || [];
      status.textContent = message.payload.message || "";
      renderSources();
    }
  };
};

source.addEventListener("change", () => {
  if (source.value === "missing") return;
  const input = source.value === "" ? undefined : inputs[Number(source.value)];
  settings = { ...settings, inputName: input?.inputName || "", inputUuid: input?.inputUuid || "" };
  send("setSettings", settings);
});
label.addEventListener("change", () => {
  settings = { ...settings, label: label.value.trim() };
  send("setSettings", settings);
});
document.getElementById("refresh").addEventListener("click", () => send("sendToPlugin", { op: "list" }));
connect.addEventListener("click", () => {
  if (!globalLoaded) return;
  try {
    const url = new URL(address.value.trim());
    if (!["ws:", "wss:"].includes(url.protocol) || url.username || url.password || url.hash) throw new Error();
  } catch {
    status.textContent = "接続先は ws://ホスト:ポート の形式で指定してください。";
    return;
  }
  globalSettings = { ...globalSettings, address: address.value.trim(), password: password.value };
  send("setGlobalSettings", globalSettings);
  send("sendToPlugin", { op: "connect" });
});
