# Product Requirements Document (PRD) — ClientPulse AI

**Projeto:** ClientPulse AI — Relatórios Semanais de Progresso para Freelancers e Agências  
**Equipa:** [Nome da Equipa / Elementos da Equipa]  
**Repositório GitHub:** `[Link para o Repositório]` (Adicionado `diogocosme` como colaborador)  
**Versão:** 2.0 (Alinhado com o Relatório de Validação)  

---

## 1. Resumo Executivo & Visão Geral (TL;DR)

### 1.1 Nome do Produto e Empresa
**ClientPulse AI** (SaaS B2B).

### 1.2 Descrição do Produto / Serviço
O **ClientPulse AI** é uma plataforma SaaS que automatiza a geração e o envio de relatórios semanais de progresso para clientes. Conecta-se diretamente ao **GitHub Projects** (fonte única de dados no MVP), extrai as tarefas concluídas, bloqueios e próximos passos da semana, e utiliza inteligência artificial para redigir um relatório em linguagem de negócio clara e sem jargão técnico. 

O envio é agendado (semanalmente por defeito), contando com revisão e aprovação prévia do profissional antes de ser disparado, ou envio direto automático (opcional). O cliente recebe um e-mail com o resumo e um link seguro para o **Portal do Cliente** (só de leitura, sem login) para consultar o histórico e métricas simples de entregas. A plataforma inclui ainda um **Assistente Conversacional (Chatbot/Voice Bot)** para guiar o onboarding do profissional e tirar dúvidas de utilização.

### 1.3 Segmento de Clientes (Público-Alvo)
- **Segmento Principal:** Donos e gestores de pequenas agências digitais (2 a 10 colaboradores) de desenvolvimento web, design e marketing.
- **Segmento Secundário:** Freelancers e consultores seniores independentes que gerem em simultâneo entre 2 a 5 clientes de ticket médio-alto.

### 1.4 Âmbito e Divisão de Fases (MVP vs. Evolução Futura)
- **Âmbito do MVP (Entregável do Projeto):** 
  - Integração exclusiva com GitHub Projects API.
  - Geração de relatórios por IA (3 blocos: concluído, bloqueios, próximos passos).
  - Fluxo de aprovação manual do profissional com opção de *bypass* para envio direto.
  - Envios agendados por e-mail com ligação segura ao Portal do Cliente (sem login).
  - Dashboard do profissional com controlo de relatórios e tarefas por sprint.
  - Assistente conversacional (Chatbot/Voice Bot) restrito ao Onboarding (setup da conta e ligação ao GitHub) e FAQ/Suporte.
- **Evolução Futura (Fora do MVP):**
  - Integrações com Trello, Notion e Jira.
  - Micro-aprovações formais de entregas por parte do cliente no portal.
  - Autenticação com credenciais (*login*) para o cliente final.

---

## 2. Narrativa de Utilização (User Experience Story)

A **Maria** é gestora numa pequena agência de desenvolvimento web de 4 pessoas que gere 5 clientes em simultâneo. Às sextas-feiras, a Maria gastava mais de 3 horas a compilar manualmente o estado das tarefas no GitHub, a responder a mensagens ansiosas de clientes no Slack/WhatsApp e a traduzir linguagem técnica para e-mails de ponto de situação.

Ao adotar o **ClientPulse AI**, a Maria realiza o onboarding em menos de 5 minutos: um **Assistente de Voz/Chat** guia-a na ligação da conta do GitHub da agência, no mapeamento do board e na criação do perfil dos seus clientes.

Na sexta-feira às 09:00, o sistema compila a atividade do GitHub Projects e a IA gera automaticamente um rascunho de relatório executivo em Português. A Maria recebe um alerta no Dashboard, lê o resumo em 2 minutos, faz uma pequena afinação e clica em "Aprovar e Enviar". 

O cliente recebe um e-mail profissional com a síntese e um link seguro de acesso direto ao **Portal do Cliente**, onde visualiza os progressos da semana e o gráfico de tarefas concluídas por *sprint*, sem necessidade de criar conta ou gerir palavras-passe. A Maria reduz o tempo de gestão de relatórios em mais de 80% e elimina a ansiedade dos clientes.

---

## 3. Goals Framework

### Business Goals
- **Redução drástica de tempo não faturável:** Reduzir o tempo gasto na elaboração de relatórios de 3–6 horas/semana para menos de 10 minutos por cliente (incluindo a revisão).
- **Proved de Uso Real:** Utilizar o GitHub Project da própria equipa académica para gerir o desenvolvimento e validar os relatórios em tempo real.
- **Retenção e Confiança:** Aumentar a transparência com os clientes, reduzindo pedidos intermédios de ponto de situação.

### User Goals
- **Profissional (Agência/Freelancer):** Centralizar e automatizar a prestação de contas, mantendo controlo total antes da saída do e-mail.
- **Cliente Final:** Perceber o valor entregue a cada semana em linguagem clara e executiva, sem ruído técnico nem necessidade de registos complicados.

### Non-Goals
- Não permitir edição ou gestão bidirecional de tarefas a partir do Portal do Cliente.
- Não efetuar análise ou armazenamento de código-fonte dos repositórios (estritamente restrito aos metadados de *cards/issues* do GitHub Projects).
- Não suportar múltiplas fontes de dados (Trello/Notion) nesta fase de MVP.

---

## 4. User Stories & Critérios de Aceitação

### US01 — Conexão ao GitHub Projects (MVP - Prioridade Alta)
- **Como** gestor de agência / freelancer,
- **Quero** ligar a minha conta e selecionar o meu GitHub Project,
- **Para que** o sistema consiga extrair automaticamente as tarefas concluídas, bloqueadas e em curso.
- **Critérios de Aceitação:**
  - O utilizador pode autenticar-se via OAuth ou Personal Access Token (PAT).
  - O sistema lista os projetos disponíveis e permite selecionar o board pretendido.
  - O utilizador consegue mapear quais as colunas do board correspondem a "Concluído", "Em Curso" e "Bloqueado".

### US02 — Onboarding Assistido via Chatbot/Voice Bot (MVP - Prioridade Média)
- **Como** novo utilizador,
- **Quero** ser guiado por um assistente de conversa (texto ou voz) no primeiro acesso,
- **Para que** consiga configurar a conta, conectar o GitHub e criar o primeiro cliente em menos de 5 minutos.
- **Critérios de Aceitação:**
  - O bot é ativado automaticamente no primeiro login.
  - Permite input por voz ou texto para responder a perguntas de suporte e orientar na ligação da API do GitHub.
  - O bot valida se a ligação ao GitHub foi bem-sucedida antes de avançar.

### US03 — Configuração de Perfil de Cliente (MVP - Prioridade Alta)
- **Como** profissional,
- **Quero** registar os dados do meu cliente (nome, e-mail, tom de comunicação e idioma),
- **Para que** os relatórios gerados por IA fiquem personalizados ao estilo de cada cliente.
- **Critérios de Aceitação:**
  - Suporte nativo para idioma Português e Inglês.
  - Opções de tom de comunicação: Formal, Executivo ou Descontraído.
  - Campo para definir a periodicidade de envio (ex: todas as sextas-feiras às 17h).

### US04 — Geração e Aprovação de Rascunho por IA (MVP - Prioridade Alta)
- **Como** profissional,
- **Quero** receber um rascunho de relatório gerado por IA e poder editá-lo/aprová-lo antes do envio,
- **Para que** possa garantir a precisão da informação e evitar alucinações da IA.
- **Critérios de Aceitação:**
  - O rascunho é estruturado obrigatoriamente em 3 blocos: *O que foi feito*, *Bloqueios/Atenção* e *Próximos Passos (Decisões)*.
  - O utilizador pode editar o texto diretamente num editor WYSIWYG/Markdown.
  - Existe um botão claro "Aprovar e Enviar" e uma opção nas definições para "Envio Automático sem Aprovação (Bypass)".

### US05 — Portal do Cliente sem Login (MVP - Prioridade Alta)
- **Como** cliente final,
- **Quero** aceder ao meu relatório e histórico através de uma ligação segura enviada por e-mail,
- **Para que** consulte o estado do projeto sem ter de criar conta ou memorizar credenciais.
- **Critérios de Aceitação:**
  - A hiperligação do e-mail contém um token único e não adivinhável.
  - A página é estritamente de leitura, exibindo o relatório da semana, histórico anterior e um gráfico simples de tarefas concluídas por sprint.

---

## 5. Funcionalidades Principais (Feature Set Priorizado)

| Funcionalidade | Descrição | Prioridade | Âmbito |
| :--- | :--- | :--- | :--- |
| **GitHub Sync Engine** | Leitura de *issues*, colunas de estado (*Done*, *In Progress*, *Blocked*), etiquetas e comentários do GitHub Projects via API. | **P0 (Crítico)** | MVP |
| **Generative AI Reporter** | Síntese de tarefas por LLM em 3 blocos (*Feito*, *Bloqueios*, *Próximos Passos*) adaptando o tom e idioma (Português). | **P0 (Crítico)** | MVP |
| **Dashboard do Profissional** | Painel para gerir relatórios pendentes, relatórios enviados, tarefas por sprint e estado dos clientes. | **P0 (Crítico)** | MVP |
| **Portal do Cliente (Zero-Login)** | Vista web segura *read-only* com relatório semanal, histórico e gráfico de entregas por sprint. | **P0 (Crítico)** | MVP |
| **Flow de Aprovação & Scheduler** | Agendamento semanal automático com paragem para revisão manual ou modo *bypass* (envio direto). | **P1 (Alto)** | MVP |
| **Onboarding Chat/Voice Bot** | Assistente conversacional interativo para guiar a configuração inicial e responder a dúvidas de utilização (FAQ). | **P1 (Alto)** | MVP |
| **Multi-Source Sync** | Conexão adicional a Trello, Notion e Jira no mesmo relatório. | **P3 (Baixo)** | Evolução Futura |
| **Micro-aprovações do Cliente** | Botão no portal para o cliente aprovar formalmente entregas de módulos. | **P3 (Baixo)** | Evolução Futura |

---

## 6. Panorama Competitivo & Falhas de Mercado

### 6.1 Análise da Concorrência Directa e Indirecta
- **Briefd:** Concorrente mais próximo. Permite estruturar relatórios no formato de 3 blocos (*progresso, bloqueios, próximos passos*) e enviar ao cliente, mas exige preenchimento manual de todos os campos pelo profissional. **Diferencial ClientPulse:** Recolha automática do GitHub Projects e síntese por IA.
- **AgencyAnalytics / DashThis:** Focadas em métricas quantitativas de marketing (SEO, Ads). Cobra ~20–25 USD/cliente/mês. **Diferencial ClientPulse:** Foco em entregas qualitativas e engenharia/design.
- **Copilot (Assembly) / ManyRequests:** Portais completos de clientes. Preços entre 39 USD e 99 USD/mês. **Diferencial ClientPulse:** Elimina a fricção de login do cliente e inclui automação de síntese por IA sem setup complexo.
- **Modelos no Notion / Taskade:** Exigem configuração manual de modelos e prompts pelo utilizador e não oferecem portal isolado nem agendamento automatizado nativo com aprovação.

---

## 7. Métricas de Sucesso e Critérios de Falha

### 7.1 Métricas Académicas e de Produto (Mensuráveis)
- **Tempo de Onboarding:** Ligar o GitHub Project e gerar o 1º relatório em **menos de 5 minutos** com o auxílio do bot.
- **Eficácia do Bot de Onboarding:** Mais de **85%** dos utilizadores de teste completam o setup inicial na 1ª sessão via assistente conversacional.
- **Tempo de Preparação Semanal:** Redução do tempo de elaboração de relatórios para **menos de 10 minutos por cliente/semana** (incluindo a revisão).
- **Precisão da IA:** Mais de **80%** das tarefas do GitHub Projects refletidas corretamente no relatório; pelo menos **80%** dos rascunhos aprovados com menos de 3 edições manuais.
- **Engajamento do Cliente:** Taxa de acesso ao Portal do Cliente / e-mail superior a **70%** nas primeiras 24 horas após o envio.

### 7.2 Critérios de Falha (Parar ou Pivotar)
- **Sinal de Falha no Prompt/IA:** Se mais de **50%** dos relatórios exigirem reescrita manual total devido a alucinações ou falta de contexto técnico.
- **Sinal de Falha no Onboarding:** Se menos de **50%** dos utilizadores conseguirem conectar o GitHub sem intervenção humana direta da equipa.

---

## 8. Considerações Técnicas & Segurança

- **APIs & Conectividade:** Uso da API REST / GraphQL do GitHub. Autenticação via OAuth 2.0 ou Personal Access Tokens armazenados de forma cifrada.
- **Modelo de IA:** OpenAI API (`gpt-4o-mini` / `gpt-4o`) ou Google Gemini API, utilizando técnicas de *few-shot prompting* com regras estritas para evitar alucinações.
- **Segurança de Dados & Privacidade:** 
  - **Não armazenamento de código & Minimização de Dados (Issue #51):** Apenas metadados de tarefas (*title*, *description*, *status*, *assignees*, *labels*) são processados. O código-fonte dos repositórios nunca é lido nem guardado. Política completa de privacidade e minimização documentada em [`docs/PRIVACY.md`](PRIVACY.md).
  - **Secrets:** Chaves de API e credenciais guardadas estritamente em variáveis de ambiente (`.env`).
  - **Portal do Cliente:** Acesso protegido por URLs obscuros com Tokens UUIDv4 de uso único ou com tempo de expiração.

---

## 9. Decisões Técnicas de Arquitetura (Technical Decisions Log)

*Registo cronológico das decisões estruturais do projeto:*

1. **[2026-10-13] — Escolha da Stack Base do MVP:**
   - **Frontend / Portal:** React / Next.js com Tailwind CSS para garantir performance e responsividade no Portal do Cliente e Dashboard.
   - **Backend & Base de Dados:** Supabase (PostgreSQL + Auth + Edge Functions) para gestão de utilizadores, tokens de clientes e persistência do histórico de relatórios.
   - **Engine de Automação & Agendamento:** Node.js (Cron jobs / Supabase Edge Functions) ou Make.com para orquestração de envios às sextas-feiras.
   - **Raciocínio:** Minimizar a complexidade de infraestrutura, permitindo a entrega de um SaaS 100% funcional no prazo de 5 semanas.

2. **[2026-10-13] — Restrição da Fonte de Dados ao GitHub Projects:**
   - **Decisão:** Manter o GitHub Projects como a **única** integração de dados durante a fase de MVP, remetendo Trello e Notion para a evolução futura.
   - **Raciocínio:** Evitar *scope creep* e garantir que a equipa utiliza o seu próprio GitHub Project no projeto académico como prova real de funcionamento.

---

## 10. Calendário e Milestones (5 Semanas)

- **Semana 1: Alinhamento, Pesquisa e PRD (Concluído)**
  - Validação de mercado, consolidação do PRD e criação da pasta `/docs` no repositório GitHub (`/docs/PRD.md` e `/docs/RESEARCH.md`).
  - Configuração do GitHub Project da equipa com os campos customizados obrigatoriamente exigidos (*Priority*, *Status*, *Size*).

- **Semana 2: Integração com GitHub API & Engine de IA**
  - Desenvolvimento da extração de dados da API do GitHub.
  - Construção do prompt do LLM em Português para gerar a síntese nos 3 blocos executivos.

- **Semana 3: Dashboard, Chatbot de Onboarding e Portal do Cliente**
  - Implementação da interface do Dashboard (gestão de relatórios e tarefas por sprint) e do Portal do Cliente (zero-login).
  - Integração do Chatbot/Voice bot para o fluxo de onboarding assistido.

- **Semana 4: Automação do Agendamento, Envio de E-mails e Teste Real**
  - Configuração dos agendamentos de envio e disparo de e-mails com links tokens de segurança.
  - Teste de uso real: Geração de relatórios semanais do próprio projeto da equipa através do sistema.

- **Semana 5: Polimento, Métricas e Preparação da Demo/Pitch**
  - Ajustes finais de UI/UX, revisão de segurança, consolidação do repositório e preparação da apresentação/pitch final.