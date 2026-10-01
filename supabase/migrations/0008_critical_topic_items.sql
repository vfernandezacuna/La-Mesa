-- Asuntos dentro de cada tema del CNX Tracker (ej: "Contrato KPC" dentro de
-- "Contratos y Reclamaciones"). Cada asunto tiene criticidad (1 baja · 2
-- media · 3 alta · 4 crítica), avance y tendencia; la tabla de snapshots
-- guarda cada cambio para graficar su evolución semana a semana.

create table critical_topic_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references critical_topics(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  descripcion text,
  criticidad smallint check (criticidad between 1 and 4),
  avance smallint check (avance between 0 and 100),
  tendencia text check (tendencia in ('mejora', 'estable', 'empeora')),
  estado text,
  proximo_hito text,
  proximo_hito_fecha date,
  sort_order int not null default 0,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
create index critical_topic_items_topic_idx on critical_topic_items (topic_id, sort_order);

create table critical_topic_item_snapshots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references critical_topic_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criticidad smallint not null check (criticidad between 1 and 4),
  avance smallint not null check (avance between 0 and 100),
  tendencia text not null check (tendencia in ('mejora', 'estable', 'empeora')),
  estado text,
  source_entry_id uuid references critical_topic_entries(id) on delete set null,
  created_at timestamptz not null default now()
);
create index critical_topic_item_snapshots_item_idx on critical_topic_item_snapshots (item_id, created_at);

alter table critical_topic_items enable row level security;
alter table critical_topic_item_snapshots enable row level security;

create policy "own critical_topic_items" on critical_topic_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own critical_topic_item_snapshots" on critical_topic_item_snapshots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on critical_topic_items to authenticated;
grant select, insert, update, delete on critical_topic_item_snapshots to authenticated;

-- Carga inicial de los asuntos de cada tema. El SQL Editor corre sin sesión
-- (auth.uid() es null), así que el usuario y los temas se buscan a mano; los
-- temas se ubican por palabra clave del título para no depender del nombre
-- exacto. Quedan "sin evaluar" hasta la primera evaluación.
DO $$
DECLARE
  v_user_id uuid;
  v_topic uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vfernandezacuna@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario no encontrado: se omite la carga inicial de asuntos.';
    RETURN;
  END IF;

  SELECT id INTO v_topic FROM critical_topics
    WHERE user_id = v_user_id AND title ILIKE '%legal%' ORDER BY created_at LIMIT 1;
  IF v_topic IS NOT NULL THEN
    INSERT INTO critical_topic_items (topic_id, user_id, name, sort_order) VALUES
      (v_topic, v_user_id, 'Financiamiento', 1),
      (v_topic, v_user_id, 'Juicios', 2);
  ELSE
    RAISE NOTICE 'No se encontró el tema de Asuntos Legales.';
  END IF;

  SELECT id INTO v_topic FROM critical_topics
    WHERE user_id = v_user_id AND title ILIKE '%contrato%' ORDER BY created_at LIMIT 1;
  IF v_topic IS NOT NULL THEN
    INSERT INTO critical_topic_items (topic_id, user_id, name, sort_order) VALUES
      (v_topic, v_user_id, 'Contrato CSGI-XCEEC', 1),
      (v_topic, v_user_id, 'Contrato KPC', 2),
      (v_topic, v_user_id, 'Contrato GTA', 3),
      (v_topic, v_user_id, 'Contrato COX', 4),
      (v_topic, v_user_id, 'Contrato Sterlite', 5),
      (v_topic, v_user_id, 'Contrato CSTC', 6);
  ELSE
    RAISE NOTICE 'No se encontró el tema de Contratos y Reclamaciones.';
  END IF;

  SELECT id INTO v_topic FROM critical_topics
    WHERE user_id = v_user_id AND title ILIKE '%concesi%' ORDER BY created_at LIMIT 1;
  IF v_topic IS NOT NULL THEN
    INSERT INTO critical_topic_items (topic_id, user_id, name, descripcion, sort_order) VALUES
      (v_topic, v_user_id, 'Concesiones Eléctricas', NULL, 1),
      (v_topic, v_user_id, 'Negociaciones Voluntarias', 'Predios Torre vs. Predios KPC', 2);
  ELSE
    RAISE NOTICE 'No se encontró el tema de Concesiones y Servidumbres.';
  END IF;
END $$;
