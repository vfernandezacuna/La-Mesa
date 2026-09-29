-- Referencia a la hoja de Google Sheets desde la cual cada cartera se
-- actualiza con el botón "Actualizar". Una fila por cartera: portfolio_key
-- es 'futalemu' para la sociedad de inversión, o el id (uuid) de
-- investment_accounts para cualquier otra cartera — así no hace falta
-- tocar esta tabla cuando se agrega una cartera nueva.

create table portfolio_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  portfolio_key text not null,
  spreadsheet_id text not null,
  sheet_name text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, portfolio_key)
);
create index portfolio_sources_user_idx on portfolio_sources (user_id);

alter table portfolio_sources enable row level security;

create policy "own portfolio_sources" on portfolio_sources for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on portfolio_sources to authenticated;
