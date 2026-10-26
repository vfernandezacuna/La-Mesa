/* eslint-disable @typescript-eslint/no-explicit-any */
// CNX Tracker como página independiente (para publicarla en otra cuenta de Claude).
import { Component, StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Briefcase, ListChecks, Database } from "lucide-react";
import Link from "./shims/next-link";
import DatosView from "./shims/DatosView";
import TareasView from "./shims/TareasView";
import { useRuta } from "./shims/router";
import TemasCriticosPage from "../src/app/(app)/temas-criticos/page";

(window as unknown as { __MODO_CNX: boolean }).__MODO_CNX = true;
const TABLAS = ["critical_topics", "critical_topic_entries", "critical_topic_task_proposals", "tasks"];
const NAV = [
  { href: "/", icon: Briefcase, label: "CNX Tracker" },
  { href: "/tareas", icon: ListChecks, label: "Tareas" },
  { href: "/datos", icon: Database, label: "Datos" },
];

class Limite extends Component<{ children: ReactNode; clave: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidUpdate(prev: { clave: string }) {
    if (prev.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }
  render() {
    return this.state.error ? <div className="empty-note">Algo falló: {this.state.error}</div> : this.props.children;
  }
}

function Tracker() {
  const ruta = useRuta();
  const [el, setEl] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setEl(null);
    setError(null);
    Promise.resolve((TemasCriticosPage as any)({}))
      .then((x) => vivo && setEl(x))
      .catch((e) => vivo && setError(e?.message ?? "No se pudieron cargar los datos."));
    return () => {
      vivo = false;
    };
  }, [ruta.version]);
  if (error) return <div className="empty-note">{error}</div>;
  return el ? <>{el}</> : <div className="loading">Cargando…</div>;
}

function App() {
  const ruta = useRuta();
  const path = ruta.path === "/tareas" || ruta.path === "/datos" ? ruta.path : "/";
  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">CNX Tracker</div>
        <div className="brand-sub">Conexión Energía</div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`nav-item ${path === n.href ? "active" : ""}`}>
            <n.icon className="nav-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
            {n.label}
          </Link>
        ))}
      </div>
      <div className="main">
        <Limite clave={`${path}-${ruta.version}`}>
          {path === "/datos" ? <DatosView tablas={TABLAS} conIndicadores={false} /> : path === "/tareas" ? <TareasView /> : <Tracker />}
        </Limite>
      </div>
      <nav className="mobile-tabs" aria-label="Navegación">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`tab-item ${path === n.href ? "active" : ""}`}>
            <n.icon className="tab-icon" size={19} strokeWidth={2} aria-hidden="true" />
            <span className="tab-lbl">{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
