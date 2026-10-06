import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // No ejecutar lógica entre createServerClient y getClaims(): invalidaría la sesión.
    // getClaims refresca la sesión si venció y valida el token localmente
    // (sin llamar al servidor de Auth en cada solicitud) cuando el proyecto
    // usa claves asimétricas; si no, hace la misma validación por red que
    // getUser.
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims?.sub ? data.claims : null;

    if (!user && !isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (user && isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (err) {
    // Nunca dejar que un problema de configuración de Supabase tumbe el
    // Edge Runtime con una pantalla en blanco: se degrada a /login con
    // el motivo visible, y el detalle completo queda en los logs de Vercel.
    console.error("Error en el middleware de Supabase:", err);
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set(
        "error",
        "No se pudo conectar con Supabase. Revisa las variables de entorno en Vercel.",
      );
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }
}
