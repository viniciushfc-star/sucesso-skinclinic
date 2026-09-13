/**
 * Para clínicas — documentação/FAQ de posicionamento e suporte no app.
 * Links [data-view] são tratados pelo SPA (bindMenu com delegação).
 */

export async function init() {
  const ta = document.getElementById("indicarSkinClinicTexto");
  const texto =
    "Estou usando o SkinClinic na clínica: a cliente agenda pelo link, a gente vê margem real da maquininha e registra o que foi aplicado no procedimento. Se quiser eu te mostro. https://skinclinic-one.vercel.app";
  if (ta) ta.value = texto;
  document.getElementById("btnCopiarIndicarSkinClinic")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (_) {
      ta?.select();
    }
  });
  document.getElementById("btnWhatsIndicarSkinClinic")?.addEventListener("click", () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  });
}
