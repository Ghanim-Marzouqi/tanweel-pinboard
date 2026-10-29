import { describe, expect, it } from 'vitest';
import { createLoginLimiter } from '@/lib/rate-limit';

function setup() {
  let now = 0;
  const limiter = createLoginLimiter({ maxFailures: 3, windowMs: 1000, now: () => now });
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe('createLoginLimiter', () => {
  it('blocks after the maximum number of failures', () => {
    const { limiter } = setup();
    limiter.recordFailure('ali');
    limiter.recordFailure('ali');
    expect(limiter.isBlocked('ali')).toBe(false);
    limiter.recordFailure('ali');
    expect(limiter.isBlocked('ali')).toBe(true);
  });

  it('tracks each key separately', () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure('ali');
    expect(limiter.isBlocked('sara')).toBe(false);
  });

  it('unblocks once the window has passed', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure('ali');
    advance(1000);
    expect(limiter.isBlocked('ali')).toBe(false);
  });

  it('clears failures on reset', () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure('ali');
    limiter.reset('ali');
    expect(limiter.isBlocked('ali')).toBe(false);
  });
});
