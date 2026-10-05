import { useEffect, useState } from 'preact/hooks';

/** Minimal observable store shared by the Pixi world and the Preact UI. */
export class Store<S extends object> {
  private listeners = new Set<() => void>();
  constructor(private state: S) {}

  get(): S {
    return this.state;
  }

  set(patch: Partial<S>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function useStore<S extends object, T>(store: Store<S>, select: (s: S) => T): T {
  const [value, setValue] = useState(() => select(store.get()));
  useEffect(() => store.subscribe(() => setValue(select(store.get()))), [store]);
  return value;
}
