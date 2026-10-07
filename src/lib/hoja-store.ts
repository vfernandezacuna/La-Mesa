import type { HojaGuardada } from "./hoja-diff";

// Guarda en el navegador (IndexedDB) cómo estaba cada hoja larga la última vez
// que se leyó, para leer después solo lo nuevo. Si el navegador no lo permite,
// simplemente se lee la hoja completa cada vez.

const BD = "lamesa-hojas";
const TABLA = "hojas";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLA);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cargarHoja(clave: string): Promise<HojaGuardada | null> {
  try {
    const db = await abrir();
    return await new Promise((resolve) => {
      const req = db.transaction(TABLA, "readonly").objectStore(TABLA).get(clave);
      req.onsuccess = () => resolve((req.result as HojaGuardada | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function guardarHoja(clave: string, hoja: HojaGuardada): Promise<void> {
  try {
    const db = await abrir();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(TABLA, "readwrite");
      tx.objectStore(TABLA).put(hoja, clave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // sin almacenamiento local: la próxima vez se lee completa
  }
}
