/**
 * In-process pub/sub for the live feed (SSE). One Node process is enough for
 * the MVP; replace with Redis pub/sub or Postgres LISTEN/NOTIFY when the app
 * runs on more than one instance.
 */
type Listener = (event: string, data: unknown) => void;
const g = globalThis as unknown as { __cioBus?: Map<string, Set<Listener>> };
const bus: Map<string, Set<Listener>> = (g.__cioBus ??= new Map());

export function subscribe(projectId: string, fn: Listener) {
  if (!bus.has(projectId)) bus.set(projectId, new Set());
  bus.get(projectId)!.add(fn);
  return () => bus.get(projectId)?.delete(fn);
}

export function publish(projectId: string, event: string, data: unknown) {
  bus.get(projectId)?.forEach((fn) => {
    try {
      fn(event, data);
    } catch {
      /* a dead stream must not break the pipeline */
    }
  });
}
