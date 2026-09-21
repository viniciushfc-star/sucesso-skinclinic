# Jornada do cliente — 2026

## Mapa LEAD → INDICAÇÃO (onde vive hoje)

| Etapa | Existe? | Onde | Perda de contexto |
|-------|---------|------|-------------------|
| Lead | 🟡 | waitlist, agendar público, cliente sem visita | origem/campanha fraca |
| Primeiro contato | 🟡 | templates WA manuais | sem timeline única |
| Agendamento | 🟢 | `agenda` | `appointments` paralelo |
| Anamnese | 🟢 | `anamnesis_registros` + portal | dual `clients`/`clientes` em trechos |
| Avaliação | 🟡 | anamnese + estudo caso | não nomeada |
| Análise pele | 🟢 | `analise_pele` + validação | OK se RPC p0-02 |
| Plano | 🟡 | `planos_terapeuticos` | pouco visível no perfil/agenda |
| Procedimento | 🟢 | `procedures` no horário | |
| Protocolo | 🟡 | cadastro + IA menu | deveria ser método na ficha |
| Atendimento | 🟢 | linha `agenda` | |
| Aplicado | 🟡 | `protocolos_aplicados` | atalho agenda existe; preenchimento irregular |
| Evolução | 🟢 | fotos | |
| Skincare | 🟡 | rotina se liberada | |
| Retorno | 🟡 | `is_retorno`, CRM 90d | sem ritmo pessoal |
| Recompra | 🟡 | pacotes | |
| Indicação | 🔵 | docs mercado | sem objeto |

## História reconstruível?

**Parcialmente:** perfil agrega abas (anamnese, protocolo, fotos, pacotes, financeiro pontual).  
**Não** há um timeline único “o que aconteceu nesta pessoa” alimentando Intelligence.

Portal mostra fatias (cadastro, termo, pele validada, skincare, agenda), **não** “Minha jornada”.

## Contrato de produto

A ficha do cliente é o **núcleo**. Agenda é atalho. Módulos laterais não roubam o contexto (`sessionStorage` de IDs é frágil mas já costura anamnese/protocolo — preservar e fortalecer).
