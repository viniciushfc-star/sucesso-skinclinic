/** Health da API: rotas críticas vs opcionais. Sem OCR/IA no critério de saúde. */

export const CRITICAL_API_ROUTES = [
  "/api/create-portal-session",
  "/api/lembretes-auto",
  "/api/whatsapp-send",
];

export function healthPayload(errors = []) {
  if (errors.length) {
    return {
      status: 503,
      body: { ok: false, service: "skinclinic-api", criticalRouteErrors: errors },
    };
  }
  return { status: 200, body: { ok: true, service: "skinclinic-api" } };
}
