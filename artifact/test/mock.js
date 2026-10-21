// Simula las capacidades de claude.ai (datos guardados, sample) para probar en local.
(function () {
  const store = new Map(); // ruta -> body
  const snapOf = (id, body) => ({ id, exists: body !== undefined, data: () => body, metadata: {} });
  const db = {
    doc(path) {
      const id = path.split("/").pop();
      return {
        id, path,
        get: async () => snapOf(id, store.get(path)),
        set: async (d) => { store.set(path, JSON.parse(JSON.stringify(d))); },
        update: async (d) => { store.set(path, { ...store.get(path), ...d }); },
        delete: async () => { store.delete(path); },
      };
    },
    collection(col) {
      const docs = () => [...store.entries()].filter(([p]) => p.startsWith(col + "/") && p.split("/").length === 2).map(([p, b]) => snapOf(p.split("/")[1], b));
      return { path: col, get: async () => ({ docs: docs(), size: docs().length, empty: !docs().length }) };
    },
  };
  window.__store = store;
  window.__sampleCalls = [];
  const sample = async (input, opts) => {
    window.__sampleCalls.push(String(input).slice(0, 4000));
    const t = String(input);
    let text = "Respuesta de prueba.";
    if (t.includes("motor de captura")) text = '[{"title":"Llamar a Pedro","date":null,"time":null,"category":"trabajo","isMeeting":false,"isDeadline":false,"priority":"media"}]';
    else if (t.includes("LECTURA DE ESTADO")) text = "EN UNA FRASE: Lectura de prueba generada por Claude.\nSITUACIÓN ACTUAL:\nTexto de situación de prueba.\nQUÉ CAMBIÓ:\nPrimera lectura de este tema.";
    else if (t.includes("captura de tareas")) text = "[]";
    return { text, truncated: false };
  };
  sample.limits = async () => ({ images: true });
  const FILAS_FUT = [["Portafolio Accionario"],["Acciones Chile","5/10/2026","","Rentabilidad 2026"],["","","","14%"],["Capital","$125.000.000","","Rentabilidad IGPA"],["Caja","$56.279.085","",""],["(Capital + Dividendos) Invertido","$128.696.720","","Rentabilidad IPSA"],["Valor Mercado Portafolio","$243.148.418","",""],["Valor Mercado Portafolio + Caja","$299.427.503"],["Rentabilidad Portafolio","14,25%","139,54%"],[],["Empresa","Inversión","Valor Mercado","Upside/Downside"],["HABITAT","$22.499.772","$38.577.933","$16.078.161"],["TOTAL","$22.499.772","$38.577.933","$1"],[],["Empresa","Cantidad","Precio Compra","Precio Mercado"],["HABITAT","1000","22","38"]];
  const mcp = { callTool: async (server, tool) => tool === "get_spreadsheet" ? { payload: { sheets: [{ properties: { sheetId: 123, title: "Actual" } }] } } : { payload: { values: FILAS_FUT } } };
  const caps = { db, sample, user: { isOwner: () => true, canEdit: () => true, can: () => true, id: async () => "u1" }, downloads: { save: async () => {} }, mcp };
  window.claude = { use: async (n) => caps[n] ?? null };
})();
