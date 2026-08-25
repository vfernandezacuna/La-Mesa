"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { logout } from "@/app/login/actions";

const NAV_ITEMS = [
  { href: "/", icon: "◆", label: "Hoy" },
  { href: "/calendario", icon: "▦", label: "Calendario" },
  { href: "/revision", icon: "↻", label: "Revisión" },
  { href: "/coach", icon: "▲", label: "Coach" },
  { href: "/consejo", icon: "⚖", label: "El Consejo" },
  { href: "/patrimonio", icon: "$", label: "Patrimonio" },
  { href: "/inversiones", icon: "◈", label: "Inversiones" },
  { href: "/aprendizaje", icon: "✎", label: "Aprendizaje" },
];

const MOBILE_LABELS: Record<string, string> = {
  "/calendario": "Mes",
  "/patrimonio": "Patrim.",
};

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
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span> {item.label}
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
            className={`tab-item ${pathname === item.href ? "active" : ""}`}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-lbl">{MOBILE_LABELS[item.href] ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
