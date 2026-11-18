interface Window {
  count: number;
  expiresAt: number;
}

type Reservation = { release: () => void } | { retryAfterMs: number };

export class FixedWindowCounter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  retryAfterMs(key: string): number {
    return this.waitTime(key, this.now());
  }

  reserve(key: string): Reservation {
    const now = this.now();
    const retryAfterMs = this.waitTime(key, now);
    if (retryAfterMs > 0) return { retryAfterMs };

    const window = this.windows.get(key) ?? { count: 0, expiresAt: now + this.windowMs };
    this.windows.set(key, window);
    window.count++;

    let released = false;
    return {
      release: () => {
        if (released || this.windows.get(key) !== window) return;
        released = true;
        window.count--;
        if (window.count === 0) this.windows.delete(key);
      },
    };
  }

  private waitTime(key: string, now: number): number {
    // Every entry in this map has the same lifetime, so insertion order is expiry order.
    for (const [expiredKey, window] of this.windows) {
      if (window.expiresAt > now) break;
      this.windows.delete(expiredKey);
    }

    const window = this.windows.get(key);
    if (window) return window.count >= this.limit ? window.expiresAt - now : 0;
    if (this.windows.size < this.maxKeys) return 0;

    const oldest = this.windows.values().next().value;
    return oldest ? oldest.expiresAt - now : 0;
  }
}
