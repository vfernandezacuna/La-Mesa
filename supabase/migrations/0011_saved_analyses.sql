-- ============================================================
-- Lecturas y análisis guardados: que no se pierdan al salir de la
-- pestaña (y no haya que volver a gastar crédito para verlos).
-- Se reutiliza market_briefings ampliando los tipos permitidos:
--   cio_patrimonio  lectura del CIO en Patrimonio
--   cio_cartera     análisis del CIO de una cartera (input_text = clave de la cartera)
--   ideas           ideas para investigar (output_text = JSON)
-- ============================================================
alter table market_briefings drop constraint if exists market_briefings_kind_check;
alter table market_briefings
  add constraint market_briefings_kind_check
  check (kind in ('brief', 'news', 'cio_patrimonio', 'cio_cartera', 'ideas'));
