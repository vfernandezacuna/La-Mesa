export type TaskCategory = "trabajo" | "inversiones" | "personal";
export type TaskPriority = "alta" | "media" | "baja";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  category: TaskCategory;
  due_date: string | null;
  due_time: string | null;
  is_meeting: boolean;
  is_deadline: boolean;
  priority: TaskPriority;
  is_focus: boolean;
  done: boolean;
  created_on: string;
  completed_at: string | null;
  from_weekly: boolean;
  week_key: string | null;
  created_at: string;
}

export type HabitCadence = "daily" | "week";

export interface Habit {
  id: string;
  user_id: string;
  code: string;
  name: string;
  cadence: HabitCadence;
  weekly_target: number | null;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  occurred_on: string;
  meta: { tipo?: string } | null;
  created_at: string;
}

export interface WeeklyReviewSummary {
  week_key: string;
}

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_key: string;
  rango: string | null;
  review_date: string | null;
  note: string | null;
  done_count: number | null;
  pend_count: number | null;
  late_count: number | null;
  coach_conclusion: string | null;
  coach_semana: string | null;
  coach_accion: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  user_id: string;
  mood: number | null;
  note: string | null;
  created_at: string;
}

export interface WeightLog {
  id: string;
  user_id: string;
  recorded_on: string;
  kg: number;
  created_at: string;
}

export interface ExamResult {
  id: string;
  user_id: string;
  taken_on: string | null;
  test_name: string;
  value: string;
  created_at: string;
}

export interface HealthVerdict {
  id: string;
  user_id: string;
  verdict_text: string;
  signature: string | null;
  created_at: string;
}

export interface CouncilSession {
  id: string;
  user_id: string;
  dilema: string;
  response_json: CouncilResponse | null;
  created_at: string;
}

export interface CouncilResponse {
  ceo: string;
  clo: string;
  cio: string;
  cco: string;
  coachvoz: string;
  coach: string;
}

export interface LearningLogEntry {
  id: string;
  user_id: string;
  topic: string;
  response_text: string | null;
  created_at: string;
}

export type PatrimonioClassCode =
  | "corrientes"
  | "inversion"
  | "inmueble"
  | "retiro"
  | "mueble"
  | "nocorrientes_p"
  | "corrientes_p";

export interface PatrimonioQuarter {
  id: string;
  user_id: string;
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  created_at: string;
}

export interface PatrimonioClassTotal {
  quarter_id: string;
  class_code: PatrimonioClassCode;
  amount: number;
}

export interface PatrimonioLineItem {
  id: string;
  quarter_id: string;
  class_code: PatrimonioClassCode;
  label: string;
  amount: number;
}

export interface CriticalTopic {
  id: string;
  user_id: string;
  title: string;
  status_summary: string | null;
  status_updated_at: string | null;
  archived: boolean;
  created_at: string;
}

export interface CriticalTopicEntry {
  id: string;
  topic_id: string;
  user_id: string;
  kind: "note" | "material";
  content_text: string;
  file_name: string | null;
  created_at: string;
}

export type Criticidad = 1 | 2 | 3 | 4;
export type Tendencia = "mejora" | "estable" | "empeora";

export interface CriticalTopicItem {
  id: string;
  topic_id: string;
  user_id: string;
  name: string;
  descripcion: string | null;
  criticidad: Criticidad | null;
  avance: number | null;
  tendencia: Tendencia | null;
  estado: string | null;
  proximo_hito: string | null;
  proximo_hito_fecha: string | null;
  sort_order: number;
  updated_at: string | null;
  created_at: string;
}

export interface CriticalTopicItemSnapshot {
  id: string;
  item_id: string;
  user_id: string;
  criticidad: Criticidad;
  avance: number;
  tendencia: Tendencia;
  estado: string | null;
  source_entry_id: string | null;
  created_at: string;
}

export interface InvestmentAccount {
  id: string;
  user_id: string;
  name: string;
  descripcion: string | null;
  fecha: string;
  capital: number | null;
  caja: number | null;
  invertido: number | null;
  valor_mercado: number | null;
  rent_anio: number | null;
  rent_acum: number | null;
  created_at: string;
}

export interface InvestmentAccountPosition {
  id: string;
  account_id: string;
  ticker: string;
  invertido: number;
  valor_mercado: number;
  cantidad: number;
  precio_costo: number;
  precio_mercado: number;
}

export interface MarketBriefing {
  id: string;
  user_id: string;
  kind: "brief" | "news";
  input_text: string | null;
  output_text: string | null;
  output_html: string | null;
  created_at: string;
}

export interface MarketIndicatorsCache {
  user_id: string;
  as_of: string;
  uf: number;
  dolar: number;
  fetched_at: string;
}

export interface InvestmentsFutalemu {
  id: string;
  user_id: string;
  fecha: string;
  capital: number;
  caja: number;
  invertido: number;
  valor_mercado: number;
  rent_anio: number;
  rent_acum: number;
  created_at: string;
}

export interface InvestmentsFutalemuPosition {
  id: string;
  snapshot_id: string;
  ticker: string;
  invertido: number;
  valor_mercado: number;
  cantidad: number;
  precio_costo: number;
  precio_mercado: number;
}
