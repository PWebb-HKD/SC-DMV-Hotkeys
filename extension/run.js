/**
 * Cooperative cancellation shared by automation and PDF capture. A new command aborts
 * the old run. Guard both an API request and its continuation: cancellation cannot
 * recall a submitted website request, but must prevent later actions and stale UI.
 */
export function cancelled() { return new DOMException('Replaced by a newer search.', 'AbortError'); }
/** Identify cooperative cancellation without treating ordinary portal or transport errors as cancellation. */
export function isCancelled(error) { return error?.name === 'AbortError'; }

/** Own one command generation and provide cancellation-aware await boundaries. */
export class SearchRun {
  /** Allocate a unique workflow ID and its AbortController. */
  constructor() { this.id = crypto.randomUUID(); this.controller = new AbortController(); }
  /** Expose the signal to lower-level operations that support native cancellation. */
  get signal() { return this.controller.signal; }
  /** Refuse any continuation after Stop or command replacement. */
  check() { if (this.signal.aborted) throw cancelled(); }
  /** Abort cooperatively; already-submitted DMV transactions cannot be recalled. */
  cancel() { this.controller.abort(); }
  /** Release the caller on abort even if the underlying API never settles.
   * Promise.race keeps the old request observed so late rejection is handled. */
  async step(action) {
    this.check();
    let onAbort;
    const abort = new Promise((_, reject) => { onAbort = () => reject(cancelled()); this.signal.addEventListener('abort', onAbort, {once: true}); });
    try {
      const result = await Promise.race([Promise.resolve().then(() => { this.check(); return action(); }), abort]);
      this.check(); return result;
    } finally { this.signal.removeEventListener('abort', onAbort); }
  }
}

// Guard every API call and its continuation so superseded searches cannot
// navigate, submit, steal focus, or publish errors after a new command starts.
export function guardedApi(api, run) {
  if (!run) return api;
  const cache = new WeakMap();
  /** Proxy each API object once and preserve method receivers while guarding asynchronous continuations. */
  function wrap(object) {
    if (cache.has(object)) return cache.get(object);
    const proxy = new Proxy(object, {get(target, key) {
      const value = target[key];
      if (typeof value === 'function') return (...args) => run.step(() => value.apply(target, args));
      return value && typeof value === 'object' ? wrap(value) : value;
    }});
    cache.set(object, proxy); return proxy;
  }
  return wrap(api);
}
