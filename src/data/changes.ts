type Listener = () => void;

/** Tiny pub/sub so screens can refresh when data changes, wherever the change came from. */
export function createChangeEmitter() {
  const listeners = new Set<Listener>();
  return {
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(): void {
      listeners.forEach((listener) => listener());
    },
  };
}
