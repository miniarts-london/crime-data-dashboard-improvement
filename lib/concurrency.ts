// A tiny concurrency-limited task queue, so a multi-postcode / multi-month
// search doesn't fire dozens of requests at once.
export function createLimiter(concurrency: number) {
  // Without this guard, concurrency <= 0 makes runNext()'s own
  // `active >= concurrency` check true immediately (0 >= 0), so no task
  // - ever - gets shifted off the queue. limit() still hands back a real
  // Promise to the caller, but nothing will ever resolve or reject it: a
  // silent, permanent hang instead of a loud failure, plus every queued
  // task piling up in `queue` forever since it's never drained. Failing
  // fast here, at the call site, is far easier to debug than that.
  if (concurrency <= 0) {
    throw new Error(`createLimiter: concurrency must be at least 1, got ${concurrency}`);
  }

  let active = 0;
  const queue: {
    fn: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  }[] = [];

  function runNext() {
    if (active >= concurrency || queue.length === 0) return;
    active += 1;
    const task = queue.shift()!;
    task
      .fn()
      .then(task.resolve, task.reject)
      .finally(() => {
        active -= 1;
        runNext();
      });
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve: resolve as (v: unknown) => void, reject });
      runNext();
    });
  };
}
