/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import AppShell from "./shims/AppShell";
import DatosView from "./shims/DatosView";
import { rutaInicial, useRuta } from "./shims/router";
import { POST as sincronizarInversiones } from "../src/app/api/inversiones/sync/route";
import { POST as sincronizarPatrimonio } from "../src/app/api/patrimonio/sync/route";
import HoyPage from "../src/app/(app)/page";
import CalendarioPage from "../src/app/(app)/calendario/page";
import CoachPage from "../src/app/(app)/coach/page";
import ConsejoPage from "../src/app/(app)/consejo/page";
import InversionesPage from "../src/app/(app)/inversiones/page";
import PatrimonioPage from "../src/app/(app)/patrimonio/page";
import RevisionPage from "../src/app/(app)/revision/page";
import TemasCriticosPage from "../src/app/(app)/temas-criticos/page";

type PageFn = (props: any) => Promise<ReactNode> | ReactNode;

const RUTAS: Record<string, PageFn> = {
  "/": HoyPage as PageFn,
  "/calendario": CalendarioPage as PageFn,
  "/coach": CoachPage as PageFn,
  "/consejo": ConsejoPage as PageFn,
  "/inversiones": InversionesPage as PageFn,
  "/patrimonio": PatrimonioPage as PageFn,
  "/revision": RevisionPage as PageFn,
  "/temas-criticos": TemasCriticosPage as PageFn,
};

class Limite extends Component<{ children: ReactNode; clave: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidUpdate(prev: { clave: string }) {
    if (prev.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div className="empty-note">Algo falló al mostrar esta pestaña: {this.state.error}</div>;
    return this.props.children;
  }
}

// Las páginas del panel eran componentes de servidor que leían sus datos y
// devolvían la vista: aquí se ejecutan en el navegador y se muestra el resultado.
function Pagina() {
  const ruta = useRuta();
  const [contenido, setContenido] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setError(null);
    const fn = RUTAS[ruta.path];
    if (!fn) {
      setContenido(null);
      return;
    }
    setContenido(null);
    Promise.resolve(fn({ searchParams: Promise.resolve(ruta.query) }))
      .then((el) => vivo && setContenido(el))
      .catch((e) => vivo && setError(e?.message ?? "No se pudieron cargar los datos."));
    return () => {
      vivo = false;
    };
  }, [ruta.path, ruta.version, ruta.query]);

  if (ruta.path === "/datos") return <DatosView />;
  if (!RUTAS[ruta.path]) return <div className="empty-note">Esa pestaña no existe.</div>;
  if (error) return <div className="empty-note">{error}</div>;
  if (!contenido) return <div className="loading">Cargando…</div>;
  return <>{contenido}</>;
}

function App() {
  const ruta = useRuta();
  return (
    <AppShell>
      <Limite clave={`${ruta.path}-${ruta.version}`}>
        <Pagina />
      </Limite>
    </AppShell>
  );
}

// Las rutas /api del panel anterior corrían en un servidor: aquí se ejecutan en
// la propia página, con la misma lógica.
const fetchReal = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (url.startsWith("/api/inversiones/sync")) return sincronizarInversiones(new Request("http://local" + url, init));
  if (url.startsWith("/api/patrimonio/sync")) return sincronizarPatrimonio(new Request("http://local" + url, init));
  return fetchReal(input, init);
};

rutaInicial();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
