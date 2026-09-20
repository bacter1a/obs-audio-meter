import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderMeter } from "../src/render.js";

const directory = new URL("../preview/", import.meta.url);
mkdirSync(directory, { recursive: true });
const states = [
  { name: "マイク", levels: [-18, -21], peaks: [-12, -15] },
  { name: "デスクトップ音声", levels: [-5, -8], peaks: [0, -2], clip: true, showDbfs: true },
  { name: "マイク", status: "MUTE" },
  { name: "デスクトップ音声", status: "OBS未接続" },
];
const cards = states.map((state, index) => {
  const key = renderMeter(state), strip = renderMeter(state, true);
  writeFileSync(new URL(`key-${index}.svg`, directory), key);
  writeFileSync(new URL(`strip-${index}.svg`, directory), strip);
  return `<section><div>${key}</div><div>${strip}</div></section>`;
}).join("");
writeFileSync(new URL("index.html", directory), `<!doctype html><html lang="ja"><meta charset="utf-8"><title>OBS Audio Meter — 表示プレビュー</title><style>body{font-family:'Segoe UI',Meiryo,sans-serif;background:#080d13;color:#edf4ff;padding:40px;max-width:980px;margin:auto}h1{font-size:26px}p{color:#9bacbd}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(370px,1fr));gap:22px;margin-top:32px}section{display:flex;align-items:center;gap:18px;padding:18px;border:1px solid #263341;border-radius:14px;background:#121b25}svg{display:block;border-radius:8px}footer{margin-top:28px;color:#9bacbd;font-size:13px}</style><h1>OBS Audio Meter</h1><p>通常ボタン ＋ Stream Deck＋タッチストリップ ／ 表示サンプル</p><main>${cards}</main><footer>模擬データによるプレビューです。音声レベルはdBFS、ピーク保持は1.5秒。横長画面はダイヤル1個分の200×100領域です。</footer></html>`);
console.log(fileURLToPath(new URL("index.html", directory)));
