-- El HTML original distingue Pasivos Corrientes (corto plazo) de Pasivos
-- No Corrientes (créditos hipotecarios) — 0001_init.sql solo creó la clase
-- no corriente. La agregamos para que el formulario manual, el importador
-- de planilla y la lectura del CIO puedan usar ambas, igual que el original.
insert into patrimonio_classes (code, label, sub, side) values
  ('corrientes_p', 'Pasivos corrientes', 'Corto plazo', 'pasivo');
