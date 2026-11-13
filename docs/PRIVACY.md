# Política de Privacidade e Minimização de Dados Enviados à IA

> **Projeto:** ClientPulse AI — Relatórios Semanais de Progresso para Freelancers e Agências  
> **Identificador da Issue:** [DOC-04] #51 — *Aviso de privacidade e minimização dos dados enviados à IA*  
> **Classificação:** Segurança, Privacidade & Governação de Dados  
> **Versão:** 1.0 (Alinhada com Sprint 3 e Relatório de Validação)  
> **Última Atualização:** Novembro de 2026

---

## 1. Enquadramento e Motivação

No desenvolvimento do **ClientPulse AI**, a privacidade dos dados de projetos de software constitui um requisito de primeira ordem. Na análise de risco documentada no `docs/RELATORIO_VALIDACAO.md` (Secção 7), identificou-se o seguinte risco específico:

> *"Privacidade dos dados do cliente: o conteúdo das tarefas é enviado a um modelo de IA externo. Mitigação: ler e enviar apenas os dados estritamente necessários, não armazenar código-fonte, evitar dados sensíveis e informar o utilizador."*

Em estrita consonância com o **Regulamento Geral sobre a Proteção de Dados (RGPD / GDPR - Artigo 5.º, n.º 1, alínea c)** — *Princípio da Minimização dos Dados* —, o ClientPulse AI garante que apenas os dados adequados, pertinentes e estritamente limitados ao indispensável para a síntese executiva são processados e transmitidos a subprocessadores externos de Inteligência Artificial.

---

## 2. Subprocessadores Externos e Serviços de Terceiros

Para prestar as funcionalidades de automação e comunicação, o ClientPulse AI interage com os seguintes subprocessadores e APIs externas:

| Subprocessador | Função / Propósito | Dados Partilhados | Garantia de Retenção / Treino |
| :--- | :--- | :--- | :--- |
| **Google Cloud / Google AI (Gemini API)** | Síntese de relatórios executivos de 3 blocos e assistente conversacional de onboarding (PulseBot). | Metadados estritamente minimizados de tarefas e mensagens de suporte. | Chamadas via API de inferência comercial sem retenção para treino de modelos base. |
| **GitHub API (GraphQL Projects v2)** | Leitura do estado de cartões, colunas e validação do token PAT da agência. | Leitura do status e campos dos cartões do board selecionado. | Acesso estritamente de leitura (escopo `read:project`). |
| **Resend** | Disparo transacional de e-mails de notificação com link seguro para o portal. | Nome e e-mail do cliente, corpo do relatório aprovado e link do portal. | Retenção transitória para registo de entrega e eventos de abertura (tracking). |
| **Supabase (PostgreSQL / Edge Runtime)** | Autenticação, persistência relacional com RLS e execução segura em backend Deno. | Dados de conta da agência, clientes, relatórios e tarefas. | Criptografia em trânsito (TLS 1.3) e cifra de credenciais em repouso. |

---

## 3. Matriz de Minimização de Dados (Data Minimization Matrix)

O ClientPulse AI estabelece um filtro explícito antes de qualquer envio de informação ao modelo de Inteligência Artificial (Google Gemini).

### 3.1 Campos Estritamente Permitidos e Enviados à IA

Apenas os seguintes **5 campos** relativos a cada tarefa/cartão são transmitidos ao modelo:

| Campo | Tipo | Descrição e Higienização |
| :--- | :--- | :--- |
| `title` | `string` | Título sumário da tarefa ou funcionalidade (ex.: *"Implementar autenticação OAuth"*). |
| `description` | `string` (opcional) | Descrição textual da tarefa, submetida a **higienização automática** (remoção de blocos de código markdown `` ``` `` e backticks) e truncada até ao limite de 300 caracteres para mitigar fugas de dados e token bloat. |
| `status` | `string` | Nome da coluna ou estado no GitHub Project (ex.: *"Done"*, *"In Progress"*, *"Blocked"*). |
| `labels` | `string[]` | Etiquetas temáticas associadas à tarefa (ex.: `["feature", "backend"]`). |
| `assignee` | `string \| null` | Nome de utilizador (login GitHub) do responsável pela entrega. |

### 3.2 Dados Explicitamente Proibidos e NUNCA Transmitidos nem Armazenados

O sistema implementa barreiras de código que impedem categoricamente o envio dos seguintes elementos:

* ❌ **Código-Fonte e Repositórios:** O ClientPulse AI nunca acede, nunca descarrega, nunca clona e nunca analisa ficheiros de código-fonte, commits, branches ou diffs de Pull Requests.
* ❌ **Credenciais e Segredos:** Tokens de Acesso Pessoal (PATs do GitHub), chaves de API, variáveis de ambiente ou senhas nunca são enviados nos prompts de geração.
* ❌ **Identificadores Internos de Sistema:** UUIDs de base de dados (`id`, `client_id`, `report_id`), URLs completos de repositórios privados e tokens de webhook são descartados na camada de minimização (`minimizeTaskForAI`).
* ❌ **Informação Financeira ou Pessoal Extensiva:** Dados bancários, moradas, números de telefone ou tabelas salariais não fazem parte do modelo de dados nem chegam à IA.

---

## 4. Medidas Técnicas de Proteção e Cifra

Para assegurar a confidencialidade e integridade dos dados durante todo o seu ciclo de vida, são aplicadas as seguintes medidas técnicas:

1. **Cifra de Credenciais em Repouso (AES-GCM 256-bit):**
   * Os Personal Access Tokens (PATs) do GitHub fornecidos pelos gestores de agência são cifrados antes de serem persistidos na tabela `github_integrations` utilizando uma chave mestra independente (`ENCRYPTION_KEY`).
   * Em momento algum o PAT em texto claro é exposto nas respostas das APIs ou em logs da aplicação.
2. **Mascaramento no Assistente Conversacional (PulseBot):**
   * O frontend do chat de onboarding mascara imediatamente qualquer token inserido (formato `ghp_...` ou `github_pat_...`) substituindo-o por marcadores opacos (`••••••••`) no histórico de conversação do utilizador.
   * O backend sanitiza a mensagem antes de submeter a qualquer modelo de linguagem, garantindo que o token não circula no prompt.
3. **Higienização e Strip de Código em Descrições:**
   * A função `sanitizeTaskDescription` em `supabase/functions/_shared/github.ts` remove expressões regulares de blocos de código (ex.: `` ```ts ... ``` ``) e fragmentos com backticks antes de qualquer agrupamento.
4. **Isolamento Multitenant via Row Level Security (RLS):**
   * Todas as tabelas no PostgreSQL (`agencies`, `clients`, `reports`, `report_tasks`, `github_integrations`) possuem políticas RLS ativas vinculadas ao `auth.uid()`, impossibilitando o acesso cruzado de dados entre diferentes agências.
5. **Validação em Runtime de Consultas GraphQL (Allowlist Estrita - BE-09 / Issue #23):**
   * Antes de disparar qualquer pedido ao endpoint GraphQL do GitHub, a função `validateGraphQLQuery` analisa estruturalmente a query contra uma allowlist estrita de campos de ProjectV2 (`ALLOWED_GRAPHQL_FIELDS`).
   * Qualquer tentativa de aceder a ficheiros, blobs, árvores git (`tree`), commits ou repositórios é bloqueada imediatamente em memória com `SecurityError`, impedindo a saída de qualquer pacote HTTP para a infraestrutura do GitHub.
   * Suíte automatizada de testes de segurança em runtime disponível em `scripts/test-runtime-security.mjs` (`npm test`).

---

## 5. Transparência e Princípio "Human-in-the-Loop"

A inteligência artificial generativa atua estritamente como um **mecanismo de redação assistida**, nunca como um decisor autónomo não supervisionado.

### 5.1 Avisos Visíveis na Interface (UI Disclaimers)
O utilizador é informado de forma transparente sobre o uso de IA externa em todos os pontos de contacto relevantes:
1. **Ecrã de Revisão do Relatório (`/dashboard/reports/[id]`):**  
   Um painel informativo com ícone de escudo (`ShieldCheck`) indica claramente:  
   *"Síntese gerada por IA externa (Google Gemini) · Minimização de Dados: Apenas os metadados estritamente necessários das tarefas (título, descrição, estado, etiquetas e responsáveis) foram transmitidos à IA. O código-fonte dos teus repositórios nunca é lido nem guardado. Por favor, revê e afina os blocos abaixo antes de aprovar o envio."*
2. **Chatbot de Onboarding (`/onboarding`):**  
   Abaixo da caixa de envio do assistente PulseBot é exibido o aviso:  
   *"Aviso de Privacidade: O PulseBot e a geração de relatórios utilizam IA externa (Google Gemini). Apenas metadados de tarefas são processados; nenhum código-fonte é acedido ou armazenado."*
3. **Ações de Geração no Dashboard:**  
   Junto ao botão *"Gerar relatório agora"*, é indicado explicitamente que a síntese é realizada por IA externa com base estrita em metadados.

### 5.2 Controlo Humano Obrigatório por Defeito
* Por defeito, todos os relatórios gerados por IA são guardados no estado `draft` (rascunho).
* O gestor da agência tem total liberdade para editar, adicionar ou remover qualquer frase antes de autorizar o envio ao cliente final.
* O modo de envio direto sem aprovação (`auto_send_enabled`) está desativado por omissão e só entra em vigor após ativação deliberada pelo profissional.

---

## 6. Portal do Cliente sem Login (Zero-Login Security)

O acesso do cliente final aos relatórios e métricas de sprint obedece às seguintes garantias:
* **Tokens UUIDv4 Não Adivinháveis:** Os links enviados por e-mail contêm identificadores únicos com 128 bits de entropia gerados criptograficamente.
* **Acesso Estritamente de Leitura (Read-Only):** O cliente final não tem capacidade de editar tarefas, aceder a painéis de configuração ou interagir com os repositórios GitHub.
* **Revogabilidade:** A agência pode a qualquer momento revogar ou regenerar o token de acesso de um cliente a partir do seu painel de controlo.

---

## 7. Conformidade e Contactos

Para esclarecimento de dúvidas sobre a recolha, tratamento e minimização de dados no ClientPulse AI, ou para solicitar a eliminação de dados de conta e integrações associadas, os utilizadores podem contactar a equipa técnica através do repositório oficial do projeto:
* **Repositório GitHub:** [cabrito33/ClientPulse-AI](https://github.com/cabrito33/ClientPulse-AI)
* **Documentação Técnica Relacionada:**
  - [docs/ARCHITECTURE.md](ARCHITECTURE.md)
  - [docs/PRD.md](PRD.md)
  - [docs/RELATORIO_VALIDACAO.md](RELATORIO_VALIDACAO.md)
