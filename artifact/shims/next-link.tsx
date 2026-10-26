import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navegar } from "./router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean; children?: ReactNode };

export default function Link({ href, prefetch: _prefetch, onClick, children, ...rest }: Props) {
  void _prefetch;
  // En la versión solo-CNX, "Ver en Hoy" lleva a la lista de Tareas.
  const destino = (window as unknown as { __MODO_CNX?: boolean }).__MODO_CNX && href === "/" && typeof children === "string" && children.startsWith("Ver en") ? "/tareas" : href;
  return (
    <a
      href={destino}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navegar(destino);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function useLinkStatus() {
  return { pending: false };
}
