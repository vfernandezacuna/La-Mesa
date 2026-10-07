-- Habilitación Predial PMO: tema aparte (gestión de otra gerencia) con un panel
-- estructurado del reporte semanal de la PMO. Cada reporte queda guardado como
-- JSON en la entrada, para mostrar cifras, highlights y críticos, y comparar
-- semana a semana.

alter table critical_topic_entries add column if not exists report jsonb;

-- Concesiones y Servidumbres vuelve a ser solo el frente predial propio.
update critical_topics
set frentes = array['Concesiones Eléctricas (CCEE)', 'Negociaciones Voluntarias']
where title ilike '%concesi%';

-- El tema nuevo (si todavía no existe).
insert into critical_topics (user_id, title)
select u.id, 'Habilitación Predial PMO'
from auth.users u
where u.email = 'vfernandezacuna@gmail.com'
  and not exists (
    select 1 from critical_topics t where t.user_id = u.id and t.title ilike '%habilitaci%predial%'
  );
