-- Tareas propuestas por Claude desde el CNX Tracker. Quedan guardadas como
-- "pendiente" hasta que el usuario las edita y las manda a La Mesa (se crea
-- la tarea en `tasks` y la propuesta pasa a "agregada") o las descarta.

create table critical_topic_task_proposals (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references critical_topics(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  is_deadline boolean not null default false,
  status text not null default 'pendiente' check (status in ('pendiente', 'agregada', 'descartada')),
  task_id uuid references tasks(id) on delete set null,
  source_entry_id uuid references critical_topic_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index critical_topic_task_proposals_topic_idx on critical_topic_task_proposals (topic_id, status);

alter table critical_topic_task_proposals enable row level security;

create policy "own critical_topic_task_proposals" on critical_topic_task_proposals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on critical_topic_task_proposals to authenticated;
