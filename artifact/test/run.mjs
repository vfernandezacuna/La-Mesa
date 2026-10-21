import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const hoy = new Date().toISOString().slice(0, 10);
const filas = {
  profile: [{ id: "p1", content: "Perfil de prueba", updated_at: "2026-10-01T00:00:00Z" }],
  tasks: [
    { id: "t1", title: "Revisar contrato GTA", category: "trabajo", due_date: hoy, priority: "alta", done: false, created_on: hoy, user_id: "x" },
    { id: "t2", title: "Llamar al médico", category: "personal", due_date: null, priority: "media", done: false, created_on: hoy, user_id: "x" },
  ],
  habits: [{ id: "h1", code: "lectura", name: "Leer 20 min", cadence: "daily", weekly_target: null }, { id: "h2", code: "deporte", name: "Deporte", cadence: "week", weekly_target: 3 }],
  investments_futalemu: [{ id: "f1", fecha: "2026-09-01", capital: 100, caja: 10, invertido: 90, valor_mercado: 120, rent_anio: 0.1, rent_acum: 0.2 }],
  investments_futalemu_positions: [{ id: "fp1", snapshot_id: "f1", ticker: "HABITAT", invertido: 50, valor_mercado: 70, cantidad: 10, precio_costo: 5, precio_mercado: 7 }],
  portfolio_sources: [{ id: "ps1", portfolio_key: "futalemu", spreadsheet_id: "abc", gid: "123" }],
  critical_topics: [{ id: "c1", title: "Contratos y Reclamaciones", status_summary: null, archived: false, frentes: ["GTA", "COX"], created_at: "2026-10-01T00:00:00Z" }],
  critical_topic_entries: [{ id: "e1", topic_id: "c1", kind: "note", content_text: "Nota de prueba sobre GTA.", file_name: null, created_at: "2026-10-02T00:00:00Z" }],
};
const csv = ["t,d", ...Object.entries(filas).map(([t, f]) => `${t},"${JSON.stringify(f).replace(/"/g, '""')}"`)].join("\n");
writeFileSync("/tmp/claude-0/export-prueba.csv", csv);

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errores.push("console: " + m.text()));
await p.addInitScript(readFileSync(new URL("./mock.js", import.meta.url), "utf8"));
await p.route("**/fonts.g*", (r) => r.abort());
await p.goto("file:///home/user/La-Mesa/artifact/dist/index.html", { waitUntil: "load" });
await p.waitForTimeout(500);

// Datos: importar
await p.click("text=Datos >> nth=0");
await p.setInputFiles('input[type="file"]', "/tmp/claude-0/export-prueba.csv");
try { await p.waitForSelector("text=Listo: traje", { timeout: 8000 }); } catch { console.log("SIN LISTO. Final del texto:", (await p.innerText("#root")).slice(-500)); console.log("ERRORES:", errores); await p.screenshot({ path: "/tmp/claude-0/t-err.png" }); process.exit(1); }
console.log("IMPORT:", await p.textContent("text=Listo: traje"));
console.log("docs en store:", await p.evaluate(() => window.__store.size));
await p.screenshot({ path: "/tmp/claude-0/t-datos.png" });

// Hoy
await p.click("text=Hoy >> nth=0");
try { await p.waitForSelector("text=Tareas del día", { timeout: 8000 }); } catch { console.log("HOY NO CARGÓ:", (await p.innerText("#root")).slice(0, 700)); console.log("ERRORES:", errores); process.exit(1); }
await p.waitForTimeout(800);
await p.screenshot({ path: "/tmp/claude-0/t-hoy.png", fullPage: true });
console.log("HOY tareas visibles:", await p.locator(".task-row").count());

// captura
await p.fill(".capture-mini input", "llamar a Pedro mañana");
await p.click("#capture-btn");
await p.waitForTimeout(1200);
console.log("tras captura:", await p.locator(".task-row").count(), "| estado:", await p.textContent(".capture-hint"));

// CNX Tracker
await p.click("text=CNX Tracker >> nth=0");
await p.waitForSelector("text=Lectura de estado", { timeout: 15000 });
await p.screenshot({ path: "/tmp/claude-0/t-cnx.png", fullPage: true });
await p.fill("textarea", "Se firmó el acta con GTA");
await p.click("button:has-text('Agregar')");
await p.waitForTimeout(2500);
console.log("lectura:", (await p.locator(".lect-frase").allTextContents()).join(" | "));
for (const tab of ["Calendario", "Revisión", "Coach", "El Consejo", "Patrimonio", "Inversiones"]) {
  await p.click(`text=${tab} >> nth=0`);
  await p.waitForTimeout(1200);
  const txt = await p.innerText("#root");
  console.log(tab, txt.includes("Algo falló") || txt.includes("Cargando…") ? "PROBLEMA: " + txt.slice(0, 200) : "ok", `(${txt.length} car.)`);
}
await p.click("text=Inversiones >> nth=0");
await p.waitForTimeout(800);
await p.click("button:has-text('Actualizar') >> nth=0");
await p.waitForTimeout(2500);
console.log("SYNC:", (await p.innerText("#root")).match(/Actualizado al[^\n]*|No se pudo[^\n]*|Error[^\n]*|Falta[^\n]*/)?.[0]);
await p.screenshot({ path: "/tmp/claude-0/t-inv.png", fullPage: true });
console.log("ERRORES:", errores);
await b.close();
