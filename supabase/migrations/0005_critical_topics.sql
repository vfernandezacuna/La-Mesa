-- Temas críticos — pestaña nueva, sin equivalente en el HTML original.
-- Carpetas de trabajo que el usuario crea a mano; cada una acumula notas y
-- material (correos pegados, fotos, PDFs) y mantiene una lectura de estado
-- que la IA regenera cada vez que entra algo nuevo.

create table critical_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  status_summary text,
  status_updated_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index critical_topics_user_idx on critical_topics (user_id, archived);

create table critical_topic_entries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references critical_topics(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('note', 'material')),
  content_text text not null,
  file_name text,
  created_at timestamptz not null default now()
);
create index critical_topic_entries_topic_idx on critical_topic_entries (topic_id, created_at);

alter table critical_topics enable row level security;
alter table critical_topic_entries enable row level security;

create policy "own critical_topics" on critical_topics for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own critical_topic_entries" on critical_topic_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tablas creadas por SQL Editor no reciben los GRANT automáticos que da el
-- Table Editor — sin esto, RLS igual bloquea con "permission denied" (ver
-- 0003_grants.sql, mismo problema que tuvimos con `habits`).
grant select, insert, update, delete on critical_topics to authenticated;
grant select, insert, update, delete on critical_topic_entries to authenticated;
