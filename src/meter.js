export const STALE_MS = 750;
export const HOLD_MS = 1500;
export const toDb = (value) => typeof value === "number" && Number.isFinite(value) && value > 0
  ? 20 * Math.log10(value) : -Infinity;
export const formatDb = (db) => Number.isFinite(db) ? (Object.is(db, -0) ? 0 : db).toFixed(1) : "−∞";
export const fraction = (db) => Math.max(0, Math.min(1, (db + 60) / 60));

export function matches(input, selection) {
  return selection.inputUuid ? input.inputUuid === selection.inputUuid : input.inputName === selection.inputName;
}

export class Meter {
  constructor() { this.reset(); }
  reset() {
    this.lastAt = -Infinity;
    this.levels = [-Infinity, -Infinity];
    this.peaks = [-Infinity, -Infinity];
    this.holdUntil = [0, 0];
    this.channels = 0;
    this.clipUntil = 0;
  }
  update(input, now = Date.now()) {
    if (now - this.lastAt > STALE_MS) this.reset();
    const channels = Array.isArray(input?.inputLevelsMul) ? input.inputLevelsMul : [];
    if (!channels.length) { this.reset(); return; }
    this.channels = channels.length;
    // 各チャンネルは [RMS, フェーダー・ミュート反映後のpeak, 入力peak]。
    const output = channels.map((channel) => toDb(channel?.[1]));
    this.levels = [output[0], output[1] ?? output[0]];
    for (let i = 0; i < 2; i++) {
      if (this.levels[i] >= this.peaks[i] || now >= this.holdUntil[i]) {
        this.peaks[i] = this.levels[i];
        this.holdUntil[i] = now + HOLD_MS;
      }
    }
    if (this.levels.some((db) => db >= 0)) this.clipUntil = now + HOLD_MS;
    this.lastAt = now;
  }
  snapshot(now = Date.now()) {
    if (now - this.lastAt > STALE_MS) {
      return { levels: [-Infinity, -Infinity], peaks: [-Infinity, -Infinity], channels: 0, stale: true, clip: false };
    }
    return {
      levels: this.levels,
      peaks: this.peaks.map((peak, i) => now < this.holdUntil[i] ? peak : this.levels[i]),
      channels: this.channels,
      stale: false,
      clip: now < this.clipUntil,
    };
  }
  resetPeak() {
    this.peaks = [...this.levels];
    this.holdUntil = [0, 0];
    this.clipUntil = 0;
  }
}
