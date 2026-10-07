-- Frentes de cada tema del CNX Tracker: la lista de contratos / líneas de trabajo
-- de los que se quiere ver siempre un estado de una línea (p. ej. cada contrato
-- de "Contratos y Reclamaciones"). Claude llena el estado de cada frente dentro
-- de la misma lectura de estado, sin trabajo manual.

alter table critical_topics add column if not exists frentes text[] not null default '{}';

update critical_topics
set frentes = array['CSGI-XCEEC', 'Kalpataru (KPC)', 'GTA', 'COX', 'Sterlite', 'CSTC']
where frentes = '{}' and title ilike '%contrato%';

update critical_topics
set frentes = array['Concesiones Eléctricas (CCEE)', 'Negociaciones Voluntarias']
where frentes = '{}' and title ilike '%concesi%';
