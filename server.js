/**
 * Servidor que serve o frontend estático e conecta as rotas da pasta api/.
 * Use: npm install && npm start
 * Configure as variáveis em .env (copie de .env.example).
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Webhook-Secret, X-Webhook-Transactions-Secret, X-Cron-Secret");
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
      if (!res.headersSent) res.status(500).json({ error: "Erro interno" });
    });
  };
}

/**
 * import("./arquivo.js") com string LITERAL: o bundler da Vercel inclui o arquivo
 * na função. import(path.resolve(...)) é dinâmico e as rotas somem no deploy
 * (só /api/health, definido acima, continuava respondendo).
 */
async function useApi(method, pathName, load) {
  try {
    const mod = await load();
    const handler = mod.default;
    if (handler) app[method](pathName, wrap(handler));
    else console.warn("[server] Rota sem export default:", pathName);
  } catch (e) {
    console.warn("[server] Rota não carregada:", pathName, e.message);
  }
}

let routesPromise;

async function registerRoutesOnce() {
  await useApi("post", "/api/copiloto", () => import("./routes/copiloto.js"));
  await useApi("post", "/api/preco", () => import("./routes/preco.js"));
  await useApi("post", "/api/marketing", () => import("./routes/marketing.js"));
  await useApi("post", "/api/ocr", () => import("./routes/ocr.js"));
  await useApi("post", "/api/estoque", () => import("./routes/estoque.js"));
  await useApi("post", "/api/estudo-caso-pergunta", () => import("./routes/estudo-caso-pergunta.js"));
  await useApi("post", "/api/estudo-caso-esclarecer", () => import("./routes/estudo-caso-esclarecer.js"));
  await useApi("post", "/api/discussao-caso", () => import("./routes/discussao-caso.js"));
  await useApi("post", "/api/protocolo", () => import("./routes/protocolo.js"));
  await useApi("post", "/api/pele", () => import("./routes/pele.js"));
  await useApi("post", "/api/skincare", () => import("./routes/skincare.js"));
  await useApi("post", "/api/skincare-ai", () => import("./routes/skincare.js"));
  await useApi("post", "/api/analise-pele", () => import("./routes/analise-pele.js"));
  await useApi("post", "/api/analise-pele-fotos", () => import("./routes/analise-pele-fotos.js"));
  await useApi("post", "/api/analise-pele-portal-list", () => import("./routes/analise-pele-portal-list.js"));
  await useApi("post", "/api/calendario-conteudo", () => import("./routes/calendario-conteudo.js"));
  await useApi("post", "/api/webhook-transacoes", () => import("./routes/webhook-transacoes.js"));
  await useApi("post", "/api/create-portal-session", () => import("./routes/create-portal-session.js"));
  await useApi("post", "/api/send-invite-email", () => import("./routes/send-invite-email.js"));
  await useApi("post", "/api/lembretes-auto", () => import("./routes/lembretes-auto.js"));
  await useApi("post", "/api/whatsapp-send", () => import("./routes/whatsapp-send.js"));
  await useApi("get", "/api/lembretes-auto", () => import("./routes/lembretes-auto.js"));
  await useApi("get", "/api/integracoes-status", () => import("./routes/integracoes-status.js"));
  await useApi("get", "/api/calendario-conteudo", () => import("./routes/calendario-conteudo.js"));
  await useApi("get", "/api/google-calendar/auth", () => import("./routes/google-calendar/auth.js"));
  await useApi("get", "/api/google-calendar/callback", () => import("./routes/google-calendar/callback.js"));
  await useApi("get", "/api/google-calendar/status", () => import("./routes/google-calendar/status.js"));
  await useApi("post", "/api/google-calendar/sync", () => import("./routes/google-calendar/sync.js"));
  await useApi("post", "/api/google-calendar/disconnect", () => import("./routes/google-calendar/disconnect.js"));
}

function registerRoutes() {
  if (!routesPromise) routesPromise = registerRoutesOnce();
  return routesPromise;
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

app.get("/agendar", (req, res) => res.sendFile(path.join(__dirname, "agendar.html")));
app.get("/agendar.html", (req, res) => res.sendFile(path.join(__dirname, "agendar.html")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/reset", (req, res) => res.sendFile(path.join(__dirname, "reset.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));
app.get("/dashboard.html", (req, res) => res.sendFile(path.join(__dirname, "dashboard.html")));

/** Export para uso na Vercel (api/index.js). Em ambiente local, inicia o servidor. */
export { app, registerRoutes };

if (!process.env.VERCEL) {
  registerRoutes().then(() => {
    function tryListen(port, maxTries = 6) {
      const server = app.listen(port, () => {
        console.log("Servidor rodando em http://localhost:" + port);
        console.log("Frontend: http://localhost:" + port + "/dashboard.html");
        console.log("API saúde: http://localhost:" + port + "/api/health");
        if (!process.env.OPENAI_KEY) console.warn("OPENAI_KEY não definida: Copilot, Preço, Marketing etc. podem falhar.");
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) console.warn("Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env");
        if (!process.env.SUPABASE_ANON_KEY) console.warn("SUPABASE_ANON_KEY não definida: link do portal do cliente pode falhar.");
      });
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE" && maxTries > 1) {
          console.warn("Porta " + port + " em uso, tentando " + (port + 1) + "...");
          tryListen(port + 1, maxTries - 1);
        } else {
          console.error("Erro ao iniciar servidor:", err.message);
          process.exit(1);
        }
      });
    }
    tryListen(PORT);
  });
}
