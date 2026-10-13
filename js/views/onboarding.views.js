import { redirect } from "../core/base-path.js";

/** Um só caminho: página dedicada. Evita formulário duplicado no SPA. */
export async function init() {
  redirect("/onboarding.html");
}
