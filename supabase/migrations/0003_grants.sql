-- Las tablas creadas por SQL directo (en vez del Table Editor de Supabase)
-- no reciben automáticamente los permisos base para el rol "authenticated".
-- Row Level Security ya restringe cada fila a su dueño (auth.uid() =
-- user_id); esto solo habilita el acceso a nivel de tabla que RLS necesita
-- para poder evaluarse.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Para que las tablas que se creen más adelante (Fase 4) también queden
-- con estos permisos sin tener que repetir esto en cada migración futura.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
