import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { crearMensaje, EFFORTS, type Effort } from "@/lib/anthropic-server";

type ClaudeProxyBody = {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens?: number;
  tools?: Anthropic.Beta.BetaToolUnion[];
  effort?: Effort;
};

// Endpoint único para las llamadas a Claude del panel: el cliente arma
// `messages`/`tools` y elige el esfuerzo; este endpoint agrega la API key.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: ClaudeProxyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { system, messages, maxTokens = 1200, tools, effort } = body;

  if (!system || !messages) {
    return NextResponse.json({ error: "Falta system o messages" }, { status: 400 });
  }

  try {
    const response = await crearMensaje({
      system,
      messages,
      maxTokens: Math.min(Math.max(1, maxTokens), 8000),
      tools,
      effort: effort && EFFORTS.includes(effort) ? effort : "medium",
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        {
          error: "Claude declinó responder esta consulta",
          detail: response.stop_details?.category ?? undefined,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(response);
  } catch (err) {
    console.error("Error llamando a Claude:", err);
    const detail =
      err instanceof Anthropic.APIError
        ? `[${err.status}] ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ error: "Error al llamar a Claude", detail }, { status: 502 });
  }
}
