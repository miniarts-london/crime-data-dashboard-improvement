import { describe, expect, it } from 'vitest';
import { createLimiter } from '@/lib/concurrency';

// A promise we resolve or reject by hand, so each test controls exactly
// when a task finishes instead of relying on timers.
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Let pending promise callbacks (.then/.finally) run.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createLimiter', () => {
  it('never runs more than the limit at once', async () => {
    const limit = createLimiter(4);
    let active = 0;
    let peak = 0;

    const task = () =>
      limit(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      });

    await Promise.all(Array.from({ length: 10 }, task));

    expect(peak).toBe(4);
    expect(active).toBe(0);
  });

  it('starts a queued task as soon as a running one finishes', async () => {
    const limit = createLimiter(2);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    gates.forEach((gate, i) =>
      limit(() => {
        started.push(i);
        return gate.promise;
      })
    );
    await flush();
    expect(started).toEqual([0, 1]); // third task is queued

    gates[0].resolve();
    await flush();
    expect(started).toEqual([0, 1, 2]); // the freed slot is reused
  });

  it('passes results and errors back to the caller', async () => {
    const limit = createLimiter(2);

    await expect(limit(async () => 42)).resolves.toBe(42);
    await expect(limit(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });

  it('keeps the queue moving after a task fails', async () => {
    const limit = createLimiter(1);

    const failing = limit(async () => { throw new Error('upstream down'); });
    const next = limit(async () => 'still ran');

    await expect(failing).rejects.toThrow('upstream down');
    await expect(next).resolves.toBe('still ran');
  });

  it('rejects a limit below 1 instead of hanging silently', () => {
    expect(() => createLimiter(0)).toThrow(/at least 1/);
    expect(() => createLimiter(-1)).toThrow(/at least 1/);
  });
});
