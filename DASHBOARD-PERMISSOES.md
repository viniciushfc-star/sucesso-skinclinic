# Dashboard por permissões

O dashboard mostra **só o que faz sentido para o papel** de quem está logado.

## Regras atuais

| Permissão        | Card exibido                    | Quem costuma ter |
|------------------|----------------------------------|------------------|
| `clientes:view`  | **Clientes** (total da clínica) | Gestor, funcionário |
| `agenda:manage`  | **Agenda hoje** (total da clínica) | Gestor |
| `agenda:view`    | **Meus atendimentos hoje** (só do profissional) | Funcionário (terapeuta, etc.) |
| `financeiro:view`| **Saldo** (faturamento do mês)  | Gestor |

- **Funcionário/terapeuta**: vê “Meus atendimentos hoje” e “Clientes”; **não** vê faturamento.
- **Gestor**: vê “Clientes”, “Agenda hoje” e “Saldo”.
- **Master**: usa a área Master (métricas globais e comparação entre clínicas).

## Onde está no código

- **Métricas**: `js/services/metrics.service.js` → `getDashboardMetricsForUser()` (retorna `clientes`, `agendamentosHoje`, `meusAtendimentosHoje`, `faturamentoMes`).
- **View**: `js/views/dashboard.views.js` → `init()` chama `checkPermission` para cada permissão e mostra/oculta os cards do header, preenchendo os valores.

## Ideias para amadurecer

1. **“Meu previsto hoje” (comissão por %)**
   - Para quem é remunerado por porcentagem: somar o valor dos procedimentos do profissional no dia × % e mostrar como card (ex.: “Seu previsto hoje: R$ …”).
   - Exige: tabela/coluna de % por profissional ou por procedimento; uso em `getDashboardMetricsForUser()` e um novo card condicionado a uma permissão (ex.: `dashboard:see_own_revenue` ou papel “remunerado por %”).

2. **RH / papel só de pessoas**
   - Criar um papel (ex.: `rh`) sem `financeiro:view` e sem “Agenda hoje” da clínica; opcionalmente mostrar só “Equipe” ou indicadores de pessoas (número de membros, convites pendentes, etc.) no dashboard.

3. **Filtro de período**
   - Conectar o filtro “Hoje / Semana / Mês” do dashboard a `getDashboardMetricsForUser({ startDate, endDate })` e atualizar cards e, no futuro, gráficos por período.

4. **Gráficos no dashboard normal**
   - Reutilizar a lógica de `renderCharts` (ou um módulo compartilhado) na view do dashboard normal, exibindo gráficos **só** quando o usuário tiver permissão para ver os dados (ex.: gráfico de faturamento só com `financeiro:view`).
