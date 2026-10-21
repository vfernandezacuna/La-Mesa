// Compila el panel completo en un solo archivo HTML (artifact/dist/index.html).
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, "..");
const sh = (f) => resolve(aqui, "shims", f);

const alias = {
  "@/lib/supabase/client": sh("supabase.ts"),
  "@/lib/supabase/server": sh("supabase.ts"),
  "@/lib/claude-client": sh("claude-client.ts"),
  "@/components/AppShell": sh("AppShell.tsx"),
  "@/app/login/actions": sh("login-actions.ts"),
  "@/lib/google-sheets": sh("google-sheets.ts"),
  "next/server": sh("next-server.ts"),
  "next/link": sh("next-link.tsx"),
  "next/navigation": sh("next-navigation.ts"),
};

const plugin = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^(@\/|next\/)/ }, (args) => {
      if (alias[args.path]) return { path: alias[args.path] };
      if (args.path.startsWith("@/")) {
        const base = resolve(raiz, "src", args.path.slice(2));
        for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
          try {
            readFileSync(base + ext);
            return { path: base + ext };
          } catch {
            // probar la siguiente extensión
          }
        }
      }
      return undefined;
    });
  },
};

const js = await build({
  entryPoints: [resolve(aqui, "main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  target: "es2020",
  jsx: "automatic",
  platform: "browser",
  plugins: [plugin],
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { buffer: resolve(raiz, "node_modules/buffer/"), string_decoder: resolve(raiz, "node_modules/string_decoder/") },
  loader: { ".json": "json" },
  logLevel: "warning",
});

let css = readFileSync(resolve(raiz, "src/app/globals.css"), "utf8").replace(/@import "tailwindcss";?/, "");
css = `
:root{--font-inter:'Inter';--font-jetbrains-mono:'JetBrains Mono';--font-fraunces:'Fraunces';color-scheme:light}
${css}
.sidebar-footer input{width:100%}
`;

const codigo = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<title>La Mesa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${codigo}</script>
`;
mkdirSync(resolve(aqui, "dist"), { recursive: true });
writeFileSync(resolve(aqui, "dist/index.html"), html);
console.log("index.html:", (html.length / 1048576).toFixed(2), "MB");
