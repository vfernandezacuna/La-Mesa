"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sun, Calendar, RotateCcw, Compass, Scale, Landmark, LineChart, Briefcase, type LucideIcon } from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: "/", icon: Sun, label: "Hoy" },
  { href: "/calendario", icon: Calendar, label: "Calendario" },
  { href: "/temas-criticos", icon: Briefcase, label: "Temas críticos CNX" },
  { href: "/revision", icon: RotateCcw, label: "Revisión" },
  { href: "/coach", icon: Compass, label: "Coach" },
  { href: "/consejo", icon: Scale, label: "El Consejo" },
  { href: "/patrimonio", icon: Landmark, label: "Patrimonio" },
  { href: "/inversiones", icon: LineChart, label: "Inversiones" },
];

const MOBILE_LABELS: Record<string, string> = {
  "/calendario": "Mes",
  "/patrimonio": "Patrim.",
  "/temas-criticos": "Temas",
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
            <item.icon className="nav-icon" size={19} strokeWidth={2.25} aria-hidden="true" />
            {item.label}
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
            <item.icon className="tab-icon" size={19} strokeWidth={2} aria-hidden="true" />
            <span className="tab-lbl">{MOBILE_LABELS[item.href] ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
