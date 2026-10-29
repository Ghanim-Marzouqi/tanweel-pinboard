/**
 * Fixed-window failure counter for sign-in attempts, keyed by username.
 *
 * State lives in process memory, which is enough for the single-container
 * deployment. Running several app instances would need a shared store.
 */
export interface LoginLimiterOptions {
  maxFailures: number;
  windowMs: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  windowStart: number;
}

export function createLoginLimiter({ maxFailures, windowMs, now = Date.now }: LoginLimiterOptions) {
  const entries = new Map<string, Entry>();

  function current(key: string): Entry | undefined {
    const entry = entries.get(key);
    if (entry && now() - entry.windowStart >= windowMs) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    isBlocked(key: string): boolean {
      return (current(key)?.failures ?? 0) >= maxFailures;
    },
    recordFailure(key: string): void {
      const entry = current(key);
      if (entry) entry.failures++;
      else entries.set(key, { failures: 1, windowStart: now() });
    },
    reset(key: string): void {
      entries.delete(key);
    },
  };
}

const globalForLimiter = globalThis as unknown as {
  loginLimiter: ReturnType<typeof createLoginLimiter> | undefined;
};

export const loginLimiter = (globalForLimiter.loginLimiter ??= createLoginLimiter({
  maxFailures: 10,
  windowMs: 15 * 60 * 1000,
}));

const globalForResetLimiter = globalThis as unknown as {
  resetLimiter: ReturnType<typeof createLoginLimiter> | undefined;
};

/** "Forgot password" requests, per username/email. */
export const resetLimiter = (globalForResetLimiter.resetLimiter ??= createLoginLimiter({
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
}));
