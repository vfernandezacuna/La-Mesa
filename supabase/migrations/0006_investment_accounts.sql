-- Segunda cartera de inversión — "Cartera Personal" (cuenta en corredora
-- para el ahorro de la casa), distinta de la sociedad de inversión
-- Futalemu. En vez de una tabla específica más (como investments_futalemu),
-- generalizamos: investment_accounts admite cualquier cantidad de cuentas
-- de inversión nombradas, cada una con sus posiciones — así una tercera
-- cartera a futuro no necesita otra migración.

create table investment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  descripcion text,
  fecha date not null,
  capital numeric,
  caja numeric,
  invertido numeric,
  valor_mercado numeric,
  rent_anio numeric,
  rent_acum numeric,
  created_at timestamptz not null default now()
);
create index investment_accounts_user_idx on investment_accounts (user_id);

create table investment_account_positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references investment_accounts(id) on delete cascade,
  ticker text not null,
  invertido numeric,
  valor_mercado numeric,
  cantidad numeric,
  precio_costo numeric,
  precio_mercado numeric
);
create index investment_account_positions_account_idx on investment_account_positions (account_id);

alter table investment_accounts enable row level security;
alter table investment_account_positions enable row level security;

create policy "own investment_accounts" on investment_accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tabla hija sin user_id propio: se valida vía la cuenta
create policy "own investment_account_positions" on investment_account_positions for all
  using (exists (
    select 1 from investment_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from investment_accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));

grant select, insert, update, delete on investment_accounts to authenticated;
grant select, insert, update, delete on investment_account_positions to authenticated;
