/**
 * Servidor que serve o frontend estático e conecta as rotas da pasta api/.
 * Use: npm install && npm start
 * Configure as variáveis em .env (copie de .env.example).
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toFileUrl(p) {
  return pathToFileURL(p).href;
}
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* CORS: permitir o próprio frontend (mesma origem não precisa; útil se front rodar em outra porta) */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Webhook-Secret, X-Webhook-Transactions-Secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* Saúde da API (para o front saber se o Node está respondendo na porta certa) */
app.get("/api/health", (req, res) => res.json({ ok: true, service: "skinclinic-api" }));

/* Envolve handler async para capturar erros */
function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error("[API]", err?.message || err);
      if (!res.headersSent) res.status(500).json({ error: err?.message || "Erro interno" });
    });
  };
}

/* Carrega e registra uma rota da pasta api/ */
async function useApi(method, pathName, modulePath) {
  try {
    const fullPath = path.resolve(__dirname, modulePath);
    const mod = await import(toFileUrl(fullPath));
    const handler = mod.default;
    if (handler) app[method](pathName, wrap(handler));
  } catch (e) {
    console.warn("[server] Rota não carregada:", pathName, e.message);
    if (pathName === "/api/create-portal-session") console.warn("[server] Dica: confira .env (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY) e se o arquivo api/create-portal-session.js existe.");
  }
}

/* Rotas POST (APIs de IA e serviços) — em routes/ para Vercel Hobby (máx. 12 funções em api/) */
const postRoutes = [
  ["/api/copiloto", "./routes/copiloto.js"],
  ["/api/preco", "./routes/preco.js"],
  ["/api/marketing", "./routes/marketing.js"],
  ["/api/ocr", "./routes/ocr.js"],
  ["/api/estoque", "./routes/estoque.js"],
  ["/api/estudo-caso-pergunta", "./routes/estudo-caso-pergunta.js"],
  ["/api/estudo-caso-esclarecer", "./routes/estudo-caso-esclarecer.js"],
  ["/api/discussao-caso", "./routes/discussao-caso.js"],
  ["/api/protocolo", "./routes/protocolo.js"],
  ["/api/pele", "./routes/pele.js"],
  ["/api/skincare", "./routes/skincare.js"],
  ["/api/analise-pele", "./routes/analise-pele.js"],
  ["/api/calendario-conteudo", "./routes/calendario-conteudo.js"],
  ["/api/webhook-transacoes", "./routes/webhook-transacoes.js"],
  ["/api/create-portal-session", "./routes/create-portal-session.js"],
];

const getRoutes = [
  ["/api/calendario-conteudo", "./routes/calendario-conteudo.js"],
  ["/api/google-calendar/auth", "./routes/google-calendar/auth.js"],
  ["/api/google-calendar/callback", "./routes/google-calendar/callback.js"],
  ["/api/google-calendar/status", "./routes/google-calendar/status.js"],
];

const otherPostRoutes = [
  ["/api/google-calendar/sync", "./routes/google-calendar/sync.js"],
  ["/api/google-calendar/disconnect", "./routes/google-calendar/disconnect.js"],
];

/* Registro assíncrono das rotas */
async function registerRoutes() {
  for (const [pathName, modulePath] of postRoutes) {
    await useApi("post", pathName, modulePath);
  }
  for (const [pathName, modulePath] of getRoutes) {
    await useApi("get", pathName, modulePath);
  }
  for (const [pathName, modulePath] of otherPostRoutes) {
    await useApi("post", pathName, modulePath);
  }
  /* Frontend chama /api/skincare-ai; mesmo handler que /api/skincare */
  try {
    const fullPath = path.resolve(__dirname, "./routes/skincare.js");
    const mod = await import(toFileUrl(fullPath));
    if (mod.default) app.post("/api/skincare-ai", wrap(mod.default));
  } catch (e) {
    console.warn("[server] /api/skincare-ai não carregado:", e.message);
  }
}

/* Servir arquivos estáticos (frontend) */
app.use(express.static(__dirname, { index: false }));

/* Rewrites estilo serve.json para SPA */
app.get("/onboarding", (req, res) => res.sendFile(path.join(__dirname, "onboarding.html")));
app.get("/onboarding/*", (req, res) => res.sendFile(path.join(__dirname, "onboarding.html")));
app.get("/accept-invite", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/accept-invite/*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/select-org", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/select-org/*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));
app.get("/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));

/** Export para uso na Vercel (api/index.js). Em ambiente local, inicia o servidor. */
export { app, registerRoutes };

if (!process.env.VERCEL) {
  registerRoutes().then(() => {
    app.listen(PORT, () => {
      console.log("Servidor rodando em http://localhost:" + PORT);
      console.log("Frontend: http://localhost:" + PORT + "/dashboard.html");
      console.log("API saúde: http://localhost:" + PORT + "/api/health");
      if (!process.env.OPENAI_KEY) console.warn("OPENAI_KEY não definida: Copilot, Preço, Marketing etc. podem falhar.");
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) console.warn("Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env");
      if (!process.env.SUPABASE_ANON_KEY) console.warn("SUPABASE_ANON_KEY não definida: link do portal do cliente pode falhar.");
    });
  });
}
