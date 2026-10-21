// Acceso a las capacidades del artifact (datos guardados, preguntarle a Claude,
// conectores). Todo es opcional: si una capacidad no está, se devuelve null.

type Capability = unknown;
interface ClaudeRuntime {
  use: (name: string) => Promise<Capability | null>;
}

const cache = new Map<string, Promise<Capability | null>>();

function usar<T>(name: string): Promise<T | null> {
  const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!rt?.use) return Promise.resolve(null);
  if (!cache.has(name)) cache.set(name, rt.use(name).catch(() => null));
  return cache.get(name) as Promise<T | null>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const getDb = () => usar<any>("db");
export const getSample = () => usar<any>("sample");
export const getMcp = () => usar<any>("mcp");
export const getUser = () => usar<any>("user");
export const getDownloads = () => usar<any>("downloads");
