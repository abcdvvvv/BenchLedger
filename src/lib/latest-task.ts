type Waiter<T> = { resolve: (value: T) => void; reject: (reason?: unknown) => void; };
type PendingTask<T> = { task: () => Promise<T>; waiters: Waiter<T>[]; };

export class LatestTaskRunner<T> {
  private running = false;
  private pending: PendingTask<T> | null = null;

  run(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const waiter = { resolve, reject };
      if (!this.running) { this.running = true; void this.execute({ task, waiters: [waiter] }); return; }
      if (this.pending) { this.pending.task = task; this.pending.waiters.push(waiter); return; }
      this.pending = { task, waiters: [waiter] };
    });
  }

  clearPending() {
    const pending = this.pending; this.pending = null;
    if (!pending) return;
    const error = new DOMException("Superseded by a newer query state.", "AbortError");
    for (const waiter of pending.waiters) waiter.reject(error);
  }

  private async execute(entry: PendingTask<T>) {
    try { const value = await entry.task(); for (const waiter of entry.waiters) waiter.resolve(value); }
    catch (error: unknown) { for (const waiter of entry.waiters) waiter.reject(error); }
    finally { const next = this.pending; this.pending = null; if (next) void this.execute(next); else this.running = false; }
  }
}
