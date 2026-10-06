import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5-5";

// Sin razonamiento extendido (el nivel mínimo en Sonnet 5.5): las respuestas
// del panel son cortas y con max_tokens ajustado, y el razonamiento contaría
// contra ese límite y se cobraría aparte. Solo Sonnet 5.5 acepta este valor;
// el SDK aún no lo tipa.
const THINKING = { type: "between_tools" } as unknown as Anthropic.Beta.BetaThinkingConfigParam;

type ClaudeProxyBody = {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens?: number;
  tools?: Anthropic.Beta.BetaToolUnion[];
};

// Endpoint único para las 3 modalidades que usaba el HTML original
// (askClaude, askClaudeWeb y el fetch con PDF adjunto): el cliente solo
// arma el `messages`/`tools` correcto y este endpoint agrega la API key.
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

  const { system, messages, maxTokens = 1200, tools } = body;

  if (!system || !messages) {
    return NextResponse.json(
      { error: "Falta system o messages" },
      { status: 400 },
    );
  }

  try {
    // Respaldo en el servidor: si el modelo declina por sus filtros de
    // seguridad, la API reintenta la misma consulta en otro modelo.
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      thinking: THINKING,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(tools ? { tools } : {}),
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
