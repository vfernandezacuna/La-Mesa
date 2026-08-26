interface ClaudeContentBlock {
  type: string;
  text?: string;
}

export async function askClaude(system: string, user: string, maxTokens = 1200): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ? `${data.error}: ${data.detail}` : data.error || "Error al llamar a Claude");
  const blocks: ClaudeContentBlock[] = data.content ?? [];
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}
