"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { askClaude } from "@/lib/claude-client";
import { learningSystemPrompt } from "@/lib/prompts";
import type { LearningLogEntry } from "@/lib/types";

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

export default function AprendizajeView({ initialEntries }: { initialEntries: LearningLogEntry[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [topic, setTopic] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LearningLogEntry[]>(initialEntries);
  const [openId, setOpenId] = useState<string | null>(null);

  function toggleDictado() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    if (recording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recog = new SR();
    recognitionRef.current = recog;
    recog.lang = "es-CL";
    recog.continuous = true;
    recog.interimResults = true;
    const base = topic ? topic + " " : "";
    recog.onstart = () => setRecording(true);
    recog.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setTopic(base + txt);
    };
    recog.onerror = () => setRecording(false);
    recog.onend = () => setRecording(false);
    recog.start();
  }

  async function profundizar() {
    const t = topic.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const raw = await askClaude(learningSystemPrompt(), t);
      const text = raw.trim();
      setResult(text);
      const { data } = await supabase
        .from("learning_log")
        .insert({ topic: t, response_text: text })
        .select()
        .single();
      if (data) setEntries((prev) => [...prev, data as LearningLogEntry]);
      setTopic("");
    } catch {
      setError("No se pudo generar el análisis.");
    }
    setLoading(false);
  }

  return (
    <>
      <h1 className="page-title">Aprendizaje</h1>
      <div className="page-sub">
        Profundiza cualquier tema con estructura de consultora: definición, marco, aplicación y siguiente paso.
      </div>

      <div className="panel">
        <h2>Profundizar en un tema</h2>
        <div className="row">
          <div className="dilema-wrap" style={{ flex: 1, minWidth: 280 }}>
            <input
              type="text"
              placeholder="Ej: cláusulas de fuerza mayor en contratos de energía — o dicta"
              style={{ width: "100%" }}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void profundizar();
              }}
            />
            <button
              className={`mic-btn dilema-mic dilema-mic-input ${recording ? "rec" : ""}`}
              onClick={toggleDictado}
              title="Dictar"
            >
              🎙
            </button>
          </div>
          <button onClick={() => void profundizar()} disabled={loading}>
            Profundizar
          </button>
        </div>
        {loading && (
          <div className="ai-loading" style={{ display: "block" }}>
            <div className="ail-head">
              <span className="ail-spin"></span>
              <span>
                Estructurando el análisis<span className="ail-dots"></span>
              </span>
            </div>
            <div className="ail-sub">Ordenando el tema en algo accionable.</div>
          </div>
        )}
        {error && <div className="loading">{error}</div>}
        {result && <div className="response-box">{result}</div>}
      </div>

      <div className="panel">
        <h2>Historial de aprendizaje</h2>
        <div>
          {entries.length === 0 ? (
            <span className="loading">Sin registros aún.</span>
          ) : (
            [...entries].reverse().map((e) => (
              <div
                className="log-entry"
                key={e.id}
                onClick={() => setOpenId((prev) => (prev === e.id ? null : e.id))}
                style={{ cursor: e.response_text ? "pointer" : "default" }}
              >
                <div className="meta">{new Date(e.created_at).toLocaleString("es-CL")}</div>
                <strong>{e.topic}</strong>
                {openId === e.id && e.response_text && (
                  <div className="response-box" style={{ marginTop: 10 }}>
                    {e.response_text}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
