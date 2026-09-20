import streamDeck, { SingletonAction, action } from "@elgato/streamdeck";
import { ObsClient } from "./obs-client.js";
import { MeterController } from "./controller.js";

const client = new ObsClient();
let inspectorContext;
let timer;
let config = {};
let loaded = false;
const controller = new MeterController(client, () => {
  if (inspectorContext) void sendInspector();
});

async function sendInspector() {
  try {
    await streamDeck.ui.sendToPropertyInspector(controller.inspectorState());
  } catch { /* インスペクターを閉じた場合は無視する。 */ }
}

function start() {
  if (!controller.entries.size) return;
  if (!timer) timer = setInterval(() => { void controller.renderAll(); }, 50);
  if (loaded) client.start(config);
}

class AudioMeterAction extends SingletonAction {
  onWillAppear(ev) {
    controller.attach(ev.action, ev.payload.settings ?? {});
    start();
    return controller.renderAll();
  }

  onWillDisappear(ev) {
    controller.detach(ev.action.id);
    if (inspectorContext === ev.action.id) inspectorContext = undefined;
    if (!controller.entries.size) {
      clearInterval(timer);
      timer = undefined;
      client.stop();
    }
  }

  onDidReceiveSettings(ev) {
    controller.changeSettings(ev.action.id, ev.payload.settings);
    return controller.renderAll();
  }

  onKeyDown(ev) { controller.resetPeak(ev.action.id); }
  onDialDown(ev) { controller.resetPeak(ev.action.id); }
  onTouchTap(ev) { controller.resetPeak(ev.action.id); }

  onPropertyInspectorDidAppear(ev) {
    inspectorContext = ev.action.id;
    return sendInspector();
  }
  onPropertyInspectorDidDisappear(ev) {
    if (inspectorContext === ev.action.id) inspectorContext = undefined;
  }
  async onSendToPlugin(ev) {
    inspectorContext = ev.action.id;
    if (ev.payload?.op === "list") await controller.refreshSources();
    if (ev.payload?.op === "connect") {
      // 保存イベントとの到着順に依存せず最新の共通設定を取得する。
      config = await streamDeck.settings.getGlobalSettings();
      loaded = true;
      client.stop();
      start();
    }
    await sendInspector();
  }
}

streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  config = ev.settings ?? {};
  loaded = true;
  start();
});
const RegisteredAction = action({ UUID: "com.twrt.obs.audio-meter.meter" })(AudioMeterAction, {});
streamDeck.actions.registerAction(new RegisteredAction());
await streamDeck.connect();
config = await streamDeck.settings.getGlobalSettings();
loaded = true;
start();
