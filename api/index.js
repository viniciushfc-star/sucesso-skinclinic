/**
 * Handler único para a Vercel: encaminha todas as requisições para o Express (server.js).
 * Só é usado quando o projeto é implantado na Vercel; localmente usa server.js direto.
 */

import { app, registerRoutes } from "../server.js";

const ready = registerRoutes();

export default async function handler(req, res) {
  await ready;
  return new Promise((resolve) => {
    const onEnd = () => {
      res.off("finish", onEnd);
      res.off("close", onEnd);
      resolve();
    };
    res.on("finish", onEnd);
    res.on("close", onEnd);
    app(req, res);
  });
}
