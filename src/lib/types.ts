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
