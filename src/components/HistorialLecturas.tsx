"use client";

import type { ReactNode } from "react";

export interface LecturaGuardada {
  id: string;
  created_at: string;
  output_text: string | null;
}

// Registro discreto de las lecturas anteriores: cerrado por defecto, una línea
// por lectura, y se abre solo si quieres releer una.
export function HistorialLecturas({
  items,
  render,
}: {
  items: LecturaGuardada[];
  render: (item: LecturaGuardada) => ReactNode;
}) {
  if (!items.length) return null;
  return (
    <details className="historial">
      <summary>Lecturas anteriores ({items.length})</summary>
      {items.map((it) => (
        <details className="historial-item" key={it.id}>
          <summary>
            {new Date(it.created_at).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
          </summary>
          <div className="historial-body">{render(it)}</div>
        </details>
      ))}
    </details>
  );
}
