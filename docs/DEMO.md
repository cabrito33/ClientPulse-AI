# Roteiro de Demonstração (Demo Pitch — 5 Minutos) — ClientPulse AI

**Projeto:** ClientPulse AI — Relatórios Semanais de Progresso para Freelancers e Agências  
**Duração Alvo:** 5 minutos (Cronometrados)  
**Público-Alvo:** Júri Académico, Avaliadores Técnicos e Potenciais Clientes de Agências  
**Apresentador:** Responsável de Produto / Engenharia da Equipa  

> **Nota de rigor (17/11/2026):** Este é um guião de apresentação de funcionalidades do MVP, **não um relatório de resultados obtidos**. A issue [DO-03 #37](https://github.com/cabrito33/ClientPulse-AI/issues/37) está encerrada, mas não existem medições publicadas em [RESULTADOS.md](./RESULTADOS.md) que comprovem os dois ciclos de utilização real ou as metas de desempenho. Só afirmar que uma demonstração, entrega de e-mail ou meta foi concretizada quando isso for confirmado no ambiente usado. O CI bem-sucedido de 17/11 valida os checks técnicos, não as métricas de utilizadores.

---

## 1. Preparação Prévia da Demonstração (Checklist de Bastidores)

Antes de iniciar a contagem dos 5 minutos, garanta que tem as seguintes janelas/separadores preparados no navegador:

1. **Separador 1 (Aplicação):** Aberto em `/onboarding` (ou `/dashboard` para demonstrar o início).
2. **Separador 2 (GitHub Projects):** Aberto no quadro da equipa (`ProjectV2`), com tarefas visíveis em *Done*, *In Progress* e *Blocked*.
3. **Separador 3 (Caixa de Correio de Teste):** Aberta no webmail para onde o relatório será enviado.
4. **Separador 4 (Plano B / Backup):** Aberto num relatório já aprovado e no respetivo portal caso ocorra latência externa de rede.

---

## 2. Cronograma Minuto a Minuto e Guião Falado

```
00:00 ── 00:45  [Contextualização & O Problema da Sexta-Feira]
00:45 ── 01:45  [Onboarding Rápido com PulseBot & GitHub Projects]
01:45 ── 02:45  [Geração por IA & Privacidade Estrita]
02:45 ── 03:45  [Revisão Human-in-the-Loop, Aprovação & Disparo]
03:45 ── 04:30  [A Experiência do Cliente: Portal Zero Login]
04:30 ── 05:00  [Métricas: Objetivos e Estado da Validação & Encerramento]
```

---

### Minuto 00:00 – 00:45 | Introdução e o Problema da Sexta-Feira
- **Ecrã visível:** Ecrã inicial / Dashboard (`/dashboard`) ou slide de abertura.
- **Rota:** `/dashboard`

> **O que dizer (Script):**
> *"Muito boa tarde. Se trabalham em desenvolvimento de software ou gerem clientes numa agência, conhecem bem o pesadelo da sexta-feira à tarde. Os engenheiros fecham o sprint no GitHub, mas os clientes empresariais não querem ler commits ou pull requests. Querem saber: o que é que foi feito? O que é que está bloqueado? E o que vem a seguir?*  
> *Na pesquisa de mercado identificámos relatos de várias horas semanais gastas a compilar tarefas e a traduzir linguagem técnica para clientes; este esforço ainda não foi medido pela nossa equipa.*  
> *Apresento-vos o **ClientPulse AI**: uma plataforma SaaS que liga o GitHub Projects diretamente ao cliente final, transformando automaticamente cartões técnicos em relatórios executivos em linguagem clara, com revisão humana ou automação completa. Vamos ver como funciona em direto."*

---

### Minuto 00:45 – 01:45 | Onboarding Guiado e Mapeamento de Colunas
- **Ecrã visível:** Interface de Onboarding com o PulseBot.
- **Rota:** `/onboarding`

> **O que dizer (Script):**
> *"O onboarding foi desenhado para demorar menos de 5 minutos, com o auxílio do nosso assistente conversacional **PulseBot**.*  
> *Para ligar a agência, basta fornecer um Personal Access Token clássico do GitHub. Em segundos, o sistema consulta a API GraphQL e lista todos os quadros de projeto da organização.*  
> *Reparem nesta flexibilidade: cada equipa dá nomes diferentes às suas colunas — 'Concluído', 'Done', 'In QA'. O utilizador mapeia de forma visual as suas colunas para as três categorias fundamentais do produto: **Feito**, **Em Curso** e **Bloqueado**.*  
> *Criamos aqui o perfil do nosso cliente com o agendamento semanal — por exemplo, Sexta-feira às 09:00 UTC — e o sistema fica configurado para gerar o primeiro relatório. O tempo real do onboarding será avaliado nos testes."*  
> *(Nota técnica/compatibilidade: O assistente suporta comando de voz opcional. A voz funciona no Chrome, Edge e Safari; no Brave e no Firefox está indisponível).*

---

### Minuto 01:45 – 02:45 | Geração Inteligente por IA e Privacidade por Desenho
- **Ecrã visível:** Ficha do cliente (`/dashboard/clients/[id]`) e clique no botão **"Gerar relatório agora"**.
- **Rota:** `/dashboard/clients/[id]` $\rightarrow$ Transição para `/dashboard/reports/[id]`

> **O que dizer (Script):**
> *"Chegada a sexta-feira, o sistema dispara a geração. Vou simular o envio clicando em 'Gerar relatório agora'.*  
> *Neste momento, a nossa Edge Function no Supabase extrai exclusivamente os metadados dos cartões — títulos e estados. Quero sublinhar um princípio essencial de arquitetura e privacidade: **o ClientPulse AI nunca acede, lê ou armazena código-fonte dos repositórios**. Apenas metadados de gestão de tarefas.*  
> *O modelo Gemini recebe estes dados e sintetiza o progresso em três blocos executivos rigorosos em Português europeu: 'O que foi feito', 'Bloqueios e impedimentos' e 'Próximos passos'.*  
> *Vejam o resultado: tarefas técnicas foram convertidas numa síntese fluida, clara e compreensível para qualquer stakeholder de negócio."*

---

### Minuto 02:45 – 03:45 | Revisão Human-in-the-Loop, Edição e Disparo
- **Ecrã visível:** Ecrã de revisão e aprovação do relatório.
- **Rota:** `/dashboard/reports/[id]`

> **O que dizer (Script):**
> *"Acreditamos numa inteligência artificial que capacita o profissional sem retirar o controlo final. Este é o ecrã de revisão **Human-in-the-Loop**.*  
> *O gestor consulta o rascunho e pode revê-lo antes do envio. Suponhamos que quero acrescentar uma nota personalizada num dos tópicos — faço uma edição direta no texto. O sistema rastreia em segundo plano o número de edições e o tempo até à aprovação para a nossa telemetria de sucesso.*  
> *Estando tudo correto, basta um clique em **'Aprovar e Enviar'**.*  
> *O relatório é assinado, associado a um Magic Link seguro e enviado por e-mail através do serviço Resend, desde que o domínio/remetente e as credenciais estejam configurados."*

---

### Minuto 03:45 – 04:30 | A Experiência do Cliente: Portal Zero Login
- **Ecrã visível:** Notificação do e-mail recebido e clique no link que abre o Portal do Cliente.
- **Rota:** Caixa de correio $\rightarrow$ `/portal/[token]`

> **O que dizer (Script):**
> *"Vamos agora ver o lado do cliente. O cliente recebe este e-mail limpo e responsivo com o resumo executivo e um botão de acesso direto.*  
> *Ao clicar, o cliente entra no **Portal do Cliente** sem ter de memorizar uma palavra-passe, criar conta ou passar por fluxos de autenticação complicados.*  
> *O acesso é garantido por um token criptográfico único (`portal_tokens`) com validade de 90 dias e política fail-closed. Se o link for comprometido, o gestor pode revogá-lo com um clique no dashboard.*  
> *Aqui, o cliente consulta o relatório da semana, navega no histórico das semanas anteriores e visualiza o gráfico de métricas de entrega e velocidade dos sprints."*

---

### Minuto 04:30 – 05:00 | Objetivos de Métricas, Estado da Validação e Encerramento
- **Ecrã visível:** Regresso ao Dashboard (`/dashboard`) com foco no cartão **"Métricas de sucesso (MVP)"**.
- **Rota:** `/dashboard`

> **O que dizer (Script):**
> **O que dizer (Script):**
> *"Para fechar, o dashboard já permite acompanhar métricas do MVP. Definimos metas concretas no PRD: onboarding abaixo de cinco minutos, relatórios preparados em menos de dez minutos por cliente e pelo menos 80% das tarefas representadas corretamente. A implementação está acompanhada por testes automatizados e CI, mas **a validação destes objetivos em dois ciclos reais ainda precisa de evidências registadas** no nosso documento de resultados. Queremos apresentar o que foi construído e medir com transparência o que falta confirmar. Obrigado."*

**Se já existirem medições verificadas no dia da apresentação:** substituir a frase sobre validação pendente pelos valores reais, com amostra, data e fonte documentados em [RESULTADOS.md](./RESULTADOS.md). Não improvisar percentagens.

---

## 3. Plano B de Contingência (Se a Tecnologia Falhar em Direto)

Em demonstrações ao vivo podem ocorrer imprevistos de rede ou limitações transitórias de APIs de terceiros. Siga estas salvaguardas:

| Incidente em Direto | Causa Possível | Comportamento da Aplicação | Plano B do Apresentador (O que Fazer/Dizer) |
| :--- | :--- | :--- | :--- |
| **Geração de IA lenta (> 10s) ou erro de quota** | Latência na API Gemini da Google | A Edge Function ativa automaticamente o modelo de fallback ou o modo determinístico sem IA (`generated_without_ai = true`). | **Dizer:** *"Notem a resiliência da arquitetura: perante lentidão na rede neural, o sistema ativa um modo determinístico de segurança que garante a compilação estruturada das tarefas sem quebrar o serviço nem gerar erro 500."* Alternativamente, abra o separador com o relatório já gerado para continuar. |
| **Atraso na receção do e-mail** | Filtro de spam ou latência SMTP | E-mail fica temporariamente na fila de entrega | **Dizer:** *"Vamos confirmar o estado de envio no Resend. Se ainda não houver confirmação, mostro o relatório de teste previamente preparado, sem o apresentar como novo envio."* (Usar o botão de copiar link no dashboard). |
| **Falha de rede ou queda de ligação Wi-Fi** | Instabilidade de Internet na sala | Timeout nas chamadas de rede | Ter no ambiente local (`localhost:3000`) uma instância de demonstração pré-carregada ou vídeo de demonstração offline de 30 segundos em backup. |
| **Token do GitHub inválido / Rate limit** | Token PAT expirou ou atingiu limite de leitura | Erro na recolha do GraphQL | Utilizar uma conta de demonstração com mock local ou base de dados com dados de tarefas previamente carregados. |

---

## 4. Perguntas Prováveis da Avaliação (Q&A Estratégico)

1. **"O que acontece se o cliente reencaminhar o link do portal a terceiros?"**
   - *Resposta:* Os links são de leitura estrita (`SELECT`). Não permitem qualquer alteração de dados. Caso seja necessário invalidar o acesso, o gestor dispõe da ação **"Renovar link do portal"** no dashboard, que revoga o token anterior imediatamente (`is_active = false, revoked_at = now()`) e gera um novo endereço seguro.

2. **"Como garantem que o sistema não envia relatórios repetidos no agendamento automático?"**
   - *Resposta:* Implementámos uma camada rigorosa de **idempotência semanal** na função `dispatch-scheduled-reports` (`findExistingWeekReport`). Antes de qualquer processamento, o sistema verifica se já existe um relatório criado para aquele cliente na mesma semana ISO. Se existir, o envio é ignorado e registado como `skipped_duplicate`.

3. **"Qual é o impacto de privacidade ao ligar a conta do GitHub?"**
   - *Resposta:* Adotamos uma política de privilégio mínimo. O PAT apenas necessita de leitura no GitHub Projects. Não lemos código-fonte, branches ou commits dos repositórios. Todos os tokens PAT são cifrados em repouso com AES-256-GCM (`PAT_ENCRYPTION_KEY`) e nunca são expostos a utilizadores através de RLS com Column-Level Security.

4. **"Já provaram que o produto reduz o tempo de preparação em 80%?"**
   - *Resposta:* Ainda não dispomos de medições publicadas que sustentem essa percentagem. A redução de tempo é uma hipótese do PRD; a comparação terá de ser feita cronometrando o processo manual e com ClientPulse AI, no mesmo cenário, com os resultados e limitações registados em `docs/RESULTADOS.md`. O CI comprova testes técnicos, não impacto nos utilizadores.
