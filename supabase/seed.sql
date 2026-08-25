-- La Mesa — seed de datos personales
--
-- Migra a las tablas de Supabase los datos que en el HTML original estaban
-- hardcodeados en el código: PROFILE_DEFAULT, PESO_SEED, EXAM_SEED,
-- PAT_SEED, PAT_DETALLE y FUTALEMU.
--
-- Cómo correrlo: Supabase → SQL Editor → New query → pega este archivo
-- completo → Run. Es seguro volver a correrlo (borra e inserta de nuevo).
--
-- Requiere que el usuario ya exista en Authentication → Users.

DO $$
DECLARE
  v_user_id uuid;
  v_quarter_id uuid;
  v_snapshot_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vfernandezacuna@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un usuario con ese email. Créalo primero en Authentication > Users.';
  END IF;

  -- Limpieza para que este script se pueda correr más de una vez sin duplicar
  DELETE FROM investments_futalemu_positions
    WHERE snapshot_id IN (SELECT id FROM investments_futalemu WHERE user_id = v_user_id);
  DELETE FROM investments_futalemu WHERE user_id = v_user_id;
  DELETE FROM patrimonio_line_items
    WHERE quarter_id IN (SELECT id FROM patrimonio_quarters WHERE user_id = v_user_id);
  DELETE FROM patrimonio_class_totals
    WHERE quarter_id IN (SELECT id FROM patrimonio_quarters WHERE user_id = v_user_id);
  DELETE FROM patrimonio_quarters WHERE user_id = v_user_id;
  DELETE FROM exam_results WHERE user_id = v_user_id;
  DELETE FROM weight_log WHERE user_id = v_user_id;
  DELETE FROM habits WHERE user_id = v_user_id;

  -- ============================================================
  -- PERFIL (antes PROFILE_DEFAULT)
  -- ============================================================
  INSERT INTO profile (user_id, content) VALUES (v_user_id, $p$QUIÉN ES — datos básicos
Vicente Hernán Fernández Acuña. Nació el 16 de septiembre de 1990 — hoy tiene 35 años (recalcula la edad exacta según la fecha de hoy). Casado, dos hijos: Clarita y Julián. Vive en Chile.

ROL Y FRENTES
Gerente Legal (CLO) y Secretario del Directorio de una compañía de desarrollo de infraestructura de transmisión de energía, en Chile.
Sus frentes:
· Legal — concesiones y servidumbres.
· Contratos y reclamaciones de contratistas.
· Secretaría del directorio y gobierno corporativo.
· Proyectos e infraestructura.
· Finanzas y estrategia, como integrante del comité ejecutivo.
· Inversiones — es su pasión profesional, tanto en la compañía como a título personal.
Camino definido: crecer como ejecutivo principal de una compañía por ahora, y transicionar hacia la independencia como empresario en un horizonte de ~10 años. Formación: MBA en Chile y curso de infraestructura en Harvard.

FAMILIA — su eje
Su propósito escrito: ser un pilar de estabilidad y amor para su familia. Es el eje, no un área más.
Esposa; hija Clarita (primer año de padre ya cumplido); hijo Julián en camino. Tiempo semanal con su madre. Su tío Hernán vive fuera de Chile.
Lo que él mismo identificó como pendiente: apoyar más proactivamente en tareas de casa que hoy recaen casi solo en su esposa — crítico con la llegada de Julián.

DINERO
Ahorra 45–50% del ingreso familiar, muy por encima de su meta del 40%. Maneja bien inversiones y finanzas; por su propia evaluación, es su frente más sólido.
Su único punto débil declarado es el GASTO: "ganamos muy bien, pero también gastamos harto". No necesita que le enseñen a ahorrar; necesita visibilidad de gasto.
Ambición: crecimiento patrimonial de largo plazo. Invierte global y en Chile, renta variable y fija.

SALUD Y CUERPO — contexto para su coach
Peso: llegó a 96,5 kg en marzo 2022, bajó a 89 ese año, y lo perdió lentamente hasta volver a 96,0 en octubre 2025. Desde entonces bajó de nuevo y hoy está cerca de 89 kg, su rango más bajo registrado.
Desde octubre 2025 está en tratamiento con semaglutida (Ozempic) 0,5 mg semanal, en dosis baja, indicado por su médico. Esto explica el descenso reciente. La pregunta abierta —y relevante para su coach— es cómo consolidar hábitos que sostengan el resultado cuando corresponda ajustar o suspender la dosis, dado que su historial muestra recuperación de peso cuando no hay un soporte activo.
Perfil metabólico muy bueno: HbA1c 5,0-5,1, HOMA-IR 1,4, insulina 6,2, triglicéridos en descenso (48 en el último control). Lp(a) 52,5 nmol/L, bajo el umbral de riesgo.
Hallazgo de diciembre 2025: hígado graso leve en ecografía (las de 2023 y 2024 fueron normales), con GOT-AST en 57 (GPT y GGT normales). Coincide con el período de mayor peso. En seguimiento con su médico.
Bradicardia sinusal estable (51-57 lpm) en los tres electrocardiogramas, consistente con actividad física regular.

PATRONES CONOCIDOS — lo más útil para aconsejarlo
· Improvisa bajo presión, y le resulta. Pero él mismo dice: "podría ser todo mejor o más fácil si planifico... a veces improviso mucho (y menos mal me resulta... pero no es lo ideal)". No hay que convencerlo de que planificar sirve; hay que bajarle la fricción.
· Es bueno en su trabajo y lo sabe. No necesita validación, necesita que le nombren lo que no ve.
· En deporte, la consistencia le gana a las hazañas. No logró triatlón, torneo de tenis ni dos maratones — y fue honesto: no se siente mal, no estaba convencido. Sostiene trote, tenis, gimnasio y ciclismo; sumó natación. Metas de competencia NO lo mueven.
· Dejó el alcohol salvo ocasiones especiales. Le cuesta la alimentación (gluten, azúcar, almidón) y mejoró recién en el último trimestre. Peso cerca de 90 kg tras haber llegado a 95. Duerme bien (~7h) pese a Clarita.
· Lectura: 8 libros en 2025 contra una meta de 10, con flojera declarada a mitad y fin de año.

MOTOR SECUNDARIO — no olvidarlo
Quiere ayudar a otros a integrar el deporte, los buenos hábitos y una mejor salud financiera en su vida, para que tengan más tiempo para su familia y aficiones. Lo sintió como lo más pendiente de 2025 y quiere que tome protagonismo. Está en su propósito escrito, junto a la familia.
También tiene pendiente idear un podcast sobre crecimiento personal, longevidad, finanzas personales y calidad de vida.

CÓMO TRATARLO
Directo, sin relleno, sin adulación. El ánimo genérico no le sirve y lo detecta. Valora que le nombren lo incómodo. Prefiere una verdad útil a una frase bonita.$p$)
  ON CONFLICT (user_id) DO UPDATE SET content = excluded.content, updated_at = now();

  -- ============================================================
  -- HÁBITOS (antes HABITS_DAILY / HABITS_WEEK)
  -- ============================================================
  INSERT INTO habits (user_id, code, name, cadence, weekly_target) VALUES
    (v_user_id, 'briefing', 'Briefing económico + lectura de diario (AM)', 'daily', null),
    (v_user_id, 'lectura', 'Lectura breve (noche)', 'daily', null),
    (v_user_id, 'deporte', 'Deporte', 'week', 3);

  -- ============================================================
  -- PESO (antes PESO_SEED, 75 mediciones)
  -- ============================================================
  INSERT INTO weight_log (user_id, recorded_on, kg) VALUES
    (v_user_id, '2022-03-14', 96.5), (v_user_id, '2022-03-28', 94.75), (v_user_id, '2022-04-04', 93.75),
    (v_user_id, '2022-04-13', 92.5), (v_user_id, '2022-04-20', 92.5), (v_user_id, '2022-04-27', 92.0),
    (v_user_id, '2022-05-20', 90.45), (v_user_id, '2022-05-30', 89.75), (v_user_id, '2022-06-10', 89.5),
    (v_user_id, '2022-06-24', 89.75), (v_user_id, '2022-07-15', 89.25), (v_user_id, '2022-08-01', 89.0),
    (v_user_id, '2022-08-10', 89.0), (v_user_id, '2022-08-24', 89.0), (v_user_id, '2022-08-31', 89.5),
    (v_user_id, '2022-09-07', 89.5), (v_user_id, '2022-09-21', 90.0), (v_user_id, '2022-09-28', 90.0),
    (v_user_id, '2022-10-05', 91.0), (v_user_id, '2022-10-26', 90.75), (v_user_id, '2022-11-09', 90.5),
    (v_user_id, '2022-11-23', 90.0), (v_user_id, '2022-11-28', 90.5), (v_user_id, '2023-01-04', 91.0),
    (v_user_id, '2023-02-15', 91.0), (v_user_id, '2023-03-05', 91.2), (v_user_id, '2023-04-03', 91.5),
    (v_user_id, '2023-05-23', 91.5), (v_user_id, '2023-06-23', 91.75), (v_user_id, '2023-07-12', 92.5),
    (v_user_id, '2023-08-02', 92.75), (v_user_id, '2023-09-06', 91.75), (v_user_id, '2023-10-06', 92.25),
    (v_user_id, '2023-10-27', 92.0), (v_user_id, '2023-11-07', 92.25), (v_user_id, '2023-11-21', 91.75),
    (v_user_id, '2023-12-13', 92.25), (v_user_id, '2024-01-05', 93.5), (v_user_id, '2024-02-01', 92.5),
    (v_user_id, '2024-03-25', 93.75), (v_user_id, '2024-04-27', 92.75), (v_user_id, '2024-05-29', 94.75),
    (v_user_id, '2024-06-13', 93.5), (v_user_id, '2024-07-15', 94.0), (v_user_id, '2024-08-01', 95.0),
    (v_user_id, '2024-09-02', 94.25), (v_user_id, '2024-10-02', 94.25), (v_user_id, '2024-10-09', 93.75),
    (v_user_id, '2024-10-16', 93.0), (v_user_id, '2024-10-31', 92.75), (v_user_id, '2024-11-15', 92.75),
    (v_user_id, '2024-12-03', 92.0), (v_user_id, '2024-12-17', 92.25), (v_user_id, '2025-01-03', 92.5),
    (v_user_id, '2025-01-14', 93.0), (v_user_id, '2025-01-31', 92.25), (v_user_id, '2025-02-14', 92.5),
    (v_user_id, '2025-03-14', 92.5), (v_user_id, '2025-04-01', 92.5), (v_user_id, '2025-05-04', 92.75),
    (v_user_id, '2025-06-13', 93.0), (v_user_id, '2025-07-16', 93.0), (v_user_id, '2025-08-06', 93.5),
    (v_user_id, '2025-09-01', 94.25), (v_user_id, '2025-10-06', 96.0), (v_user_id, '2025-11-03', 94.75),
    (v_user_id, '2025-12-10', 91.75), (v_user_id, '2026-01-20', 89.5), (v_user_id, '2026-02-13', 89.3),
    (v_user_id, '2026-03-06', 89.0), (v_user_id, '2026-04-22', 88.75), (v_user_id, '2026-05-22', 88.5),
    (v_user_id, '2026-06-28', 88.75), (v_user_id, '2026-07-20', 89.25), (v_user_id, '2026-08-20', 89.4);

  -- ============================================================
  -- EXÁMENES (antes EXAM_SEED, 3 controles)
  -- ============================================================
  INSERT INTO exam_results (user_id, taken_on, test_name, value) VALUES
    (v_user_id, '2023-05-02', 'Glicemia en ayunas', '100 mg/dL'),
    (v_user_id, '2023-05-02', 'Colesterol total', '187 mg/dL'),
    (v_user_id, '2023-05-02', 'Colesterol LDL', '115 mg/dL'),
    (v_user_id, '2023-05-02', 'Colesterol HDL', '72 mg/dL'),
    (v_user_id, '2023-05-02', 'Colesterol no HDL', '115.2 mg/dL'),
    (v_user_id, '2023-05-02', 'Triglicéridos', '59 mg/dL'),
    (v_user_id, '2023-05-02', 'Glóbulos blancos', '4.9 x10³/uL'),
    (v_user_id, '2023-05-02', 'Glóbulos rojos', '4.64 x10⁶/uL'),
    (v_user_id, '2023-05-02', 'Hemoglobina', '15.0 g/dL'),
    (v_user_id, '2023-05-02', 'Hematocrito', '44.4 %'),
    (v_user_id, '2023-05-02', 'Plaquetas', '205 x10³/uL'),
    (v_user_id, '2023-05-02', 'Transaminasas GOT-AST', '27 U/L'),
    (v_user_id, '2023-05-02', 'Transaminasas GPT-ALT', '19 U/L'),
    (v_user_id, '2023-05-02', 'GGT', '10 U/L'),
    (v_user_id, '2023-05-02', 'Creatinina', '1.14 mg/dL'),
    (v_user_id, '2023-05-02', 'Filtración glomerular (TFGe)', '74.4 mL/min'),
    (v_user_id, '2023-05-02', 'Ácido úrico', '6.1 mg/dL'),
    (v_user_id, '2023-05-02', 'Ecografía abdominal', 'Sin hallazgos patológicos'),
    (v_user_id, '2023-05-02', 'Electrocardiograma', 'Bradicardia sinusal 51 lpm'),

    (v_user_id, '2024-07-03', 'Glicemia en ayunas', '94 mg/dL'),
    (v_user_id, '2024-07-03', 'Hemoglobina glicosilada A1c', '5.0 %'),
    (v_user_id, '2024-07-03', 'Insulina en ayunas', '6.2 uU/mL'),
    (v_user_id, '2024-07-03', 'HOMA-IR', '1.4'),
    (v_user_id, '2024-07-03', 'Colesterol total', '233 mg/dL'),
    (v_user_id, '2024-07-03', 'Colesterol LDL', '142 mg/dL'),
    (v_user_id, '2024-07-03', 'Colesterol HDL', '80.3 mg/dL'),
    (v_user_id, '2024-07-03', 'Colesterol no HDL', '153.1 mg/dL'),
    (v_user_id, '2024-07-03', 'Triglicéridos', '65 mg/dL'),
    (v_user_id, '2024-07-03', 'Lipoproteína (a)', '52.5 nmol/L'),
    (v_user_id, '2024-07-03', 'Glóbulos blancos', '5.6 x10³/uL'),
    (v_user_id, '2024-07-03', 'Glóbulos rojos', '5.11 x10⁶/uL'),
    (v_user_id, '2024-07-03', 'Hemoglobina', '16.4 g/dL'),
    (v_user_id, '2024-07-03', 'Hematocrito', '49.4 %'),
    (v_user_id, '2024-07-03', 'Plaquetas', '222 x10³/uL'),
    (v_user_id, '2024-07-03', 'Transaminasas GOT-AST', '20 U/L'),
    (v_user_id, '2024-07-03', 'Transaminasas GPT-ALT', '18 U/L'),
    (v_user_id, '2024-07-03', 'GGT', '12 U/L'),
    (v_user_id, '2024-07-03', 'Creatinina', '1.17 mg/dL'),
    (v_user_id, '2024-07-03', 'Filtración glomerular (TFGe)', '>60 mL/min'),
    (v_user_id, '2024-07-03', 'Ácido úrico', '6.7 mg/dL'),
    (v_user_id, '2024-07-03', 'TSH', '2.04 uU/mL'),
    (v_user_id, '2024-07-03', 'Ferritina', '182 ng/mL'),
    (v_user_id, '2024-07-03', 'Ecografía abdominal', 'Sin hallazgos patológicos'),
    (v_user_id, '2024-07-03', 'Electrocardiograma', 'Bradicardia sinusal 53 lpm'),

    (v_user_id, '2025-12-10', 'Glicemia en ayunas', '88 mg/dL'),
    (v_user_id, '2025-12-10', 'Hemoglobina glicosilada A1c', '5.1 %'),
    (v_user_id, '2025-12-10', 'Colesterol total', '196 mg/dL'),
    (v_user_id, '2025-12-10', 'Colesterol LDL', '144 mg/dL'),
    (v_user_id, '2025-12-10', 'Colesterol HDL', '56.8 mg/dL'),
    (v_user_id, '2025-12-10', 'Colesterol no HDL', '139.2 mg/dL'),
    (v_user_id, '2025-12-10', 'Triglicéridos', '48 mg/dL'),
    (v_user_id, '2025-12-10', 'Glóbulos blancos', '5.19 x10³/uL'),
    (v_user_id, '2025-12-10', 'Glóbulos rojos', '5.15 x10⁶/uL'),
    (v_user_id, '2025-12-10', 'Hemoglobina', '16.1 g/dL'),
    (v_user_id, '2025-12-10', 'Hematocrito', '49.3 %'),
    (v_user_id, '2025-12-10', 'Plaquetas', '215 x10³/uL'),
    (v_user_id, '2025-12-10', 'Transaminasas GOT-AST', '57 U/L ↑'),
    (v_user_id, '2025-12-10', 'Transaminasas GPT-ALT', '23 U/L'),
    (v_user_id, '2025-12-10', 'GGT', '12 U/L'),
    (v_user_id, '2025-12-10', 'LDH', '205 U/L'),
    (v_user_id, '2025-12-10', 'Creatinina', '1.19 mg/dL ↑'),
    (v_user_id, '2025-12-10', 'Filtración glomerular (TFGe)', '82 mL/min'),
    (v_user_id, '2025-12-10', 'Ácido úrico', '5.7 mg/dL'),
    (v_user_id, '2025-12-10', 'Ecografía abdominal', 'Hígado graso leve'),
    (v_user_id, '2025-12-10', 'Electrocardiograma', 'Bradicardia sinusal 57 lpm');

  -- ============================================================
  -- PATRIMONIO — 14 trimestres (antes PAT_SEED)
  -- Cada trimestre: INSERT ... RETURNING id INTO v_quarter_id, luego sus
  -- totales por clase. Al terminar el bucle, v_quarter_id queda apuntando
  -- al trimestre más reciente (Q2 2026), que es donde va el detalle.
  -- ============================================================
  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2023, 'Q1') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 7228000), (v_quarter_id, 'retiro', 37382780),
    (v_quarter_id, 'inversion', 183678208), (v_quarter_id, 'inmueble', 101744500),
    (v_quarter_id, 'mueble', 26000000), (v_quarter_id, 'nocorrientes_p', 70367350);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2023, 'Q2') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 20093641), (v_quarter_id, 'retiro', 39506875),
    (v_quarter_id, 'inversion', 200524959), (v_quarter_id, 'inmueble', 103214540),
    (v_quarter_id, 'mueble', 26000000), (v_quarter_id, 'nocorrientes_p', 70590084);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2023, 'Q3') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 23983905), (v_quarter_id, 'retiro', 47719969),
    (v_quarter_id, 'inversion', 210020479), (v_quarter_id, 'inmueble', 103534860),
    (v_quarter_id, 'mueble', 26000000), (v_quarter_id, 'nocorrientes_p', 69976533);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2023, 'Q4') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 15758421), (v_quarter_id, 'retiro', 54654571),
    (v_quarter_id, 'inversion', 153676545), (v_quarter_id, 'inmueble', 381612297),
    (v_quarter_id, 'mueble', 26000000), (v_quarter_id, 'nocorrientes_p', 204951519);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2024, 'Q1') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 12456325), (v_quarter_id, 'retiro', 61807966),
    (v_quarter_id, 'inversion', 188776304), (v_quarter_id, 'inmueble', 384838300),
    (v_quarter_id, 'mueble', 25000000), (v_quarter_id, 'nocorrientes_p', 206391752);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2024, 'Q2') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 19919884), (v_quarter_id, 'retiro', 65031382),
    (v_quarter_id, 'inversion', 201253777), (v_quarter_id, 'inmueble', 389723983),
    (v_quarter_id, 'mueble', 25000000), (v_quarter_id, 'nocorrientes_p', 207579775);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2024, 'Q3') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 19528639), (v_quarter_id, 'retiro', 68856372),
    (v_quarter_id, 'inversion', 214377010), (v_quarter_id, 'inmueble', 393281922),
    (v_quarter_id, 'mueble', 25000000), (v_quarter_id, 'nocorrientes_p', 208034118);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2024, 'Q4') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 37631534), (v_quarter_id, 'retiro', 75267218),
    (v_quarter_id, 'inversion', 140629047), (v_quarter_id, 'inmueble', 773045168),
    (v_quarter_id, 'mueble', 25000000), (v_quarter_id, 'nocorrientes_p', 508320512);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2025, 'Q1') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 38801455), (v_quarter_id, 'retiro', 76203226),
    (v_quarter_id, 'inversion', 176893240), (v_quarter_id, 'inmueble', 782462732),
    (v_quarter_id, 'mueble', 26500000), (v_quarter_id, 'nocorrientes_p', 511791208);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2025, 'Q2') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 29397165), (v_quarter_id, 'retiro', 84379332),
    (v_quarter_id, 'inversion', 199081201), (v_quarter_id, 'inmueble', 790008857),
    (v_quarter_id, 'mueble', 26500000), (v_quarter_id, 'nocorrientes_p', 497450789);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2025, 'Q3') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 27541112), (v_quarter_id, 'retiro', 94384891),
    (v_quarter_id, 'inversion', 223617502), (v_quarter_id, 'inmueble', 794556655),
    (v_quarter_id, 'mueble', 26500000), (v_quarter_id, 'nocorrientes_p', 497365695);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2025, 'Q4') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 32787240), (v_quarter_id, 'retiro', 103272517),
    (v_quarter_id, 'inversion', 270741772), (v_quarter_id, 'inmueble', 816828240),
    (v_quarter_id, 'mueble', 26500000), (v_quarter_id, 'nocorrientes_p', 498389181);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2026, 'Q1') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 68211320), (v_quarter_id, 'retiro', 108659834),
    (v_quarter_id, 'inversion', 274478586), (v_quarter_id, 'inmueble', 819130960),
    (v_quarter_id, 'mueble', 25500000), (v_quarter_id, 'nocorrientes_p', 505733287);

  INSERT INTO patrimonio_quarters (user_id, year, quarter) VALUES (v_user_id, 2026, 'Q2') RETURNING id INTO v_quarter_id;
  INSERT INTO patrimonio_class_totals (quarter_id, class_code, amount) VALUES
    (v_quarter_id, 'corrientes', 132644098), (v_quarter_id, 'retiro', 119139916),
    (v_quarter_id, 'inversion', 278864623), (v_quarter_id, 'inmueble', 839033040),
    (v_quarter_id, 'mueble', 25500000), (v_quarter_id, 'nocorrientes_p', 516583583);

  -- Detalle por cuenta/propiedad del trimestre más reciente (antes PAT_DETALLE).
  -- v_quarter_id sigue apuntando a 2026 Q2, el último insertado arriba.
  INSERT INTO patrimonio_line_items (quarter_id, class_code, label, amount) VALUES
    (v_quarter_id, 'corrientes', 'Cuenta Corriente Vicente CLP', 1713908),
    (v_quarter_id, 'corrientes', 'Cuenta Corriente Dani CLP', 2849156),
    (v_quarter_id, 'corrientes', 'Cuenta Corriente Bi-Personal', 22988659),
    (v_quarter_id, 'corrientes', 'Equivalentes Efectivo (MM)', 105092375),
    (v_quarter_id, 'retiro', 'Ahorro Obligatorio Vicente', 44751869),
    (v_quarter_id, 'retiro', 'APV-A Vicente', 9113752),
    (v_quarter_id, 'retiro', 'APV-B Vicente', 13202220),
    (v_quarter_id, 'retiro', 'AFC Vicente', 8779543),
    (v_quarter_id, 'retiro', 'Ahorro Obligatorio Dani', 32168637),
    (v_quarter_id, 'retiro', 'APV-A Dani', 7299594),
    (v_quarter_id, 'retiro', 'AFC Dani', 3824301),
    (v_quarter_id, 'inversion', 'Inversiones Futalemu', 267357016),
    (v_quarter_id, 'inversion', 'Fintual Dani', 5475570),
    (v_quarter_id, 'inversion', 'Póliza Ahorro Vicente (Uni Hij@s)', 3432037),
    (v_quarter_id, 'inversion', 'Acciones Manquehue', 2600000),
    (v_quarter_id, 'inmueble', 'Inmueble Osorno', 116713740),
    (v_quarter_id, 'inmueble', 'Inmueble Augusto Leguía', 312188850),
    (v_quarter_id, 'inmueble', 'Inmueble Estocolmo', 410130450),
    (v_quarter_id, 'mueble', 'Auto', 15500000),
    (v_quarter_id, 'mueble', 'Mobiliario', 10000000),
    (v_quarter_id, 'nocorrientes_p', 'DFG Osorno', 54210268),
    (v_quarter_id, 'nocorrientes_p', 'DH Augusto Leguía', 146676524),
    (v_quarter_id, 'nocorrientes_p', 'DH Estocolmo', 315696792);

  -- ============================================================
  -- CARTERA FUTALEMU (antes const FUTALEMU)
  -- ============================================================
  INSERT INTO investments_futalemu
    (user_id, fecha, capital, caja, invertido, valor_mercado, rent_anio, rent_acum)
    VALUES (v_user_id, '2026-06-30', 125000000, 9887745, 159932672, 260832315, 0.03, 1.17)
    RETURNING id INTO v_snapshot_id;

  INSERT INTO investments_futalemu_positions
    (snapshot_id, ticker, invertido, valor_mercado, cantidad, precio_costo, precio_mercado) VALUES
    (v_snapshot_id, 'ZOFRI', 19999754, 25938000, 25938, 771.06, 1000.0),
    (v_snapshot_id, 'BICE (EX-SECURITY)', 19948395, 32580929, 86959, 229.4, 374.67),
    (v_snapshot_id, 'HABITAT', 19999742, 33043271, 25149, 795.25, 1313.9),
    (v_snapshot_id, 'ANDINA-A', 19988764, 35722980, 9892, 2020.7, 3611.3),
    (v_snapshot_id, 'LIPIGAS', 19999566, 45382200, 5277, 3789.95, 8600.0),
    (v_snapshot_id, 'NTGCLGAS', 19997813, 35938246, 59606, 335.5, 602.93),
    (v_snapshot_id, 'CHILE', 20000106, 27865110, 153105, 130.63, 182.0),
    (v_snapshot_id, 'INGEVEC', 19998531, 24361580, 122420, 163.36, 199.0);

  RAISE NOTICE 'Seed completo para user_id %', v_user_id;
END $$;
