import { fraction, formatDb } from "./meter.js";

const xml = (text) => String(text).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
function short(text, budget) {
  let result = "", used = 0;
  for (const char of String(text)) {
    used += char.codePointAt(0) > 255 ? 2 : 1;
    if (used > budget) return result + "…";
    result += char;
  }
  return result;
}
const text = (x, y, value, size = 12, color = "#edf4ff", anchor = "start") =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${xml(value)}</text>`;
const rect = (x, y, width, height, fill, radius = 0) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}"/>`;

function bar(x, y, width, height, db, peak) {
  let result = rect(x, y, width, height, "#283645", 2);
  for (const [low, high, color] of [[-60, -20, "#31d6a0"], [-20, -9, "#ffd166"], [-9, 0, "#ff6276"]]) {
    const left = fraction(low) * width;
    const right = fraction(Math.min(high, db)) * width;
    if (right > left) result += rect(x + left, y, right - left, height, color);
  }
  if (peak > -60) result += rect(x + Math.min(width - 2, fraction(peak) * width), y - 1, 2, height + 2, "#ffffff");
  return result;
}

export function renderMeter({ name = "OBS Audio Meter", levels = [-Infinity, -Infinity], barLevels = levels, peaks = [-Infinity, -Infinity], channels = 2, status = "", clip = false, showDbfs = false, volumeDb }, dial = false) {
  const width = dial ? 200 : 144, height = dial ? 100 : 144;
  let content = rect(0, 0, width, height, "#101822");
  content += text(10, dial ? 19 : 23, short(name, dial ? 23 : 17), dial ? 14 : 15);
  if (status) {
    content += text(width / 2, dial ? 57 : 78, short(status, dial ? 25 : 17), dial ? 14 : 15, "#9bacbd", "middle");
    content += text(width / 2, dial ? 83 : 112, dial && Number.isFinite(volumeDb) ? `VOL ${formatDb(volumeDb)} dB` : "OBS AUDIO METER", 10, "#62778b", "middle");
  } else {
    const x = dial ? 25 : 21, w = dial ? 164 : 112;
    const ys = dial ? [35, 55] : [62, 83];
    for (let i = 0; i < 2; i++) {
      content += text(9, ys[i] + 10, channels === 1 ? "M" : i === 0 ? "L" : "R", 10, "#9bacbd");
      content += bar(x, ys[i], w, 12, barLevels[i], peaks[i]);
    }
    const db = formatDb(Math.max(...levels));
    const held = formatDb(Math.max(...peaks));
    if (dial) {
      if (Number.isFinite(volumeDb)) content += text(11, 88, `VOL ${formatDb(volumeDb)} dB`, 13);
      else if (showDbfs) content += text(11, 88, `${db} dBFS`, 17);
      content += text(189, 88, clip ? "CLIP" : `PK ${held}`, 12, clip ? "#ff6276" : "#9bacbd", "end");
    } else {
      if (showDbfs) content += text(72, 49, `${db} dBFS`, 19, "#edf4ff", "middle");
      content += text(21, 111, "−60", 10, "#62778b");
      content += text(133, 111, "0", 10, "#62778b", "end");
      content += text(72, 132, clip ? "CLIP" : `PK ${held}`, 13, clip ? "#ff6276" : "#9bacbd", "middle");
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g font-family="Segoe UI,Meiryo,sans-serif">${content}</g></svg>`;
}

export const imageData = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
