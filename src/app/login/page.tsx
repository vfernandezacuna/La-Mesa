import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-5 rounded-lg border border-black/10 bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1D]">
            La Mesa
          </h1>
          <p className="mt-1 text-sm text-[#6b6a67]">Panel personal</p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm text-[#1D1D1D]">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#33517F] focus:ring-1 focus:ring-[#33517F]"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm text-[#1D1D1D]">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#33517F] focus:ring-1 focus:ring-[#33517F]"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-[#3D8F63] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#20603A]"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
