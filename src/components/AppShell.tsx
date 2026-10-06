"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sun, Calendar, RotateCcw, Compass, Scale, Landmark, LineChart, Briefcase, type LucideIcon } from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/", icon: Sun, label: "Hoy" },
  { href: "/calendario", icon: Calendar, label: "Calendario" },
  { href: "/temas-criticos", icon: Briefcase, label: "CNX Tracker" },
  { href: "/revision", icon: RotateCcw, label: "Revisión" },
  { href: "/coach", icon: Compass, label: "Coach" },
  { href: "/consejo", icon: Scale, label: "El Consejo" },
  { href: "/patrimonio", icon: Landmark, label: "Patrimonio" },
  { href: "/inversiones", icon: LineChart, label: "Inversiones" },
];

const MOBILE_LABELS: Record<string, string> = {
  "/calendario": "Mes",
  "/patrimonio": "Patrim.",
  "/temas-criticos": "CNX",
};

// Sin precarga, la navegación espera al servidor: este punto avisa que el
// toque se registró mientras carga la página.
function NavPending() {
  const { pending } = useLinkStatus();
  return <span className={`nav-pending ${pending ? "on" : ""}`} aria-hidden="true" />;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app">
      <div className="sidebar">
        <div className="brand">La Mesa</div>
        <div className="brand-sub">Panel personal</div>

        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <item.icon className="nav-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
            {item.label}
            <NavPending />
          </Link>
        ))}

        <div className="sidebar-footer">
          Escribe en lenguaje natural y el sistema ordena tus tareas.
          <form action={logout} style={{ marginTop: 10 }}>
            <button
              type="submit"
              className="ghost"
              style={{ fontSize: "0.76rem", padding: "6px 12px", minHeight: 0 }}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <div className="main">{children}</div>

      <nav className="mobile-tabs" aria-label="Navegación">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`tab-item ${pathname === item.href ? "active" : ""}`}
          >
            <item.icon className="tab-icon" size={19} strokeWidth={2} aria-hidden="true" />
            <span className="tab-lbl">{MOBILE_LABELS[item.href] ?? item.label}</span>
            <NavPending />
          </Link>
        ))}
      </nav>
    </div>
  );
}
