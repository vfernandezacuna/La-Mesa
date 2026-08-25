-- Autocompleta user_id con el usuario autenticado en cada insert, para que
-- el código del navegador no tenga que mandarlo explícitamente en cada
-- tabla (y no pueda, por error, mandar el de otro usuario).

alter table profile alter column user_id set default auth.uid();
alter table tasks alter column user_id set default auth.uid();
alter table weekly_reviews alter column user_id set default auth.uid();
alter table checkins alter column user_id set default auth.uid();
alter table weight_log alter column user_id set default auth.uid();
alter table exam_results alter column user_id set default auth.uid();
alter table health_verdicts alter column user_id set default auth.uid();
alter table habits alter column user_id set default auth.uid();
alter table habit_logs alter column user_id set default auth.uid();
alter table council_sessions alter column user_id set default auth.uid();
alter table learning_log alter column user_id set default auth.uid();
alter table market_briefings alter column user_id set default auth.uid();
alter table market_indicators_cache alter column user_id set default auth.uid();
alter table patrimonio_quarters alter column user_id set default auth.uid();
alter table investments_futalemu alter column user_id set default auth.uid();
