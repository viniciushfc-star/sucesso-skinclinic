/**
 * Documentos jurídicos da organização (termos, contratos, LGPD).
 * Modelos profissionais para respaldo até revisão por advogado especializado.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

/** Ordem e labels dos documentos. */
export const DOC_KEYS = {
  contrato_servicos: "1. Contrato de Prestação de Serviços Estéticos",
  termo_consentimento_informado: "2. Termo de Consentimento Informado",
  autorizacao_uso_imagem: "3. Autorização de Uso de Imagem",
  termo_pos_procedimento: "4. Termo de Orientações Pós-Procedimento",
  termo_privacidade_lgpd: "5. Termo de Privacidade e Tratamento de Dados (LGPD)",
  politica_cancelamento: "6. Política de Cancelamento e Remarcação",
  anamnese_referencia: "7. Referência: Anamnese e Ficha Clínica",
};

/**
 * Modelos profissionais. Use os placeholders entre colchetes; o sistema substitui [NOME_DA_CLINICA], [CNPJ], etc. pelo cadastro da empresa.
 * Revisar com advogado especializado em direito da saúde/estética antes de uso em produção.
 */
export const DOC_DEFAULTS = {
  contrato_servicos: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ESTÉTICOS

CONTRATADA (CLÍNICA): [NOME_DA_CLINICA], CNPJ [CNPJ], situada em [ENDERECO], CEP [CEP], doravante denominada CLÍNICA.

CONTRATANTE (CLIENTE): _________________________________, CPF _____________, RG _____________, endereço _____________________________.

1. OBJETO
A CLÍNICA prestará ao CONTRATANTE os serviços estéticos descritos no(s) procedimento(s): _____________________________________________, conforme cronograma de sessões descrito em anexo ou combinado no momento da execução.

2. PREÇO E FORMA DE PAGAMENTO
Valor total: R$ __________ em _____ parcela(s). Forma de pagamento: _________________________________________________________.

3. SESSÕES / CRONOGRAMA
Número de sessões previstas: _____. O cronograma poderá ser ajustado conforme avaliação profissional e disponibilidade de ambas as partes.

4. DEVERES E RESPONSABILIDADES
4.1. O CONTRATANTE declara ter informado corretamente seu histórico de saúde, alergias, medicações e condições que possam influir nos procedimentos.
4.2. O CONTRATANTE compromete-se a seguir as orientações pré e pós-procedimento fornecidas pela CLÍNICA.
4.3. A CLÍNICA realizará os serviços com diligência e boas práticas, sem garantir resultados estéticos específicos, que dependem de fatores individuais.
4.4. O vínculo é de prestação de serviços (art. 593 e ss. do Código Civil); não há vínculo empregatício entre o CONTRATANTE e profissionais da CLÍNICA.

5. RISCOS E CONSENTIMENTO
Os riscos inerentes aos procedimentos, contraindicações e cuidados serão informados por meio do Termo de Consentimento Informado específico, que o CONTRATANTE se obriga a assinar antes de cada procedimento.

6. POLÍTICA DE CANCELAMENTO E REMARCAÇÃO
Aplicam-se as regras descritas na Política de Cancelamento e Remarcação (Anexo ou documento em separado), da qual o CONTRATANTE declara ter ciência.

7. ACEITAÇÃO
O CONTRATANTE declara ter lido, compreendido e aceito as cláusulas acima de forma livre e voluntária.

________________________, ____ de ______________ de ______

_________________________ (CLÍNICA)          _________________________ (CLIENTE)`,

  termo_consentimento_informado: `TERMO DE CONSENTIMENTO INFORMADO

Eu, ___________________________________________, CPF _________________________, declaro que fui informado(a) pela [NOME_DA_CLINICA] sobre:

PROCEDIMENTO: _________________________________________________________________________

O QUE SERÁ FEITO: Descrição detalhada dos passos do procedimento, técnica utilizada e duração estimada.

RISCOS POSSÍVEIS E EFEITOS COLATERAIS: _________________________________________________________________
________________________________________________________________________________________________________

ALTERNATIVAS DE TRATAMENTO: Quando aplicável, foram-me apresentadas as opções disponíveis e a justificativa da indicação.

DECLARAÇÃO DE COMPREENSÃO:
• Estou ciente de que resultados não são garantidos e variam conforme biotipo, condições de saúde, adesão às orientações e fatores individuais.
• Tive oportunidade de esclarecer dúvidas e posso retirar meu consentimento a qualquer momento.
• Autorizo a realização do procedimento nas condições informadas.

Assinatura do Cliente: ______________________________    Data: ____/____/______`,

  autorizacao_uso_imagem: `TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM

Eu, ___________________________________________, CPF _________________________, autorizo a [NOME_DA_CLINICA], situada em [ENDERECO], a utilizar minhas imagens (fotos e/ou vídeos) para os fins abaixo:

□ Divulgação institucional: site, redes sociais (Instagram, Facebook, etc.), portfólio, material promocional
□ Apenas registro em prontuário e acompanhamento do tratamento (sem divulgação pública)

Quando autorizada a divulgação:
• Plataformas onde as imagens poderão ser utilizadas: _______________________________________________
• Prazo de uso: _____ meses/anos, ou até revogação por escrito
□ Posso solicitar anonimato (imagens sem identificação direta)

Declaro que a autorização é livre, voluntária e informada. Poderei revogá-la a qualquer tempo, por escrito, sem prejuízo dos usos já realizados de forma lícita.

Assinatura do Cliente: ______________________________    Data: ____/____/______`,

  termo_pos_procedimento: `TERMO DE ORIENTAÇÕES PÓS-PROCEDIMENTO

PROCEDIMENTO REALIZADO: _________________________________________ em ____/____/______

RECOMENDAÇÕES:
• ________________________________________________________________________________________________
• ________________________________________________________________________________________________
• ________________________________________________________________________________________________

SINAIS DE ALERTA — Em caso de dor intensa, inchaço excessivo, sinais de infecção, sangramento ou qualquer alteração preocupante, entre em contato imediatamente:

[NOME_DA_CLINICA] — Telefone: [TELEFONE] ou ___________________________________________

Declaro ter recebido e compreendido as orientações acima e comprometo-me a segui-las.

Assinatura do Cliente: ______________________________    Data: ____/____/______`,

  termo_privacidade_lgpd: `TERMO DE PRIVACIDADE E TRATAMENTO DE DADOS — LGPD

Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), a [NOME_DA_CLINICA] informa:

1. DADOS COLETADOS
Nome, CPF, RG, endereço, telefone, e-mail, data de nascimento, histórico de saúde, informações de tratamentos e imagens vinculadas ao prontuário.

2. FINALIDADES
• Execução dos serviços contratados e gestão do prontuário
• Agendamentos e comunicações relativas ao tratamento
• Cumprimento de obrigações legais e sanitárias
• Uso de imagens conforme autorização específica (quando aplicável)

3. ARMAZENAMENTO E SEGURANÇA
Os dados são armazenados com medidas técnicas e organizacionais adequadas, por prazo compatível com a finalidade e obrigações legais (mínimo 5 anos para prontuários, conforme normas sanitárias).

4. COMPARTILHAMENTO
Não compartilhamos dados com terceiros para fins comerciais. Compartilhamento ocorre apenas quando exigido por lei ou autoridade competente.

5. SEUS DIREITOS (LGPD)
Você pode solicitar: acesso, correção, anonimização, portabilidade ou eliminação dos dados, nos casos permitidos em lei. Contato: [TELEFONE] ou [e-mail da clínica].

6. BASE LEGAL
Consentimento e execução do contrato de prestação de serviços.

Assinatura do Cliente: ______________________________    Data: ____/____/______`,

  politica_cancelamento: `POLÍTICA DE CANCELAMENTO E REMARCAÇÃO

A [NOME_DA_CLINICA] estabelece as seguintes regras:

1. REMARCAÇÃO
• Prazo mínimo para remarcar sem taxa: _____ horas de antecedência
• Remarcações fora do prazo: poderão ser cobradas conforme tabela da clínica

2. CANCELAMENTO
• Prazo mínimo para cancelamento sem multa: _____ horas de antecedência
• Cancelamento fora do prazo: poderá haver cobrança de taxa ou perda de sinal, conforme acordo

3. NÃO COMPARECIMENTO (NO-SHOW)
Faltas sem aviso prévio podem ser cobradas integralmente ou descontadas do pacote/plano.

4. PACOTES E PLANOS
Em caso de cancelamento pelo cliente, valores já pagos seguem as condições do contrato ou acordo firmado. Reembolsos, quando aplicáveis, seguem política específica.

5. PELA CLÍNICA
A clínica reserva-se o direito de remarcar em casos de força maior (falha de equipamento, impossibilidade do profissional, etc.), com aviso prévio e reagendamento sem custo adicional.`,

  anamnese_referencia: `REFERÊNCIA: ANAMNESE E FICHA CLÍNICA

A anamnese é a avaliação clínica do cliente antes dos procedimentos. Não é apenas um termo — é uma ficha detalhada que deve constar em todos os prontuários.

PONTOS ESSENCIAIS A REGISTRAR:
• Queixa principal e histórico de tratamentos anteriores
• Alergias (medicamentosas, dermatológicas, alimentos)
• Medicações em uso
• Condições de saúde (gestação, lactação, diabetes, hipertensão, doenças autoimunes, etc.)
• Histórico de cicatrização e queloides
• Exposição solar e uso de fotossensibilizantes
• Procedimentos recentes na região a ser tratada

No SkinClinic, a Anamnese está em: menu Anamnese ou no perfil do cliente. Use a ficha por área (pele, cabelo, injetáveis, corpo) e registre evoluções por evento.`
};

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/** Substitui placeholders pelos dados da organização */
export function applyOrgPlaceholders(text, profile = {}) {
  if (!text) return "";
  return String(text)
    .replace(/\[NOME_DA_CLINICA\]/g, profile.name || "[NOME_DA_CLINICA]")
    .replace(/\[CNPJ\]/g, profile.cnpj || "[CNPJ]")
    .replace(/\[ENDERECO\]/g, [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(", ") || "[ENDERECO]")
    .replace(/\[CEP\]/g, profile.cep || "[CEP]")
    .replace(/\[TELEFONE\]/g, profile.telefone || "[TELEFONE]");
}

export async function getLegalDocuments() {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("organization_legal_documents")
    .select("doc_key, content, updated_at")
    .eq("org_id", orgId);

  if (error) throw error;

  const map = Object.fromEntries((data || []).map((r) => [r.doc_key, r]));
  return Object.keys(DOC_KEYS).map((key) => ({
    key,
    label: DOC_KEYS[key],
    content: map[key]?.content ?? null,
    updatedAt: map[key]?.updated_at ?? null,
    hasCustomContent: !!map[key]?.content,
  }));
}

export async function saveLegalDocument(docKey, content) {
  const orgId = getOrgOrThrow();
  if (!Object.keys(DOC_KEYS).includes(docKey)) throw new Error("Documento inválido");

  const trimmed = content && String(content).trim() ? String(content).trim() : null;
  const payload = { org_id: orgId, doc_key: docKey, content: trimmed };

  const { error } = await supabase
    .from("organization_legal_documents")
    .upsert(payload, { onConflict: "org_id,doc_key" });

  if (error) throw error;
}
