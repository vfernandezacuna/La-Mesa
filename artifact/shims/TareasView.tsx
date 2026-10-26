import { useEffect, useState } from "react";
import { escribirFila, leerTabla } from "./supabase";
import { createClient } from "./supabase";

interface Tarea {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  done: boolean;
}

// Lista simple de las tareas que mandas desde el CNX Tracker.
export default function TareasView() {
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [nueva, setNueva] = useState("");

  const cargar = async () => setTareas(((await leerTabla("tasks")) as Tarea[]).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")));
  useEffect(() => {
    void cargar();
  }, []);

  async function marcar(t: Tarea) {
    await createClient().from("tasks").update({ done: !t.done, completed_at: !t.done ? new Date().toISOString().slice(0, 10) : null }).eq("id", t.id);
    await cargar();
  }
  async function borrar(t: Tarea) {
    await createClient().from("tasks").delete().eq("id", t.id);
    await cargar();
  }
  async function agregar() {
    const title = nueva.trim();
    if (!title) return;
    await escribirFila("tasks", { title, category: "trabajo", created_on: new Date().toISOString().slice(0, 10) });
    setNueva("");
    await cargar();
  }

  const abiertas = (tareas ?? []).filter((t) => !t.done);
  const hechas = (tareas ?? []).filter((t) => t.done);
  return (
    <>
      <h1 className="page-title">Tareas</h1>
      <div className="page-sub">Las tareas que mandas desde el CNX Tracker, y las que quieras sumar.</div>
      <div className="capture-mini" style={{ marginBottom: 18 }}>
        <input id="tarea-nueva" type="text" placeholder="Nueva tarea…" value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void agregar()} />
        <button onClick={() => void agregar()}>+</button>
      </div>
      {tareas === null ? (
        <div className="loading">Cargando…</div>
      ) : abiertas.length === 0 ? (
        <div className="empty-note">No tienes tareas pendientes.</div>
      ) : (
        abiertas.map((t) => (
          <div className="task-row" key={t.id}>
            <input type="checkbox" checked={false} onChange={() => void marcar(t)} />
            <span className="task-title">{t.title}</span>
            <span className="task-meta">{t.due_date ? <span className="time-chip">{t.due_date}</span> : null}</span>
            <span className="task-del" onClick={() => void borrar(t)}>✕</span>
          </div>
        ))
      )}
      {hechas.length > 0 && (
        <details style={{ marginTop: 18 }}>
          <summary>Hechas ({hechas.length})</summary>
          {hechas.map((t) => (
            <div className="task-row done" key={t.id}>
              <input type="checkbox" checked onChange={() => void marcar(t)} />
              <span className="task-title">{t.title}</span>
              <span className="task-del" onClick={() => void borrar(t)}>✕</span>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
