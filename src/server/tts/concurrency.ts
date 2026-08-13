export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export function createLimiter(concurrency: number): Limiter {
  const maxConcurrency = Math.max(1, Math.floor(concurrency));
  let activeCount = 0;
  const queue: Array<() => void> = [];

  function drainQueue(): void {
    if (activeCount >= maxConcurrency) {
      return;
    }

    const next = queue.shift();
    next?.();
  }

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount += 1;
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            activeCount -= 1;
            drainQueue();
          });
      };

      if (activeCount < maxConcurrency) {
        run();
        return;
      }

      queue.push(run);
    });
  };
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const maxConcurrency = Math.max(1, Math.floor(concurrency));
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index] as T;
      await worker(item, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrency, items.length) }, () =>
      runWorker(),
    ),
  );
}
