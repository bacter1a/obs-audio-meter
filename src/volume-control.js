export class VolumeControl {
  constructor(client) {
    this.client = client;
    this.jobs = new Map();
    this.epoch = 0;
    client.on("status", ({ status }) => { if (status !== "connected") this.epoch++; });
  }

  adjust(target, ticks, isCurrent = () => true) {
    if (!Number.isSafeInteger(ticks) || ticks === 0 || !isCurrent() || this.client.status !== "connected") return Promise.resolve(null);
    const key = JSON.stringify(target);
    let job = this.jobs.get(key);
    if (!job || job.epoch !== this.epoch) {
      job = { target, epoch: this.epoch, pending: [], running: false };
      this.jobs.set(key, job);
    }
    return new Promise((resolve, reject) => {
      job.pending.push({ ticks, isCurrent, resolve, reject });
      if (!job.running) void this.run(key, job);
    });
  }

  async run(key, job) {
    job.running = true;
    let batch = [];
    try {
      while (job.pending.length) {
        if (job.epoch !== this.epoch || this.client.status !== "connected") break;
        const current = await this.client.request("GetInputVolume", job.target);
        batch = job.pending.splice(0);
        const active = batch.filter((item) => item.isCurrent());
        const delta = active.reduce((sum, item) => sum + item.ticks, 0);
        if (job.epoch !== this.epoch || this.client.status !== "connected") break;
        const db = current.inputVolumeMul === 0 ? -100 : current.inputVolumeDb;
        if (!Number.isFinite(db)) throw new Error("音量を取得できません");
        const next = Math.max(-100, Math.min(0, db + delta));
        if (delta !== 0) await this.client.request("SetInputVolume", { ...job.target, inputVolumeDb: next });
        for (const item of batch) item.resolve(job.epoch === this.epoch && item.isCurrent() ? next : null);
        batch = [];
      }
    } catch (error) {
      // 書き込み失敗後は保留操作を再送しない。
      for (const item of [...batch, ...job.pending]) item.reject(error);
      batch = [];
      job.pending = [];
    } finally {
      for (const item of [...batch, ...job.pending]) item.resolve(null);
      if (this.jobs.get(key) === job) this.jobs.delete(key);
    }
  }
}
