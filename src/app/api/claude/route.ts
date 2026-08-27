import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

type ClaudeProxyBody = {
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  tools?: Anthropic.Tool[];
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
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
      ...(tools ? { tools } : {}),
    });
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
