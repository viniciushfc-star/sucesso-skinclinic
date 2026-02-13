/**
 * Pagamento pelo app — taxa melhor negociada em volume + ganho da operadora para a clínica.
 * Estrutura em standby: quando PAGAMENTO_APP_ENABLED = true, esta tela fica acessível
 * e pode ser ligada à API da operadora.
 */

import { PAGAMENTO_APP_ENABLED } from "../core/feature-flags.js";
import {
  PARCELAS_MAXIMAS,
  TAXA_OPERADORA_ESTIMADA_PCT,
  DESCONTO_MAXIMO_PCT,
} from "../core/pagamento-regras.js";

export async function init() {
  const container = document.getElementById("pagamentoContent");
  if (!container) return;

  if (!PAGAMENTO_APP_ENABLED) {
    container.innerHTML = `
      <div class="pagamento-standby">
        <p class="pagamento-standby-badge">Em standby</p>
        <p class="pagamento-standby-text">A funcionalidade de <strong>pagamento pelo app</strong> está implementada mas aguardando a negociação com a operadora. Quando estiver ativa, você verá aqui a opção de adesão: taxa melhor pelo volume da plataforma e participação vinda da operadora (não dos clientes).</p>
        <p class="pagamento-standby-hint">Para ativar, altere <code>PAGAMENTO_APP_ENABLED</code> para <code>true</code> em <code>js/core/feature-flags.js</code> e o card aparecerá em Configurações.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="pagamento-active">
      <p class="pagamento-intro">Aceite pagamentos com <strong>taxa negociada</strong> pelo volume da plataforma. O ganho adicional para sua clínica vem da operadora, não dos seus clientes.</p>
      <div class="pagamento-regras-standby">
        <h3>Enquanto a API da operadora não está integrada</h3>
        <p>O app usa estas regras apenas como referência (definidas em <code>js/core/pagamento-regras.js</code>). Quando a integração estiver ativa, parcelas, taxa e desconto virão da operadora.</p>
        <ul class="pagamento-regras-list">
          <li><strong>Parcelas máximas:</strong> até ${PARCELAS_MAXIMAS}x</li>
          <li><strong>Taxa operadora estimada:</strong> ${TAXA_OPERADORA_ESTIMADA_PCT}% (informativo)</li>
          <li><strong>Desconto máximo permitido:</strong> ${DESCONTO_MAXIMO_PCT}%</li>
        </ul>
      </div>
      <div class="pagamento-actions">
        <p class="pagamento-actions-hint">Solicitar adesão ou conectar conta será disponibilizado aqui após a integração com a operadora.</p>
        <button type="button" class="btn-primary" id="btnPagamentoSolicitar" disabled title="Em breve">Solicitar adesão (em breve)</button>
      </div>
    </div>
  `;
}
