-- CNX Tracker descriptivo: cada asunto pasa a tener una ficha (qué es / qué no
-- es, escrita por el usuario), un resumen actual y un registro de resúmenes
-- para comparar cómo avanza en el tiempo. La criticidad deja de usarse (las
-- columnas viejas quedan, sin uso).

alter table critical_topic_items
  add column if not exists ficha text,
  add column if not exists resumen text,
  add column if not exists resumen_updated_at timestamptz;

create table critical_topic_item_summaries (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references critical_topic_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resumen text not null,
  cambio text,
  source_entry_id uuid references critical_topic_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index critical_topic_item_summaries_item_idx on critical_topic_item_summaries (item_id, created_at);

alter table critical_topic_item_summaries enable row level security;
create policy "own critical_topic_item_summaries" on critical_topic_item_summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on critical_topic_item_summaries to authenticated;

-- Fichas iniciales con lo que el usuario ya explicó. Se pueden editar desde la
-- pantalla; solo se cargan si el asunto todavía no tiene ficha.
update critical_topic_items
set ficha = 'Ruta crítica predial del proyecto CNX: negociación voluntaria de los predios con sus propietarios (predios Torre y predios KPC). Es hoy lo más urgente del frente predial. NO incluye las notificaciones del proceso concesional: esas pertenecen a Concesiones Eléctricas.'
where ficha is null and name ilike 'Negociaciones Voluntarias%';

update critical_topic_items
set ficha = 'Proceso concesional para obtener las últimas concesiones eléctricas que le faltan al proyecto CNX. Incluye las notificaciones del proceso concesional. NO está asociado a las negociaciones voluntarias de predios: son dos caminos distintos.'
where ficha is null and name ilike 'Concesiones El%ctricas%';
