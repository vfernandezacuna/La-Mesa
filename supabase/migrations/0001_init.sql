-- La Mesa — esquema inicial
-- Reemplaza las 17 claves de window.storage + las constantes hardcodeadas
-- (PROFILE_DEFAULT, PESO_SEED, EXAM_SEED, PAT_SEED, PAT_DETALLE, FUTALEMU)
-- del HTML original por tablas relacionales reales.

create extension if not exists "pgcrypto";

-- ============================================================
-- PERFIL (profile_data)
-- ============================================================
create table profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TAREAS — Hoy / Calendario / Revisión (today_tasks)
-- Las "prioridades de la semana" son tasks con from_weekly=true.
-- ============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'personal'
    check (category in ('trabajo', 'inversiones', 'personal')),
  due_date date,
  due_time time,
  is_meeting boolean not null default false,
  is_deadline boolean not null default false,
  priority text not null default 'media'
    check (priority in ('alta', 'media', 'baja')),
  is_focus boolean not null default false,
  done boolean not null default false,
  created_on date not null default current_date,
  completed_at date,
  from_weekly boolean not null default false,
  week_key text,
  created_at timestamptz not null default now()
);
create index tasks_user_idx on tasks (user_id);
create index tasks_user_due_idx on tasks (user_id, due_date);

-- ============================================================
-- REVISIÓN SEMANAL (reviews_data + last_insight)
-- ============================================================
create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,
  rango text,
  review_date date,
  note text,
  done_count int,
  pend_count int,
  late_count int,
  coach_conclusion text,
  coach_semana text,
  coach_accion text,
  created_at timestamptz not null default now(),
  unique (user_id, week_key)
);

-- ============================================================
-- COACH — check-in semanal (checkins_data)
-- ============================================================
create table checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood int,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- COACH — salud (peso_data, exam_data, salud_veredicto)
-- ============================================================
create table weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_on date not null,
  kg numeric(5, 2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create table exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date,
  test_name text not null,
  value text not null,
  created_at timestamptz not null default now()
);

create table health_verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  verdict_text text not null,
  signature text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HÁBITOS (habits_data)
-- ============================================================
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  cadence text not null check (cadence in ('daily', 'week')),
  weekly_target int,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index habit_logs_habit_idx on habit_logs (habit_id, occurred_on);

-- ============================================================
-- EL CONSEJO (decisions_data)
-- ============================================================
create table council_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dilema text not null,
  response_json jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- APRENDIZAJE (learning_data)
-- ============================================================
create table learning_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  response_text text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INVERSIONES — briefing de mercado / noticias
-- (news_source, last_news_text, last_brief_text, last_briefing)
-- ============================================================
create table market_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('brief', 'news')),
  input_text text,
  output_text text,
  output_html text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PATRIMONIO — indicadores del día (indicadores_dia)
-- ============================================================
create table market_indicators_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  as_of date not null,
  uf numeric,
  dolar numeric,
  fetched_at timestamptz not null default now(),
  primary key (user_id, as_of)
);

-- ============================================================
-- PATRIMONIO — trimestres (pat_data + PAT_SEED + PAT_DETALLE)
-- ============================================================
create table patrimonio_classes (
  code text primary key,
  label text not null,
  sub text,
  side text not null check (side in ('activo', 'pasivo'))
);

insert into patrimonio_classes (code, label, sub, side) values
  ('corrientes', 'Caja y equivalentes', 'Cuentas, efectivo', 'activo'),
  ('inversion', 'Inversiones financieras', 'Futalemu, fondos, acciones', 'activo'),
  ('inmueble', 'Inmuebles', 'Propiedades', 'activo'),
  ('retiro', 'Fondos de retiro', 'AFP, APV, AFC', 'activo'),
  ('mueble', 'Bienes muebles', 'Vehículos, mobiliario', 'activo'),
  ('nocorrientes_p', 'Deuda hipotecaria', 'Créditos de largo plazo', 'pasivo');

create table patrimonio_quarters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  quarter text not null check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  created_at timestamptz not null default now(),
  unique (user_id, year, quarter)
);

create table patrimonio_class_totals (
  quarter_id uuid not null references patrimonio_quarters(id) on delete cascade,
  class_code text not null references patrimonio_classes(code),
  amount numeric not null default 0,
  primary key (quarter_id, class_code)
);

-- Detalle por cuenta/propiedad (antes PAT_DETALLE, fijo para "la actual").
-- Ahora queda ligado al trimestre, así el detalle también tiene historia.
create table patrimonio_line_items (
  id uuid primary key default gen_random_uuid(),
  quarter_id uuid not null references patrimonio_quarters(id) on delete cascade,
  class_code text not null references patrimonio_classes(code),
  label text not null,
  amount numeric not null
);

-- ============================================================
-- INVERSIONES — cartera Futalemu (const FUTALEMU)
-- ============================================================
create table investments_futalemu (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  capital numeric,
  caja numeric,
  invertido numeric,
  valor_mercado numeric,
  rent_anio numeric,
  rent_acum numeric,
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

create table investments_futalemu_positions (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references investments_futalemu(id) on delete cascade,
  ticker text not null,
  invertido numeric,
  valor_mercado numeric,
  cantidad numeric,
  precio_costo numeric,
  precio_mercado numeric
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Un solo usuario hoy, pero se aplica auth.uid() = user_id en todas
-- las tablas para que quede correcto si algún día hay más de uno.
-- ============================================================
alter table profile enable row level security;
alter table tasks enable row level security;
alter table weekly_reviews enable row level security;
alter table checkins enable row level security;
alter table weight_log enable row level security;
alter table exam_results enable row level security;
alter table health_verdicts enable row level security;
alter table habits enable row level security;
alter table habit_logs enable row level security;
alter table council_sessions enable row level security;
alter table learning_log enable row level security;
alter table market_briefings enable row level security;
alter table market_indicators_cache enable row level security;
alter table patrimonio_classes enable row level security;
alter table patrimonio_quarters enable row level security;
alter table patrimonio_class_totals enable row level security;
alter table patrimonio_line_items enable row level security;
alter table investments_futalemu enable row level security;
alter table investments_futalemu_positions enable row level security;

create policy "own profile" on profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tasks" on tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own weekly_reviews" on weekly_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own checkins" on checkins for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own weight_log" on weight_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own exam_results" on exam_results for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own health_verdicts" on health_verdicts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own habits" on habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own habit_logs" on habit_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own council_sessions" on council_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own learning_log" on learning_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own market_briefings" on market_briefings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own market_indicators_cache" on market_indicators_cache for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own patrimonio_quarters" on patrimonio_quarters for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own investments_futalemu" on investments_futalemu for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tablas hijas sin user_id propio: se validan vía la cabecera
create policy "own patrimonio_class_totals" on patrimonio_class_totals for all
  using (exists (
    select 1 from patrimonio_quarters q
    where q.id = quarter_id and q.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from patrimonio_quarters q
    where q.id = quarter_id and q.user_id = auth.uid()
  ));

create policy "own patrimonio_line_items" on patrimonio_line_items for all
  using (exists (
    select 1 from patrimonio_quarters q
    where q.id = quarter_id and q.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from patrimonio_quarters q
    where q.id = quarter_id and q.user_id = auth.uid()
  ));

create policy "own investments_futalemu_positions" on investments_futalemu_positions for all
  using (exists (
    select 1 from investments_futalemu s
    where s.id = snapshot_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from investments_futalemu s
    where s.id = snapshot_id and s.user_id = auth.uid()
  ));

-- patrimonio_classes es una tabla de referencia compartida, de solo lectura
create policy "read patrimonio_classes" on patrimonio_classes for select
  using (auth.role() = 'authenticated');
