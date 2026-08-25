# La Mesa — Panel personal

Migración del panel personal (antes un solo HTML con JS embebido) a Next.js
(App Router) + Supabase + Vercel.

## Estado

Fase 2 (scaffolding) completa: proyecto Next.js + TypeScript + Tailwind,
autenticación de un solo usuario contra Supabase, endpoint de servidor para
Claude, y el esquema completo de base de datos en
`supabase/migrations/0001_init.sql`.

Las pestañas todavía no están migradas — eso es la Fase 4, una por una.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Elige nombre (ej. `la-mesa`), una contraseña de base de datos (guárdala,
   no es la misma que tu contraseña de login) y la región más cercana.
3. Cuando el proyecto esté listo, ve a **Project Settings → API** y copia:
   - **Project URL** → va en `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** (sección "secret") → va en `SUPABASE_SERVICE_ROLE_KEY`
     (solo se usa en el script de seed de la Fase 3, nunca en el server de la app)
4. Ve a **SQL Editor** → **New query**, pega el contenido completo de
   `supabase/migrations/0001_init.sql` y ejecútalo. Esto crea las 19 tablas,
   siembra las clases de patrimonio, y activa Row Level Security.
5. Ve a **Authentication → Providers** y confirma que **Email** esté
   habilitado (viene habilitado por defecto).
6. Ve a **Authentication → Users** → **Add user** → **Create new user**, y
   crea tu propio usuario (tu email + una contraseña). Marca
   "Auto Confirm User" para no depender de un correo de confirmación.
   Esta app **no tiene pantalla de registro pública** a propósito — al ser
   de un solo usuario, la cuenta se crea directamente desde el dashboard.

## 2. Variables de entorno

Copia `.env.example` a `.env.local` y complétalo:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

`ANTHROPIC_API_KEY` sale de [console.anthropic.com](https://console.anthropic.com)
→ API Keys. Nunca debe llevar el prefijo `NEXT_PUBLIC_` — si lo tuviera
quedaría expuesta en el navegador.

## 3. Correr en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Te redirige a `/login`; entra con el usuario
que creaste en el paso 1.6.

## 4. Desplegar en Vercel

1. Sube este repo a GitHub (si aún no lo hiciste).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el
   repo.
3. En **Environment Variables** agrega las mismas 4 variables de
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`).
4. Deploy.

## Arquitectura

- **Frontend + backend**: Next.js App Router, todo en `src/app`.
- **Auth**: Supabase Auth (email + contraseña), sesión manejada por cookies
  vía `@supabase/ssr`. `src/middleware.ts` protege todas las rutas excepto
  `/login`.
- **Base de datos**: Postgres en Supabase, con Row Level Security en todas
  las tablas (`auth.uid() = user_id`).
- **IA**: todas las llamadas a Claude pasan por `POST /api/claude`
  (`src/app/api/claude/route.ts`), que agrega `ANTHROPIC_API_KEY` en el
  servidor. El navegador nunca ve la API key. El mismo endpoint sirve para
  las 3 modalidades que usaba el HTML original (texto plano, búsqueda web,
  y documentos PDF adjuntos) según el `messages`/`tools` que se le mande.
