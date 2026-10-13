# Roteiro de testes nas clínicas

Um perfil por vez. WhatsApp só no clique. IA sugere, humano confirma. Sem preço automático.

Automático (dev): `npm run cenario:piloto`

## Paciente (portal)

1. Abrir o link que a clínica copiou (`portal.html?token=…`). Não usar o login da equipe.
2. Ver próximo horário e sessões. Não pode aparecer rascunho de IA da pele.
3. Completar cadastro se pedido. Senha (8+) opcional; senha errada não entra.

## Administrador / dona (master)

1. Hoje, Agenda, Pacientes, Relacionamento, Financeiro (aba Contador), Equipe, Skincare.
2. Novo horário: profissional que aplica ≠ quem vendeu.
3. Lista de espera: Encaixar preenche o horário; WhatsApp só se clicar Avisar.
4. Destaque de mercado: só entra com fonte. Não escrever “o melhor do mercado”.
5. Copiloto: sugere. Nada grava preço ou estoque sozinho.

## Gestor

1. Entra no painel da clínica. Vê financeiro, contador, CRM e Copiloto.
2. Fecha o mês sem ser a dona.

## Recepção

1. Agenda, pacientes, CRM. WhatsApp na linha da pessoa.
2. Não vê Financeiro, Copiloto, Procedimentos nem Estoque.

## Profissional

1. Agenda, ficha, planos, estoque, procedimentos, IA auxiliar na tela.
2. Não vê Financeiro, CRM de fila, Copiloto nem envio de WhatsApp pela API.

## Acesso limitado (funcionário)

1. Só Hoje, ver agenda e ver pacientes.
2. Não cria link de portal, não manda WhatsApp, não abre financeiro.

## Contador

Não tem login próprio. Master ou gestor abre **Financeiro → Contador**. O texto não traz rascunho de IA.

## O que não testar neste piloto

Pagamento in-app, NFS-e, loja, bot de WhatsApp, disparo em massa, Open Finance.
