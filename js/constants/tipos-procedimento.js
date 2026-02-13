/**
 * Tipos de procedimento para cruzar sala × procedimento × profissional.
 * Usado em: salas.procedimento_tipos, procedures.tipo_procedimento, agendamento.
 */
export const TIPOS_PROCEDIMENTO = [
  { value: "facial", label: "Facial (pele)" },
  { value: "corporal", label: "Corporal" },
  { value: "capilar", label: "Capilar" },
  { value: "injetaveis", label: "Injetáveis" },
];

export const TIPOS_VALUES = TIPOS_PROCEDIMENTO.map((t) => t.value);

export function labelTipo(value) {
  return TIPOS_PROCEDIMENTO.find((t) => t.value === value)?.label || value || "—";
}
