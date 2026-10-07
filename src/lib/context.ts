import { daysUntil, todayStr, thisWeekKey } from "./date";
import { catLabel } from "./tasks";
import { habitStreak } from "./habits";
import { PROFILE_DEFAULT } from "./profile-default";
import type {
  Checkin,
  CriticalTopicEntry,
  Habit,
  HabitLog,
  InvestmentAccount,
  InvestmentAccountPosition,
  InvestmentsFutalemu,
  InvestmentsFutalemuPosition,
  PatrimonioClassCode,
  Task,
  TaskCategory,
  WeeklyReview,
  WeightLog,
  ExamResult,
} from "./types";

export function buildTaskContext(tasks: Task[]): string {
  const active = tasks.filter((t) => !t.done);
  const late = active.filter((t) => t.due_date && (daysUntil(t.due_date) ?? 0) < 0);
  const L: string[] = [];

  L.push(
    `Tareas activas: ${active.length}${late.length ? `, de las cuales ${late.length} están atrasadas` : ""}.`,
  );
  L.push("No tiene foco definido para hoy.");

  const byCat: Partial<Record<TaskCategory, number>> = {};
  active.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + 1;
  });
  const cats = Object.entries(byCat).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  if (cats.length) {
    L.push(
      `Carga por área: ${cats.map(([c, n]) => `${catLabel[c as TaskCategory] || c} ${n}`).join(", ")}.`,
    );
  }

  const today = todayStr();
  const ageOf = (t: Task) =>
    Math.round(
      (new Date(today + "T00:00:00").getTime() - new Date(t.created_on + "T00:00:00").getTime()) /
        86400000,
    );
  const stale = active.filter((t) => t.created_on && ageOf(t) >= 7).map((t) => `"${t.title}" (${ageOf(t)} días sin cerrar)`);
  if (stale.length) {
    L.push(
      `LLEVA POSTERGANDO: ${stale.slice(0, 5).join("; ")}. Esto es señal — vale la pena que alguien se lo diga.`,
    );
  }

  return "\n\n" + L.join("\n");
}

export function appendProfile(context: string, profile: string): string {
  return `${context}\n\n--- QUIÉN ES ÉL (perfil permanente) ---\n${profile || PROFILE_DEFAULT}\n--- FIN DEL PERFIL ---`;
}

// Contexto de hábitos, deporte, peso y exámenes — usado por los prompts de Coach
// (check-in semanal y sentencia de salud).
export function buildHealthContext(
  habits: Habit[],
  habitLogs: HabitLog[],
  weightLog: WeightLog[],
  examResults: ExamResult[],
): string {
  const L: string[] = [];
  const today = todayStr();
  const weekStart = thisWeekKey();

  const daily = habits.filter((h) => h.cadence === "daily");
  const weekly = habits.filter((h) => h.cadence === "week");

  if (daily.length) {
    const lines = daily.map((h) => {
      const dates = habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.occurred_on);
      const done = dates.includes(today);
      return `${h.name}: ${done ? "cumplido hoy" : "no cumplido hoy"} (${dates.length} veces en total)`;
    });
    L.push(`Hábitos diarios:\n${lines.join("\n")}`);
  }
  if (weekly.length) {
    const lines = weekly.map((h) => {
      const count = habitLogs.filter((l) => l.habit_id === h.id && l.occurred_on >= weekStart).length;
      return `${h.name}: ${count} de ${h.weekly_target ?? 0} esta semana`;
    });
    L.push(`Hábitos semanales:\n${lines.join("\n")}`);
  }

  if (weightLog.length) {
    const sorted = [...weightLog].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
    L.push(
      `SERIE DE PESO (${sorted.length} mediciones):\n${sorted.map((p) => `${p.recorded_on}: ${p.kg}`).join(" · ")}`,
    );
  } else {
    L.push("Sin registro de peso.");
  }

  if (examResults.length) {
    const porFecha: Record<string, ExamResult[]> = {};
    examResults.forEach((e) => {
      const f = e.taken_on ?? "sin-fecha";
      (porFecha[f] ??= []).push(e);
    });
    const ex = Object.keys(porFecha)
      .sort()
      .map((f) => `[Control ${f}] ${porFecha[f].map((e) => `${e.test_name}: ${e.value}`).join(" ; ")}`)
      .join("\n");
    L.push(`EXÁMENES:\n${ex}`);
  } else {
    L.push("Sin exámenes.");
  }

  return "\n\n" + L.join("\n\n");
}

// ---------- Carteras de inversión (Futalemu, Cartera Personal, futuras —
// usado por El Consejo / futuro CIO) ----------
export interface CarteraMetaTexto {
  fecha: string;
  caja: number;
  capital: number;
  rent_acum: number;
}
export interface CarteraPosicionTexto {
  ticker: string;
  valor_mercado: number;
  invertido: number;
}

export function carteraTexto(
  nombre: string,
  descripcion: string,
  meta: CarteraMetaTexto,
  positions: CarteraPosicionTexto[],
  detalle: boolean,
  notaFinal?: string,
): string {
  const totVM = positions.reduce((s, p) => s + p.valor_mercado, 0);
  const lista = [...positions]
    .sort((a, b) => b.valor_mercado - a.valor_mercado)
    .map((p) => {
      const pct = Math.round((p.valor_mercado / totVM) * 100);
      const ret = ((p.valor_mercado / p.invertido - 1) * 100).toFixed(0);
      return detalle
        ? `${p.ticker} ${pct}% (invertido $${p.invertido.toLocaleString("es-CL")}, valor $${p.valor_mercado.toLocaleString("es-CL")}, ${Number(ret) >= 0 ? "+" : ""}${ret}%)`
        : `${p.ticker} ${pct}%`;
    })
    .join(", ");
  const base = `${nombre}${descripcion ? ` (${descripcion})` : ""} al ${meta.fecha}: ${lista}. Valor de mercado $${totVM.toLocaleString("es-CL")} más caja $${meta.caja.toLocaleString("es-CL")}. Capital aportado $${meta.capital.toLocaleString("es-CL")}; retorno acumulado +${Math.round(meta.rent_acum * 100)}%.`;
  return notaFinal ? `${base} ${notaFinal}` : base;
}

export const FUTALEMU_DESCRIPCION = "sociedad de inversión, acciones chilenas";
export const FUTALEMU_NOTA =
  "IMPORTANTE: esta es SOLO la cartera accionaria de Futalemu; sus fondos mutuos, APV y demás activos están en el patrimonio, no aquí.";

// Arma la lista de carteras (Futalemu + cualquier cuenta de inversión
// nombrada) para pasarle a buildAdvisorContext — comparten esta función
// las páginas de Consejo, Patrimonio e Inversiones.
export function buildCarteraEntries(
  futalemu: { meta: InvestmentsFutalemu; positions: InvestmentsFutalemuPosition[] } | null,
  accounts: { account: InvestmentAccount; positions: InvestmentAccountPosition[] }[],
): CarteraContextEntry[] {
  const entries: CarteraContextEntry[] = [];
  if (futalemu) {
    entries.push({
      nombre: "Cartera Inversiones Futalemu",
      descripcion: FUTALEMU_DESCRIPCION,
      meta: futalemu.meta,
      positions: futalemu.positions,
      notaFinal: FUTALEMU_NOTA,
    });
  }
  accounts.forEach(({ account, positions }) => {
    entries.push({
      nombre: account.name,
      descripcion: account.descripcion ?? "",
      meta: {
        fecha: account.fecha,
        caja: account.caja ?? 0,
        capital: account.capital ?? 0,
        rent_acum: account.rent_acum ?? 0,
      },
      positions,
    });
  });
  return entries;
}

const PATRIMONIO_CLASES_ACTIVO: PatrimonioClassCode[] = [
  "corrientes",
  "inversion",
  "inmueble",
  "retiro",
  "mueble",
];
const PATRIMONIO_CLASES_PASIVO: PatrimonioClassCode[] = ["nocorrientes_p"];

export interface PatrimonioQuarterTotals {
  year: number;
  quarter: string;
  totals: Partial<Record<PatrimonioClassCode, number>>;
}

function patrimonioNeto(q: PatrimonioQuarterTotals): { ta: number; td: number } {
  const ta = PATRIMONIO_CLASES_ACTIVO.reduce((s, c) => s + (q.totals[c] ?? 0), 0);
  const td = PATRIMONIO_CLASES_PASIVO.reduce((s, c) => s + (q.totals[c] ?? 0), 0);
  return { ta, td };
}

// Análisis patrimonial trimestral — composición, capacidad de inversión,
// ratios y variación QoQ / 4 trimestres (usado por El Consejo / futuro CIO).
export function buildPatrimonioContext(quarters: PatrimonioQuarterTotals[]): string {
  if (!quarters.length) return "";
  const M = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
  const last = quarters[quarters.length - 1];
  const { ta, td } = patrimonioNeto(last);
  const liquido = last.totals.corrientes ?? 0;
  const semiliq = last.totals.inversion ?? 0;
  const inmov = (last.totals.inmueble ?? 0) + (last.totals.mueble ?? 0) + (last.totals.retiro ?? 0);

  let linea = `PATRIMONIO al cierre de ${last.quarter} ${last.year}: neto ${M(ta - td)} (activos ${M(ta)}, pasivos ${M(td)}).`;
  linea += `\nComposición: caja y equivalentes ${M(liquido)} (${Math.round((liquido / ta) * 100)}%), inversiones financieras ${M(semiliq)} (${Math.round((semiliq / ta) * 100)}%), inmovilizado —inmuebles, vehículos y fondos de retiro— ${M(inmov)} (${Math.round((inmov / ta) * 100)}%).`;
  linea += `\nCAPACIDAD DE INVERSIÓN: dispone de aproximadamente ${M(liquido + semiliq)} entre caja e inversiones financieras convertibles. Sus inversiones financieras están en una sociedad de inversión que opera renta variable vía corredora, o sea son líquidas en días, no inmovilizadas. Dimensiona cualquier idea o movimiento a esa escala; no le propongas cosas fuera de su alcance ni por debajo de su nivel.`;
  if (td > 0) {
    linea += `\nRatios: deuda/patrimonio ${(td / (ta - td)).toFixed(2)}, solvencia ${(ta / td).toFixed(1)}. Tiene créditos hipotecarios vigentes, lo que implica un compromiso mensual fijo relevante.`;
  }
  if (quarters.length > 1) {
    const prev = quarters[quarters.length - 2];
    const { ta: pa, td: pd } = patrimonioNeto(prev);
    const d = ta - td - (pa - pd);
    linea += `\nVariación vs. ${prev.quarter} ${prev.year}: ${d >= 0 ? "+" : ""}${M(d)}.`;
    if (quarters.length >= 5) {
      const hace4 = quarters[quarters.length - 5];
      const { ta: ha4, td: hd4 } = patrimonioNeto(hace4);
      const ha = ha4 - hd4;
      const pctChange = ((ta - td) / ha - 1) * 100;
      linea += ` En los últimos 4 trimestres: ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}%.`;
    }
  }
  return linea + `\nSu meta de fondo: transitar de ejecutivo a empresario independiente en ~10 años, para lo cual necesitará capital líquido disponible.`;
}

export interface CarteraContextEntry {
  nombre: string;
  descripcion: string;
  meta: CarteraMetaTexto;
  positions: CarteraPosicionTexto[];
  notaFinal?: string;
}

export interface AdvisorContextData {
  checkins?: Checkin[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  weightLog?: WeightLog[];
  examResults?: ExamResult[];
  weeklyReviews: WeeklyReview[];
  decisiones?: { dilema: string }[];
  learningTopics?: string[];
  carteras?: CarteraContextEntry[];
  patrimonioQuarters?: PatrimonioQuarterTotals[];
}

// Expediente compartido por Coach, El Consejo y el CIO (Patrimonio/Inversiones):
// hábitos con racha, peso con tendencia y comparación anual, evolución de
// exámenes, cierres semanales — y, para Consejo/CIO, cartera y patrimonio;
// solo para Consejo, decisiones y aprendizaje. Se combina con
// buildTaskContext(tasks) para el expediente completo.
export function buildAdvisorContext(scope: "coach" | "consejo" | "cio", data: AdvisorContextData): string {
  const L: string[] = [];
  const today = todayStr();
  const weekStart = thisWeekKey();

  if (scope === "consejo" || scope === "cio") {
    (data.carteras ?? []).forEach((c) => {
      L.push(carteraTexto(c.nombre, c.descripcion, c.meta, c.positions, true, c.notaFinal));
    });
    if (data.patrimonioQuarters?.length) L.push(buildPatrimonioContext(data.patrimonioQuarters));
  }

  if (scope === "cio") {
    const lastRev = data.weeklyReviews.slice(-2);
    if (lastRev.length) {
      L.push(
        `Sus últimos cierres semanales: ${lastRev
          .map(
            (r) =>
              `${r.rango || r.review_date}: "${r.note}"${r.done_count != null ? ` [${r.done_count} cerradas, ${r.late_count} atrasadas]` : ""}`,
          )
          .join(" ; ")}.`,
      );
    }
    return "\n\n" + L.join("\n");
  }

  const recentCheckins = (data.checkins ?? []).slice(-5);
  if (recentCheckins.length) {
    L.push(
      `Sus últimos check-ins de energía: ${recentCheckins
        .map(
          (c) =>
            `${new Date(c.created_at).toLocaleDateString("es-CL")} → ${c.mood ?? "-"}/5${c.note ? ` ("${c.note.slice(0, 60)}")` : ""}`,
        )
        .join(" ; ")}.`,
    );
    const moods = recentCheckins.map((c) => c.mood).filter((n): n is number => n != null);
    if (moods.length >= 3) {
      const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
      if (avg <= 2.5) {
        L.push(`ALERTA: su energía viene baja de forma sostenida (promedio ${avg.toFixed(1)}/5). No lo pases por alto.`);
      }
    }
  }

  const habits = data.habits ?? [];
  const habitLogs = data.habitLogs ?? [];
  const weightLog = data.weightLog ?? [];
  const examResults = data.examResults ?? [];

  const hb: string[] = [];
  habits
    .filter((h) => h.cadence === "daily")
    .forEach((h) => {
      const dates = habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.occurred_on);
      const st = habitStreak(dates, today);
      const hoyHecho = dates.includes(today);
      hb.push(`${h.name}: ${hoyHecho ? "hecho hoy" : "aún no hoy"}, racha ${st}`);
    });
  habits
    .filter((h) => h.cadence === "week")
    .forEach((h) => {
      const thisWeek = habitLogs.filter((l) => l.habit_id === h.id && l.occurred_on >= weekStart);
      const tipos = thisWeek.map((l) => l.meta?.tipo || "sesión");
      hb.push(`${h.name}: ${thisWeek.length} de ${h.weekly_target ?? 0} esta semana${tipos.length ? ` (${tipos.join(", ")})` : ""}`);
    });
  if (hb.length) {
    L.push(`Estado de sus hábitos innegociables: ${hb.join(" ; ")}. Si viene fallando alguno, menciónalo con delicadeza, como quien lo acompaña; si viene cumpliendo, reconócelo.`);
  }

  if (weightLog.length) {
    const sorted = [...weightLog].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
    const last = sorted[sorted.length - 1];
    const min = sorted.reduce((a, b) => (b.kg < a.kg ? b : a));
    const max = sorted.reduce((a, b) => (b.kg > a.kg ? b : a));
    let l = `PESO: hoy ${last.kg} kg (medición del ${last.recorded_on}). Serie de ${sorted.length} mediciones desde ${sorted[0].recorded_on}.`;
    const obj = new Date(last.recorded_on + "T00:00:00");
    obj.setFullYear(obj.getFullYear() - 1);
    const os = obj.toISOString().slice(0, 10);
    let ref: WeightLog | null = null;
    sorted.forEach((p) => {
      if (p.recorded_on <= os && (!ref || p.recorded_on > ref.recorded_on)) ref = p;
    });
    if (ref) {
      const r = ref as WeightLog;
      l += ` Hace un año pesaba ${r.kg} kg (${last.kg - r.kg >= 0 ? "+" : ""}${(last.kg - r.kg).toFixed(1)} kg).`;
    }
    l += ` Rango histórico: mínimo ${min.kg} kg (${min.recorded_on}), máximo ${max.kg} kg (${max.recorded_on}).`;
    const porAno: Record<string, WeightLog> = {};
    sorted.forEach((p) => {
      porAno[p.recorded_on.slice(0, 4)] = p;
    });
    const cierres = Object.keys(porAno)
      .sort()
      .map((a) => `${a}: ${porAno[a].kg}`)
      .join(" → ");
    l += ` Última medición de cada año: ${cierres}.`;
    l += ` Mediciones recientes: ${sorted.slice(-6).map((p) => `${p.recorded_on} ${p.kg}`).join(" · ")}.`;
    L.push(l);
  }

  if (examResults.length) {
    const porFecha: Record<string, ExamResult[]> = {};
    examResults.forEach((e) => {
      const f = e.taken_on ?? "sin-fecha";
      (porFecha[f] ??= []).push(e);
    });
    const fechas = Object.keys(porFecha)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 4);
    const bloques = fechas.map(
      (f) => `[Control del ${f}] ${porFecha[f].map((e) => `${e.test_name}: ${e.value}`).join(" ; ")}`,
    );
    L.push(
      `EXÁMENES DE SALUD (más reciente primero):\n${bloques.join("\n")}\n\nLee estos datos con criterio de longevidad y prevención: compara entre controles, detecta TENDENCIAS (un valor que sube consistentemente, uno que se deterioró de golpe) y conecta con lo que sabes de su peso, sus hábitos y su deporte. Si ves algo que conviene mirar, coméntalo con cuidado y dile claramente que lo converse con su médico. NO diagnostiques, no indiques tratamientos ni exámenes: eso le corresponde a su doctor.`,
    );
  }

  const lastRev = data.weeklyReviews.slice(-2);
  if (lastRev.length) {
    L.push(
      `Sus últimos cierres semanales: ${lastRev
        .map(
          (r) =>
            `${r.rango || r.review_date}: "${r.note}"${r.done_count != null ? ` [${r.done_count} cerradas, ${r.late_count} atrasadas]` : ""}`,
        )
        .join(" ; ")}.`,
    );
  }

  if (scope === "consejo") {
    const lastDec = (data.decisiones ?? []).slice(-3);
    if (lastDec.length) {
      L.push(`Dilemas que ya te ha traído antes: ${lastDec.map((d) => `"${d.dilema.slice(0, 80)}"`).join(" ; ")}. Si esto se conecta con alguno, dilo.`);
    }
    const lastLearn = (data.learningTopics ?? []).slice(-3);
    if (lastLearn.length) {
      L.push(`Temas que ha estado estudiando: ${lastLearn.join(", ")}.`);
    }
  }

  return "\n\n" + L.join("\n");
}

// ---------- Temas críticos ----------
// Arma el historial cronológico de un tema para pedirle a la IA una lectura
// de estado o para extraer tareas de la entrada más reciente.
// Tope de lo que se manda a Claude por tema: el historial crece con cada nota
// y se reenvía completo en cada llamada. Con más entradas que el tope, se
// mandan las más recientes y la lectura de estado anterior resume el resto.
const HISTORIAL_MAX_ENTRADAS = 12;
const ENTRADA_MAX_CARACTERES = 6000;

export function buildCriticalTopicContext(
  title: string,
  entries: CriticalTopicEntry[],
  lecturaPrevia?: string | null,
  frentes?: string[] | null,
): string {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const omitidas = Math.max(0, sorted.length - HISTORIAL_MAX_ENTRADAS);
  const recientes = sorted.slice(omitidas);
  const lines = recientes.map((e) => {
    const fecha = new Date(e.created_at).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const etiqueta = e.kind === "material" ? `Material${e.file_name ? ` (${e.file_name})` : ""}` : "Nota";
    const texto =
      e.content_text.length > ENTRADA_MAX_CARACTERES
        ? `${e.content_text.slice(0, ENTRADA_MAX_CARACTERES)}\n[…recortado]`
        : e.content_text;
    return `[${fecha} · ${etiqueta}]\n${texto}`;
  });
  // La lectura anterior se manda siempre: sirve para comparar avance y detectar
  // estancamiento, y resume las entradas antiguas que se omiten.
  const previa = lecturaPrevia
    ? `\n\n--- LECTURA DE ESTADO ANTERIOR (para comparar avance y detectar estancamiento${
        omitidas > 0 ? `; también resume las ${omitidas} entradas más antiguas que se omiten del historial` : ""
      }) ---\n${lecturaPrevia}\n--- FIN DE LA LECTURA ANTERIOR ---`
    : omitidas > 0
      ? `\n\n(Se omiten las ${omitidas} entradas más antiguas del historial.)`
      : "";
  const listaFrentes = frentes?.length
    ? `\n\nFRENTES A REPORTAR (en este orden): ${frentes.join(" | ")}`
    : "";
  return `Tema: ${title}${listaFrentes}${previa}\n\n--- HISTORIAL RECIENTE (orden cronológico) ---\n${lines.join("\n\n")}\n--- FIN DEL HISTORIAL ---`;
}
