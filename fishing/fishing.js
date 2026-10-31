// Catch lifecycle is independent of rendering and persistent scores.
export class FishingTrip {
  constructor(random = Math.random) { this.random = random; this.phase = 'ready'; this.elapsed = 0; this.fish = null; }
  cast(length) {
    if (this.phase !== 'ready') return false;
    this.phase = 'waiting'; this.elapsed = 0;
    const largeChance = Math.max(0.1, Math.min(0.7, (length - 0.8) / 6));
    this.fish = this.random() < largeChance ? 'large' : 'small';
    this.waitTime = 3.4 + this.random() * 1.2;
    return true;
  }
  tick(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.elapsed += Math.min(seconds, 0.1);
    if (this.phase === 'waiting' && this.elapsed >= this.waitTime) { this.phase = 'bite'; this.elapsed = 0; }
    if (this.phase === 'caught' && this.elapsed >= 1.1) { this.phase = 'ready'; this.fish = null; this.elapsed = 0; }
  }
  reel() {
    if (this.phase !== 'bite') return null;
    const fish = this.fish;
    this.phase = 'caught'; this.elapsed = 0;
    return fish;
  }
}
