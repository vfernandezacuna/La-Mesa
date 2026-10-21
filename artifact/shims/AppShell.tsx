import { useEffect, useState, type ReactNode } from "react";
import { Sun, Calendar, RotateCcw, Compass, Scale, Landmark, LineChart, Briefcase, Database, type LucideIcon } from "lucide-react";
import Link from "./next-link";
import { usePathname } from "./next-navigation";
import { IndicadoresBox } from "./IndicadoresBox";
import { leerTabla } from "./supabase";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/", icon: Sun, label: "Hoy" },
  { href: "/calendario", icon: Calendar, label: "Calendario" },
  { href: "/temas-criticos", icon: Briefcase, label: "CNX Tracker" },
  { href: "/revision", icon: RotateCcw, label: "Revisión" },
  { href: "/coach", icon: Compass, label: "Coach" },
  { href: "/consejo", icon: Scale, label: "El Consejo" },
  { href: "/patrimonio", icon: Landmark, label: "Patrimonio" },
  { href: "/inversiones", icon: LineChart, label: "Inversiones" },
  { href: "/datos", icon: Database, label: "Datos" },
];

const MOBILE_LABELS: Record<string, string> = {
  "/calendario": "Mes",
  "/patrimonio": "Patrim.",
  "/temas-criticos": "CNX",
};

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [vacio, setVacio] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [t, c] = await Promise.all([leerTabla("tasks"), leerTabla("critical_topics")]);
        if (vivo) setVacio(t.length === 0 && c.length === 0);
      } catch {
        // sin datos guardados todavía
      }
    })();
    return () => {
      vivo = false;
    };
  }, [pathname]);

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">La Mesa</div>
        <div className="brand-sub">Panel personal</div>

        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? "active" : ""}`}>
            <item.icon className="nav-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
            {item.label}
          </Link>
        ))}

        <div className="sidebar-footer">
          <IndicadoresBox compacto />
        </div>
      </div>

      <div className="main">
        {vacio && pathname !== "/datos" && (
          <div className="empty-note" style={{ marginBottom: 16 }}>
            Todavía no hay datos guardados en esta página. Entra a <Link href="/datos">Datos</Link> para traer los de tu panel anterior.
          </div>
        )}
        {children}
      </div>

      <nav className="mobile-tabs" aria-label="Navegación">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={`tab-item ${pathname === item.href ? "active" : ""}`}>
            <item.icon className="tab-icon" size={19} strokeWidth={2} aria-hidden="true" />
            <span className="tab-lbl">{MOBILE_LABELS[item.href] ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
