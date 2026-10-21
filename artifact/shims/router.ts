import { useEffect, useState } from "react";

// Enrutador mínimo: la "ruta" es solo estado de la página (no toca la barra de
// direcciones). Guarda la última pestaña en el navegador, si se puede.

export interface Ruta {
  path: string;
  query: Record<string, string>;
  version: number;
}

let actual: Ruta = { path: "/", query: {}, version: 0 };
const oyentes = new Set<(r: Ruta) => void>();

function parsear(href: string): { path: string; query: Record<string, string> } {
  const [path, qs = ""] = href.split("?");
  const query: Record<string, string> = {};
  new URLSearchParams(qs).forEach((v, k) => (query[k] = v));
  return { path: path || "/", query };
}

function emitir() {
  oyentes.forEach((f) => f(actual));
}

export function navegar(href: string) {
  const { path, query } = parsear(href);
  actual = { path, query, version: actual.version + 1 };
  try {
    window.localStorage.setItem("lamesa-ruta", path);
  } catch {
    // sin almacenamiento local
  }
  emitir();
  window.scrollTo?.(0, 0);
}

// Vuelve a cargar los datos de la pestaña actual (equivale a router.refresh()).
export function refrescar() {
  actual = { ...actual, version: actual.version + 1 };
  emitir();
}

export function rutaInicial() {
  try {
    const guardada = window.localStorage.getItem("lamesa-ruta");
    if (guardada) actual = { path: guardada, query: {}, version: 0 };
  } catch {
    // sin almacenamiento local
  }
}

export function useRuta(): Ruta {
  const [r, setR] = useState(actual);
  useEffect(() => {
    oyentes.add(setR);
    setR(actual);
    return () => {
      oyentes.delete(setR);
    };
  }, []);
  return r;
}
