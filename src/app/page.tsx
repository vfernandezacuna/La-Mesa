import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAF8] px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1D]">
        La Mesa
      </h1>
      <p className="text-[#6b6a67]">
        Sesión iniciada como <span className="font-medium">{user?.email}</span>.
      </p>
      <p className="max-w-md text-sm text-[#9a9793]">
        Scaffolding de Fase 2 listo — auth, Supabase y el endpoint de Claude
        funcionando. Las pestañas se migran una a una en la Fase 4.
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium text-[#1D1D1D] transition hover:border-black/30"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
