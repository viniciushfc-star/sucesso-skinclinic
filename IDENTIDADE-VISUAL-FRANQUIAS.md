# Identidade visual e estilização do app (logo + franquias)

**Ideia:** O dono da clínica (ou da franquia) poder **estilizar o app** e colocar **sua logo**, principalmente para agradar **grandes franquias** da área — cada unidade ou rede vê o sistema com a própria identidade, sem deixar de reconhecer que é o produto SkinClinic.

---

## SkinClinic não perde identidade: consolidar a marca e ser mais aceita

**Pergunta:** Deixar o dono/franquia colocar logo e cores faria a **SkinClinic perder identidade visual**?

**Resposta:** Não, se a customização for feita em **co‑marca** (co‑branding): a **SkinClinic continua sempre visível** em pontos fixos, e a clínica/franquia ganha destaque (logo, cor, nome). Assim você **consolida a marca SkinClinic** e, ao mesmo tempo, **aumenta a aceitação** porque a rede sente que o app “é deles” também.

### O que fazer na prática

| Quem | O que mostra | Objetivo |
|------|----------------|----------|
| **Clínica / franquia** | Logo no sidebar, nome no título da página, opcionalmente cor primária (botões, acentos). | Familiaridade, “este é o sistema da minha rede”. |
| **SkinClinic** | Sempre presente em **pelo menos um** destes: rodapé (“Powered by SkinClinic”), cantinho do sidebar (logo pequena ou texto “SkinClinic”), tela de login (“SkinClinic” + logo da clínica ao escolher org). | Quem usa sabe que é o produto SkinClinic; a marca se consolida. |

### Opções de desenho (escolher um e manter consistente)

1. **Rodapé fixo**  
   No dashboard, um rodapé discreto: “Powered by **SkinClinic**” (ou logo pequena). A clínica ocupa o topo/sidebar; a SkinClinic fica como “tecnologia por trás”.

2. **Sidebar em dois níveis**  
   No topo do sidebar: logo e nome da **clínica**. Abaixo (ex.: no rodapé do sidebar): “SkinClinic” ou logo pequena da SkinClinic. Assim as duas marcas convivem sem a SkinClinic sumir.

3. **Login e seleção de organização**  
   Tela de login: marca **SkinClinic** em destaque. Ao escolher organização (ou após login), mostrar “Bem-vindo à **Nome da Clínica**” e a logo deles, com um pequeno “SkinClinic” ou “por SkinClinic” em baixo. A franquia se sente em casa; a SkinClinic segue identificada.

4. **Título da página**  
   Usar formato: **"Nome da Clínica – SkinClinic"** ou **"SkinClinic – Nome da Clínica"**. A aba do navegador reforça as duas marcas.

Regra de ouro: **customização sim, mas SkinClinic sempre visível em algum lugar**. Assim a identidade visual da SkinClinic não se perde, a marca se consolida, e os detalhes (logo e estilização da clínica) ajudam a ser mais aceita pelas grandes franquias.

---

## Onde essa ideia está hoje

### Já implementado

| O quê | Onde |
|-------|------|
| **Logo da empresa** | **Configurações → Dados da empresa** (ou menu **Empresa**). Campo **Logo (URL)**: a URL da imagem da logo é salva no perfil da organização (`organizations.logo_url`). |
| **Logo no app** | A logo aparece no **sidebar** (menu lateral) do dashboard: se `logo_url` estiver preenchida, o sistema exibe a imagem; senão, o **nome da empresa**; se não houver nome, o fallback é "SkinClinic". Lógica em `js/core/spa.js` → `updateAppIdentity()`, chamada ao navegar para o dashboard. |
| **Nome da empresa** | Também no cadastro da empresa; o nome é usado no sidebar quando não há logo e em referências (marketing, etc.). |

Ou seja: **logo e nome já permitem que cada organização (e cada franquia/unidade) tenha identidade própria no app** — pelo menos no menu lateral.

### Documentação relacionada

- **MASTER-CONFIGURACOES-IDEA.md** — Configurações como hub; card "Dados da empresa" com "nome, endereço, CNPJ, **logo** e salas".
- **dashboard.html** — Texto na tela Empresa: *"identidade no app (logo)"* e *"A logo aparece no app para dar identidade à clínica e aumentar a familiaridade da equipe."*
- **supabase-organization-profile.sql** — Coluna `logo_url` na tabela `organizations`; comentário: *"URL da logo da empresa — identidade no app, maior familiaridade dos profissionais."*

---

## O que pode ser ampliado (ideia guardada)

Para **estilizar** ainda mais o app e atender melhor franquias:

| Ideia | Descrição |
|-------|-----------|
| **Cor primária / tema da marca** | Permitir que a organização defina uma **cor primária** (ex.: hex). O app usaria essa cor no header, botões principais, links, sidebar (acento), etc. Assim cada franquia vê “a cor da marca” no sistema. |
| **Favicon** | Usar a logo (ou uma versão reduzida) como **favicon** da aplicação quando a organização estiver ativa, para a aba do navegador mostrar a identidade da clínica. |
| **Título da página** | Já existe **nome** da empresa; pode-se usar no `<title>` (ex.: "SkinClinic – Nome da Clínica") para a aba e o histórico refletirem a identidade. |
| **Header do dashboard** | Além do sidebar, o **cabeçalho** (topo da área de conteúdo) pode exibir logo ou nome da clínica, reforçando a identidade em telas grandes. |
| **Login / onboarding** | Tela de login ou de escolha de organização podem exibir a logo da organização selecionada (quando houver), reforçando “este é o sistema da sua rede”. |

Nada disso substitui o que já existe; são **extensões** da mesma ideia: dono estiliza o app e coloca a logo dele, para agradar grandes franquias.

---

## Resumo

- **SkinClinic não perde identidade:** usar **co‑marca**: clínica/franquia com logo e (opcional) cor; SkinClinic sempre visível (rodapé "Powered by", sidebar ou login). Assim a marca se consolida e a aceitação pelas franquias aumenta.
- **Onde está a ideia:** na **tela Empresa** (logo + nome), no **sidebar** (exibição da logo ou nome) e na documentação de **Configurações** (MASTER-CONFIGURACOES-IDEA).
- **O que já cobre:** logo e nome da empresa por organização, com impacto direto na identidade no app (menu lateral).
- **O que fica guardado para depois:** cor primária, favicon, título da página, identidade no header e no login — sempre mantendo SkinClinic visível em pelo menos um ponto fixo.
