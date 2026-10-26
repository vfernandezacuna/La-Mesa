import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
const errores = [];
p.on("pageerror", (e) => errores.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_CERT") && errores.push("console: " + m.text()));
await p.addInitScript(readFileSync(new URL("./mock.js", import.meta.url), "utf8"));
await p.goto("file:///home/user/La-Mesa/artifact/dist/cnx-tracker.html", { waitUntil: "load" });
await p.click("a.nav-item:has-text('Datos')");
await p.setInputFiles('input[type="file"]', "/tmp/claude-0/export-prueba.csv");
try { await p.waitForSelector("text=Listo: traje", { timeout: 8000 }); } catch { console.log((await p.innerText("#root")).slice(-400), errores); process.exit(1); }
console.log("IMPORT:", await p.textContent("text=Listo: traje"));
await p.click("a.nav-item:has-text('CNX Tracker')");
try { await p.waitForSelector("text=Lectura de estado", { timeout: 8000 }); } catch { console.log((await p.innerText("#root")).slice(0, 500), errores); process.exit(1); }
await p.fill("textarea", "Se firmó el acta con GTA");
await p.click("button:has-text('Agregar')");
await p.waitForTimeout(2500);
console.log("lectura:", (await p.locator(".lect-frase").allTextContents()).join(" | "));
await p.click("a.nav-item:has-text('Tareas')");
await p.waitForSelector("text=Las tareas que mandas", { timeout: 8000 });
console.log("tareas:", await p.locator(".task-row").count());
await p.screenshot({ path: "/tmp/claude-0/t-cnx2.png", fullPage: true });
console.log("ERRORES:", errores);
await b.close();
