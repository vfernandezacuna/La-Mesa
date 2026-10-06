import Anthropic from "@anthropic-ai/sdk";

// Solo servidor: la API key nunca llega al navegador.
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const MODEL = "claude-sonnet-5-5";

export type Effort = "low" | "medium" | "high";
export const EFFORTS: Effort[] = ["low", "medium", "high"];

// Sin razonamiento extendido (el nivel mínimo en Sonnet 5.5): las respuestas
// del panel son cortas y con max_tokens ajustado, y el razonamiento contaría
// contra ese límite y se cobraría aparte. Solo Sonnet 5.5 acepta este valor;
// el SDK aún no lo tipa.
const THINKING = { type: "between_tools" } as unknown as Anthropic.Beta.BetaThinkingConfigParam;

export function crearMensaje(params: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  maxTokens: number;
  tools?: Anthropic.Beta.BetaToolUnion[];
  effort?: Effort;
}) {
  // Respaldo en el servidor: si el modelo declina por sus filtros de
  // seguridad, la API reintenta la misma consulta en otro modelo.
  return anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: params.messages,
    thinking: THINKING,
    output_config: { effort: params.effort ?? "medium" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...(params.tools ? { tools: params.tools } : {}),
  });
}

export function textoDe(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
