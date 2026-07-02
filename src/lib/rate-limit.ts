// Minimal in-memory fixed-window rate limiter. Good enough for a single-node
// deployment; swap for a shared store if the app ever runs multiple instances.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export function rateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const win = windows.get(key);

  if (!win || now >= win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  win.count++;
  if (win.count > max) {
    return { allowed: false, retryAfterSec: Math.ceil((win.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

// Clearing on success stops one bad attempt from counting against the next login.
export function rateLimitClear(key: string) {
  windows.delete(key);
}

// Opportunistic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) {
    if (now >= win.resetAt) windows.delete(key);
  }
}, 60_000).unref?.();
