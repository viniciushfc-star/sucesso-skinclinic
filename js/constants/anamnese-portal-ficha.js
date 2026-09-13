/** Campos da ficha que o cliente preenche no portal (anamnese à distância). */
export const PORTAL_FICHA_CAMPOS = {
  rosto_pele: [
    { key: "queixa_principal", label: "Qual é a sua queixa principal?", type: "textarea", placeholder: "Ex.: manchas, acne, oleosidade…" },
    { key: "quando_comecou", label: "Quando começou ou quando percebeu?", type: "text", placeholder: "Ex.: há alguns meses" },
    { key: "ja_tratamento_facial", label: "Já fez algum tratamento facial?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "filtro_solar_diario", label: "Utiliza filtro solar diariamente?", type: "sim_nao" },
    { key: "usa_acidos_peelings", label: "Usa ácidos (peelings)?", type: "sim_nao_complement", complementPlaceholder: "Há quanto tempo?" },
    { key: "alergias_cremes", label: "Alergias a cremes, loções ou anestésico?", type: "sim_nao_complement", complementPlaceholder: "Quais?" },
    { key: "gestante", label: "Está grávida ou suspeita de gestação?", type: "sim_nao_complement", complementPlaceholder: "Quanto tempo de gestação?" },
    { key: "medicacao_habitual", label: "Usa medicação contínua?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "problema_pele", label: "Tem algum problema de pele diagnosticado?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "diabetico", label: "É diabético(a)?", type: "sim_nao" },
    { key: "fumante", label: "Fumante?", type: "sim_nao_complement", complementPlaceholder: "Quantos maços por dia?" },
    { key: "outras_informacoes", label: "Outras informações que gostaria de relatar", type: "textarea", placeholder: "Alergias, cirurgias, hábitos…" }
  ],
  capilar: [
    { key: "queixa_principal", label: "Queixa principal", type: "textarea", placeholder: "Ex.: queda, oleosidade, caspa…" },
    { key: "tipo_cabelo", label: "Tipo de cabelo", type: "text", placeholder: "Ex.: liso, cacheado, químico…" },
    { key: "condicao_couro", label: "Condição do couro cabeludo", type: "text", placeholder: "Ex.: sensível, oleoso…" },
    { key: "produtos_uso", label: "Produtos em uso", type: "textarea", placeholder: "Shampoo, condicionador, outros…" }
  ],
  corporal: [
    { key: "afecacao_interesse", label: "O que você gostaria de tratar no corpo?", type: "textarea", placeholder: "Ex.: gordura localizada, flacidez…" },
    { key: "ja_tratamento_corporal", label: "Já fez algum tratamento corporal?", type: "sim_nao_complement", complementPlaceholder: "Qual?" },
    { key: "pratica_atividade_fisica", label: "Pratica atividade física?", type: "sim_nao_complement", complementPlaceholder: "Com que frequência?" },
    { key: "outras_informacoes", label: "Outras informações", type: "textarea", placeholder: "Cirurgias, hábitos, restrições…" }
  ]
};

export const PORTAL_FUNCAO_OPCOES = [
  { slug: "rosto_pele", label: "Rosto / pele" },
  { slug: "capilar", label: "Cabelo / couro cabeludo" },
  { slug: "corporal", label: "Corpo" }
];
