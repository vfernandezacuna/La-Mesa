import { navegar, refrescar, useRuta } from "./router";

export function usePathname() {
  return useRuta().path;
}

export function useRouter() {
  return { refresh: refrescar, push: navegar, replace: navegar };
}
