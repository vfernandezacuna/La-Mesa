"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude } from "@/lib/claude-client";
import { consejoSystemPrompt } from "@/lib/prompts";
import { buildTaskContext, buildAdvisorContext, appendProfile, type PatrimonioQuarterTotals } from "@/lib/context";
import { PROFILE_DEFAULT } from "@/lib/profile-default";
import type {
  Checkin,
  CouncilResponse,
  CouncilSession,
  ExamResult,
  Habit,
  HabitLog,
  InvestmentsFutalemu,
  InvestmentsFutalemuPosition,
  Task,
  WeeklyReview,
  WeightLog,
} from "@/lib/types";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function ConsejoView({
  tasks,
  profile,
  checkins,
  habits,
  habitLogs,
  weightLog,
  examResults,
  weeklyReviews,
  initialSessions,
  learningTopics,
  cartera,
  patrimonioQuarters,
}: {
  tasks: Task[];
  profile: string;
  checkins: Checkin[];
  habits: Habit[];
  habitLogs: HabitLog[];
  weightLog: WeightLog[];
  examResults: ExamResult[];
  weeklyReviews: WeeklyReview[];
  initialSessions: CouncilSession[];
  learningTopics: string[];
  cartera: { meta: InvestmentsFutalemu; positions: InvestmentsFutalemuPosition[] } | null;
  patrimonioQuarters: PatrimonioQuarterTotals[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [dilema, setDilema] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [dilemaStatus, setDilemaStatus] = useState("Puedes escribir o dictar tu dilema.");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CouncilResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CouncilSession[]>(initialSessions);

  const [profileOpen, setProfileOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileValue, setProfileValue] = useState(profile);
  const [profileDraft, setProfileDraft] = useState(profile || PROFILE_DEFAULT);
  const [profileSaving, setProfileSaving] = useState(false);

  function toggleDictado() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setDilemaStatus("Tu navegador no soporta dictado. En iPhone/Mac usa el micrófono del teclado sobre el campo.");
      return;
    }
    if (recording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recog = new SR();
    recognitionRef.current = recog;
    recog.lang = "es-CL";
    recog.continuous = true;
    recog.interimResults = true;
    const base = dilema ? dilema + " " : "";
    recog.onstart = () => {
      setRecording(true);
      setDilemaStatus("Escuchando… habla normal y toca el micrófono para terminar.");
    };
    recog.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setDilema(base + txt);
    };
    recog.onerror = (ev) => {
      setRecording(false);
      setDilemaStatus(
        ev.error === "not-allowed"
          ? "El micrófono está bloqueado aquí. Usa el dictado del teclado."
          : `No se pudo escuchar (${ev.error}). Puedes escribir directamente.`,
      );
    };
    recog.onend = () => setRecording(false);
    recog.start();
  }

  async function convocarConsejo() {
    const texto = dilema.trim();
    if (!texto) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const user =
        texto +
        appendProfile(
          buildTaskContext(tasks) +
            buildAdvisorContext("consejo", {
              checkins,
              habits,
              habitLogs,
              weightLog,
              examResults,
              weeklyReviews,
              decisiones: sessions.map((s) => ({ dilema: s.dilema })),
              learningTopics,
              cartera,
              patrimonioQuarters,
            }),
          profileValue,
        );
      const raw = await askClaude(consejoSystemPrompt(), user, 3000);
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as CouncilResponse;
      setResult(parsed);
      const { data } = await supabase
        .from("council_sessions")
        .insert({ dilema: texto, response_json: parsed })
        .select()
        .single();
      if (data) setSessions((prev) => [...prev, data as CouncilSession]);
      setDilema("");
      setDilemaStatus("Puedes escribir o dictar tu dilema.");
    } catch {
      setError("No se pudo procesar la respuesta. Intenta nuevamente.");
    }
    setLoading(false);
  }

  function editProfile() {
    setProfileDraft(profileValue || PROFILE_DEFAULT);
    setEditingProfile(true);
  }

  async function saveProfile() {
    const content = profileDraft.trim();
    setProfileSaving(true);
    await supabase
      .from("profile")
      .upsert({ content, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setProfileValue(content);
    setProfileSaving(false);
    setEditingProfile(false);
  }

  function cancelProfile() {
    setEditingProfile(false);
  }

  function resetProfileDraft() {
    setProfileDraft(PROFILE_DEFAULT);
  }

  return (
    <>
      <h1 className="page-title">El Consejo</h1>
      <div className="page-sub">
        Plantea un dilema y siéntate con cinco voces — CEO, CLO, CIO, CCO y tu Coach — más el veredicto de tu
        coach.
      </div>

      <div className="panel">
        <h2>Convocar al consejo</h2>
        <div className="dilema-wrap">
          <textarea
            placeholder="Describe la decisión o dilema que enfrentas (contexto, opciones, lo que está en juego)... o dicta con el micrófono."
            value={dilema}
            onChange={(e) => setDilema(e.target.value)}
          />
          <button className={`mic-btn dilema-mic ${recording ? "rec" : ""}`} onClick={toggleDictado} title="Dictar">
            🎙
          </button>
        </div>
        <div className="capture-hint">{dilemaStatus}</div>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => void convocarConsejo()} disabled={loading}>
            Convocar al consejo
          </button>
        </div>
        {loading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                El consejo está deliberando<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Cinco voces analizando tu dilema.</div>
          </div>
        )}
        {error && <div className="loading">{error}</div>}
        {result && (
          <>
            <div className="table-seats">
              <div className="seat">
                <div className="role">CEO</div>
                <div className="role-sub">Decisión y organización</div>
                <p>{result.ceo}</p>
              </div>
              <div className="seat">
                <div className="role">CLO</div>
                <div className="role-sub">Riesgo y exposición</div>
                <p>{result.clo}</p>
              </div>
              <div className="seat">
                <div className="role">CIO</div>
                <div className="role-sub">Capital y patrimonio</div>
                <p>{result.cio}</p>
              </div>
              <div className="seat">
                <div className="role">CCO</div>
                <div className="role-sub">Estrategia y eficiencia</div>
                <p>{result.cco}</p>
              </div>
              <div className="seat cso">
                <div className="role">COACH</div>
                <div className="role-sub">Equilibrio y sostenibilidad</div>
                <p>{result.coachvoz}</p>
              </div>
            </div>
            <div className="coach-verdict">
              <div className="role">El cierre de tu coach</div>
              <p>{result.coach}</p>
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Historial de decisiones</h2>
        <div>
          {sessions.length === 0 ? (
            <span className="loading">Sin registros aún.</span>
          ) : (
            [...sessions].reverse().map((s) => (
              <div className="log-entry" key={s.id}>
                <div className="meta">{new Date(s.created_at).toLocaleString("es-CL")}</div>
                <strong>{s.dilema}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="prof-footer">
        <span className="prof-link" onClick={() => setProfileOpen((o) => !o)}>
          <span id="prof-caret">{profileOpen ? "▾" : "▸"}</span> Lo que tus asesores saben de ti
        </span>
        {profileOpen && (
          <div style={{ marginTop: 14 }}>
            <div className="page-sub" style={{ margin: "0 0 12px 0" }}>
              Este perfil viaja con cada consulta al Consejo, al Coach y al CIO. Corrígelo cuando algo cambie —
              mientras más fiel, mejor te aconsejan.
            </div>
            {!editingProfile ? (
              <div className="prof-text" onClick={editProfile}>
                {profileValue || PROFILE_DEFAULT}
              </div>
            ) : (
              <div>
                <textarea
                  style={{ minHeight: 320, fontSize: "0.86rem", lineHeight: 1.6 }}
                  value={profileDraft}
                  onChange={(e) => setProfileDraft(e.target.value)}
                />
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => void saveProfile()} disabled={profileSaving}>
                    Guardar perfil
                  </button>{" "}
                  <button className="ghost" onClick={cancelProfile}>
                    Cancelar
                  </button>{" "}
                  <button className="ghost" style={{ marginLeft: 6 }} onClick={resetProfileDraft}>
                    Restaurar borrador
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
