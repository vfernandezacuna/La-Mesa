import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navegar } from "./router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean; children?: ReactNode };

export default function Link({ href, prefetch: _prefetch, onClick, children, ...rest }: Props) {
  void _prefetch;
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navegar(href);
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
