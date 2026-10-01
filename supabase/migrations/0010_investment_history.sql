-- Historia de valor de las carteras para el gráfico de evolución y la CAGR.
-- Futalemu ya guarda una fila por fecha (investments_futalemu); las cuentas
-- de investment_accounts solo guardaban el último valor, así que se agrega
-- una tabla de snapshots que el botón "Actualizar" va llenando.

create table investment_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references investment_accounts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null,
  capital numeric,
  caja numeric,
  invertido numeric,
  valor_mercado numeric,
  rent_anio numeric,
  rent_acum numeric,
  created_at timestamptz not null default now(),
  unique (account_id, fecha)
);

alter table investment_account_snapshots enable row level security;

create policy "own investment_account_snapshots" on investment_account_snapshots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on investment_account_snapshots to authenticated;

-- Primer punto de cada cuenta: su valor actual.
insert into investment_account_snapshots
  (account_id, user_id, fecha, capital, caja, invertido, valor_mercado, rent_anio, rent_acum)
select id, user_id, fecha, capital, caja, invertido, valor_mercado, rent_anio, rent_acum
from investment_accounts
where coalesce(valor_mercado, 0) > 0
on conflict (account_id, fecha) do nothing;

-- Cierres anuales de Futalemu, tomados de "Inversiones Futalemu.xlsx"
-- (Portafolio Chile - Resumen). Si una fecha ya existe, no se toca.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vfernandezacuna@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario no encontrado: se omite la historia de Futalemu.';
    RETURN;
  END IF;

  INSERT INTO investments_futalemu
    (user_id, fecha, capital, caja, invertido, valor_mercado, rent_anio, rent_acum)
  VALUES
    (v_user_id, '2023-12-31', 100000000, 8276080, 97377506, 108099653, 0.1638, 0.1638),
    (v_user_id, '2024-12-31', 100000000, 33214718, 81490894, 106934214, 0.2043, 0.4015),
    (v_user_id, '2025-12-30', 125000000, 31453600, 131187452, 230633654, 0.6917, 1.0967)
  ON CONFLICT (user_id, fecha) DO NOTHING;
END $$;
