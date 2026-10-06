interface ClaudeContentBlock {
  type: string;
  text?: string;
}

// Llama a /api/claude y devuelve el texto. Si el servidor no responde JSON
// (por ejemplo, un timeout de Vercel devuelve una página de error), lo dice
// en vez de fallar con un error de parseo sin explicación.
async function postClaude(body: Record<string, unknown>): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No hubo conexión con el servidor.");
  }
  const raw = await res.text();
  let data: { content?: ClaudeContentBlock[]; error?: string; detail?: string };
  try {
    data = JSON.parse(raw);
  } catch {
    if (res.status === 504 || /timeout|timed out/i.test(raw)) {
      throw new Error("El servidor tardó demasiado en responder (timeout).");
    }
    throw new Error(`Respuesta inesperada del servidor (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    throw new Error(data.detail ? `${data.error}: ${data.detail}` : data.error || `Error al llamar a Claude (HTTP ${res.status})`);
  }
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

// "low" para tareas mecánicas (extraer, transcribir, clasificar): menos
// tokens y más rápido. Sin indicar, el servidor usa "medium".
export type Effort = "low" | "medium" | "high";

export async function askClaude(system: string, user: string, maxTokens = 1200, effort?: Effort): Promise<string> {
  return postClaude({ system, messages: [{ role: "user", content: user }], maxTokens, effort });
}

// Variante con búsqueda web — para briefings e ideas que necesitan datos
// actuales. Cada búsqueda se cobra aparte, así que va con tope.
export async function askClaudeWeb(
  system: string,
  user: string,
  maxTokens = 2000,
  maxSearches = 5,
): Promise<string> {
  return postClaude({
    system,
    messages: [{ role: "user", content: user }],
    maxTokens,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: maxSearches }],
  });
}

// Variante para adjuntar un PDF en base64 (sin prefijo data:) — usada por la
// extracción de índices de exámenes.
export async function askClaudeWithPdf(
  system: string,
  base64Pdf: string,
  userText: string,
  maxTokens = 2000,
): Promise<string> {
  return postClaude({
    system,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
          { type: "text", text: userText },
        ],
      },
    ],
    maxTokens,
    effort: "low",
  });
}

// Variante genérica para adjuntar un PDF o una imagen en base64 (sin prefijo
// data:) — usada por Temas críticos para archivar material variado.
export async function askClaudeWithFile(
  system: string,
  base64Data: string,
  mediaType: string,
  userText: string,
  maxTokens = 2000,
): Promise<string> {
  const isPdf = mediaType === "application/pdf";
  const fileBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } };
  return postClaude({
    system,
    messages: [{ role: "user", content: [fileBlock, { type: "text", text: userText }] }],
    maxTokens,
    effort: "low",
  });
}

// UF y dólar observado del día: el servidor usa lo guardado del día, si no la
// fuente oficial gratuita, y solo como respaldo a Claude. `refresh` fuerza
// volver a consultarlos.
export async function obtenerIndicadores(fecha: string, refresh = false): Promise<{
  as_of: string;
  uf: number;
  dolar: number;
  fetched_at: string;
}> {
  const res = await fetch(`/api/indicadores?fecha=${fecha}${refresh ? "&refresh=1" : ""}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.uf) throw new Error(data?.error ?? "No se pudieron obtener los indicadores.");
  return data;
}
