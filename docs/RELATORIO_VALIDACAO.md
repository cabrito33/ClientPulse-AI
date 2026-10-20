Relatório de Validação de Mercado e Problema: ClientPulse AI — Relatórios Semanais de Progresso para Freelancers e Agências
1. Definição do Produto / Serviço
O ClientPulse AI é uma plataforma SaaS B2B que automatiza a geração e o envio de relatórios de progresso semanais para freelancers e agências. Liga-se ao GitHub Projects (única fonte de dados no MVP), lê as tarefas concluídas, os bloqueios e os próximos passos da semana e, com IA, escreve um relatório em linguagem simples, de negócio. Integrações com outras ferramentas (Trello, Notion, Jira) ficam fora do MVP.
O envio é agendado (por defeito, semanalmente), com revisão e aprovação do relatório pelo profissional antes de seguir para o cliente, ou envio direto, se este o preferir. O cliente recebe um e-mail com o resumo e uma ligação segura para o Portal do Cliente, onde consulta o relatório atual, o histórico e métricas simples de tarefas concluídas por semana. O profissional dispõe de um dashboard para gerir os relatórios pendentes de aprovação, os relatórios enviados e o estado dos clientes. Um assistente conversacional (chatbot/voice bot) guia o onboarding e responde a dúvidas de utilização.
1.1 Quem usa o produto
•	Freelancer ou agência (utilizador): liga o GitHub Projects, configura os clientes (frequência, tom e idioma do relatório), revê e aprova o rascunho gerado por IA e consulta o dashboard.
•	Cliente final (destinatário): recebe o relatório por e-mail e consulta o Portal do Cliente através de uma ligação segura; é uma vista só de leitura, sem edição de tarefas nem gestão do projeto.
•	Assistente conversacional (chatbot/voice bot): apoia o utilizador no onboarding (ligação ao GitHub, mapeamento de colunas, criação do primeiro cliente) e responde a dúvidas sobre agendamentos, edição de relatórios e métricas.
2. Declaração do Problema (Problem Statement)
A comunicação de progresso consome tempo não faturável a freelancers e agências (estimativa do grupo: cerca de 2 a 3 horas por semana para um freelancer, e mais numa agência, sem medição própria; um relato de uma agência de 4 pessoas aponta mais de 3 horas numa semana só a responder a pedidos de ponto de situação de três clientes [9]), mas a falta de atualizações estruturadas continua a gerar desconfiança no cliente, pedidos constantes de ponto de situação e risco de perda de projetos.
•	Quem tem o problema: freelancers seniores (desenvolvimento web, design, consultoria, marketing) que gerem vários clientes em simultâneo e, em segundo lugar, donos e gestores de pequenas agências digitais (2 a 10 colaboradores).
•	Quando e onde ocorre: tipicamente no final ou no início da semana, de forma fragmentada através de e-mails longos, mensagens de WhatsApp, canais de Slack e reuniões de alinhamento.
•	Principais dores: perda de tempo a compilar dados de várias ferramentas; dificuldade em traduzir trabalho técnico em valor visível de negócio; clientes ansiosos que perguntam "em que ponto estamos?".
3. Validação e Racional Estratégico
A. Porque Isto Importa
Impacto no Cliente / Profissional
•	Impacto diário: segundo o Asana Anatomy of Work Index 2021 (inquérito do próprio fornecedor a mais de 13.000 trabalhadores do conhecimento), cerca de 60% do tempo de trabalho vai para "trabalho sobre trabalho", como reuniões de ponto de situação, procura de informação e mudança entre aplicações [4]. É um dado geral, não específico de freelancers e agências, por isso serve de contexto e não como medição do problema.
•	Consequências de não resolver: a ausência de visibilidade gera desconfiança, e o cliente tende a pedir reuniões frequentes e a questionar o ritmo de entrega. As estimativas sobre perda de clientes variam muito: uma fonte do setor indica que cerca de 57% dos clientes que saem de uma agência apontam má comunicação e falta de transparência [6], e outra cita um inquérito (UpCity) em que seriam 80% [5]. Essa mesma fonte refere outro inquérito (SetUp, 2025) em que a insatisfação com a entrega aparece como principal motivo (48%) [5], e um terceiro texto indica que cerca de 40% das marcas tendem a mudar de agência nos primeiros seis meses [7]. Trata-se de fontes secundárias (blogs e artigos do setor) que não foram confirmadas nos inquéritos originais; devem ser lidas como indicação de que a comunicação é um fator importante, não como percentagem exata.
•	Segmentos mais afetados: pequenas equipas e freelancers independentes, onde cada hora gasta em tarefas administrativas reduz diretamente a margem.
Impacto no Negócio e Mercado
•	Tamanho do mercado: o mercado global de software de gestão de projetos é estimado entre cerca de 8 e 12 mil milhões de dólares (2024 a 2026) e a crescer entre 12% e 15% ao ano, consoante a empresa de análise: Fortune Business Insights indica 11,91 mil milhões de USD em 2025 [1]; SkyQuest indica 8,0 mil milhões em 2024 e 12,2% de crescimento anual até 2033 [2]; Mordor Intelligence indica 11,27 mil milhões em 2026 e 15,42% de crescimento anual até 2031 [3]. É um mercado mais amplo do que o nosso: o segmento de relatórios para clientes de agências e freelancers é apenas uma parte, que não está quantificada nestas fontes.
•	Custo económico do problema (exemplo ilustrativo, com pressupostos do grupo): um freelancer que fature 40 €/hora e gaste 3 horas por semana a escrever relatórios, durante 48 semanas, perde cerca de 5.760 € por ano em capacidade faturável (3 h × 40 € × 48). Numa agência que gaste 10 horas por semana em relatórios, o valor equivalente é de cerca de 19.200 € por ano (10 h × 40 € × 48).
•	Valor potencial da solução: a meta do projeto é reduzir o tempo de preparação de relatórios de mais de 2 horas por semana para menos de 5 minutos por cliente, recuperando capacidade de faturação e aumentando a confiança do cliente através de transparência regular. Esta meta será medida com o GitHub Project da própria equipa (secção 4).
B. Evidências e Hipóteses a Validar
•	Relato de um freelancer (Indie Hackers): um freelancer descreve que os clientes lhe escreviam três vezes por semana a perguntar "onde está o meu projeto?", que partilhar o quadro interno do Notion piorou a situação (os clientes não percebiam tarefas técnicas e faziam mais perguntas) e que o que faltava era uma vista em linguagem do cliente: fase atual, o que está a acontecer e o que vem a seguir [8]. É um relato individual, mas descreve exatamente o problema que o projeto quer resolver.
•	Relato de uma agência (DEV Community): o autor, dono de uma agência de 4 pessoas, descreve que passou dois anos sem enviar atualizações e que numa só semana, com três clientes, gastou mais de três horas a responder a mensagens de ponto de situação que um resumo de 5 minutos à sexta-feira teria evitado. Propõe um relatório semanal em três partes [9].
•	Perspetiva do cliente (A List Apart): um artigo escrito por quem passou a ser cliente de freelancers defende atualizações regulares e que, mesmo quando o cliente pode ver o trabalho (por exemplo, os commits), é preciso indicar-lhe o que deve observar e o que mudou [10].
•	Soluções já existentes na mesma direção: existem produtos pequenos que seguem o mesmo princípio de relatório em três partes (progresso, bloqueios e próximos passos), como o Briefd, em que o profissional preenche manualmente esses campos e a ferramenta formata e envia [15]. Isto confirma que o problema é reconhecido; a nossa diferença é recolher esses dados automaticamente do GitHub Projects, redigi-los com IA em linguagem de negócio e entregá-los também num portal dedicado ao cliente.
•	Não verificado: não foram encontrados threads específicos do Reddit (r/freelance, r/agency) com dados fiáveis, por isso não são usados como evidência.
•	Validação própria prevista: usar o GitHub Project da própria equipa como caso de uso real, gerando relatórios semanais a partir dele e medindo o tempo de preparação e a qualidade dos relatórios (ver secção 4). A evidência atual provém de fontes públicas; entrevistas ou inquéritos a freelancers são um passo seguinte.
C. Contexto Estratégico e Tendências
•	Maturação de modelos de IA (LLMs): é viável converter tarefas concluídas, bloqueios e próximos passos registados no GitHub Projects num texto executivo claro, legível por um decisor de negócio, em português e com tom configurável. Requer revisão humana, por isso a aprovação do profissional antes do envio (ver secção 7).
•	Trabalho assíncrono e remoto: uma parte relevante dos trabalhadores remotos prefere trabalhar de forma maioritariamente assíncrona (37% no Buffer State of Remote Work 2023, citado por um agregador de estatísticas [16]), o que favorece atualizações escritas e estruturadas em vez de reuniões pontuais.
•	Fragmentação de software: as equipas usam várias ferramentas em simultâneo (Figma, GitHub, Notion, ClickUp). O cliente tende a não querer abrir vários links para perceber o estado global de um projeto.
•	Assistentes conversacionais: a interação por texto ou voz com LLMs permite guiar o utilizador na configuração inicial, reduzindo a necessidade de documentação ou formação. É uma hipótese de produto a validar nos testes de usabilidade (secção 4).
4. Métricas de Sucesso e Critérios de Falha
A. Métricas do Projeto Académico (mensuráveis)
•	Tempo até ao primeiro relatório: ligar o GitHub Project e gerar o primeiro relatório em menos de 5 minutos, com a ajuda do assistente de onboarding.
•	Onboarding assistido: mais de 85% dos utilizadores de teste completam a ligação ao GitHub e a criação do primeiro cliente, na primeira sessão, com a ajuda do assistente conversacional.
•	Qualidade do relatório: relatório com as três secções (concluídas, bloqueios, próximos passos), em que pelo menos 80% das tarefas concluídas estão refletidas corretamente, validado por revisão manual sobre o Project da equipa; pelo menos 80% dos rascunhos são aprovados com menos de 3 edições manuais.
•	Automação e fiabilidade: envio semanal agendado a funcionar em pelo menos dois ciclos semanais reais, com aprovação prévia e com envio direto, sem falhas na leitura da API do GitHub nem no envio de e-mail.
•	Dashboard e Portal do Cliente: o dashboard do profissional mostra, com dados reais, os relatórios pendentes de aprovação, os enviados e o estado dos clientes; o Portal do Cliente mostra o relatório atual, o histórico e as tarefas concluídas por semana.
•	Tempo de preparação: menos de 5 minutos por cliente e por semana, incluindo a revisão do relatório.
B. Indicadores de Produto (fase comercial, hipóteses a longo prazo)
•	Retenção ativa semanal: mais de 50% dos utilizadores a gerar relatórios todas as semanas após o primeiro mês.
•	Taxa de leitura do cliente final: mais de 70% de abertura do e-mail ou de acesso ao Portal do Cliente nas 24 horas seguintes ao envio.
•	Qualitativo: diminuição comprovada de mensagens intermédias de clientes a pedir pontos de situação.
C. Sinais de Falha (Critérios para Parar ou Pivotar)
•	Qualidade (projeto): se os relatórios gerados exigirem edição pesada na maioria dos casos, a síntese por IA não está a poupar tempo e é preciso rever prompts, dados de entrada ou o formato.
•	Onboarding assistido (projeto): se menos de metade dos utilizadores de teste conseguir ligar o GitHub sem ajuda humana, o assistente não está a reduzir a fricção e o fluxo tem de ser simplificado.
•	Conversão de gratuito para pago (produto): conversão inferior a 2% após 500 utilizadores ativos indica que a disposição para pagar por uma ferramenta isolada é insuficiente.
•	Retenção (produto): retenção inferior a 20% ao fim de 4 semanas sinaliza que o produto não criou o hábito semanal.
•	Rejeição do cliente final: se os clientes continuarem a exigir e-mails convencionais em texto simples, o formato de entrega introduz demasiada fricção.
5. Público-Alvo
Os valores de disposição para pagar abaixo são hipóteses de partida, com base nos preços da concorrência (secção 6), e ainda não foram testados com utilizadores.
Segmento Principal: Freelancers e Consultores Seniores
•	Perfil: especialistas independentes (desenvolvimento web, design, consultoria, marketing) que gerem em simultâneo entre 2 e 5 clientes de ticket médio-alto.
•	Comportamento atual: escrevem resumos manuais ou gravam vídeos curtos todas as semanas, com desgaste frequente na gestão de expectativas; usam ferramentas como o GitHub Projects para organizar o trabalho.
•	Valores e motivações: recuperar tempo faturável, transmitir profissionalismo e manter o controlo sobre o que é enviado ao cliente.
•	Disposição para pagar (hipótese): entre 15 € e 29 € por mês (plano individual).
Segmento Secundário: Pequenas Agências / Gestores de Projeto
•	Perfil: agências de desenvolvimento, design ou marketing digital com 2 a 10 colaboradores.
•	Comportamento atual: usam ferramentas como GitHub Projects, ClickUp, Asana ou Linear internamente, mas preparam e-mails manuais ou apresentações semanais para os clientes; procuram justificar avenças mensais e proteger a equipa de interrupções constantes.
•	Disposição para pagar (hipótese): entre 49 € e 99 € por mês (plano agência), justificado pelas horas poupadas.
6. Panorama Competitivo
Preços em dólares (USD), consultados a 12/10/2026 nas páginas oficiais dos produtos, quando disponíveis, ou em análises de terceiros. Mudam com frequência e variam com o tipo de faturação (anual ou mensal), por isso devem ser confirmados antes de qualquer decisão.
A. Soluções Existentes
•	Plataformas de métricas de marketing (ex.: AgencyAnalytics, DashThis)
–	Pontos fortes: automação forte de números e métricas (Google Ads, Analytics, SEO).
–	Pontos fracos: focadas em números e gráficos; tratam pouco as tarefas qualitativas, o contexto técnico e as decisões de design.
–	Preço: AgencyAnalytics cobra cerca de 20 USD por cliente/mês com faturação anual (25 USD com faturação mensal) [11]; DashThis começa por volta de 44 a 49 USD/mês [12].
•	Portais completos de clientes (ex.: Copilot, que segundo análises de terceiros passou a chamar-se Assembly em 2025, e ManyRequests)
–	Pontos fortes: muito configuráveis; centralizam faturação, ficheiros e pedidos.
–	Pontos fracos: configuração complexa; exigem que o cliente crie conta e gira mais uma palavra-passe; não resumem o progresso automaticamente.
–	Preço: o Copilot tem planos de 39 USD/mês (Starter, com 50 clientes e 1 utilizador interno) a 399 USD/mês (Advanced), com faturação anual [13]; o ManyRequests começa em cerca de 59 USD/mês (Core) e 99 USD/mês (Pro), com alguns comparadores a listar também um plano inicial mais barato [14].
•	Acessos de convidado em ferramentas internas (ex.: ClickUp, Asana, Trello, GitHub Projects)
–	Pontos fortes: custo adicional nulo ou incluído no plano base; dados em tempo real.
–	Pontos fracos: podem expor notas internas e micro-tarefas da equipa; confundem clientes não técnicos; raramente são consultados por executivos.
–	Preço típico: incluído na licença da ferramenta.
•	Ferramentas de atualização de estado para freelancers (ex.: Briefd)
–	Pontos fortes: formato simples e consistente de progresso, bloqueios e próximos passos, com envio ao cliente [15].
–	Pontos fracos: o profissional continua a preencher os campos à mão; não recolhe os dados das ferramentas de gestão.
–	Preço: não confirmado nas fontes consultadas.
•	Modelos e agentes de IA em ferramentas generalistas (ex.: Notion, Taskade)
–	Pontos fortes: flexíveis, já usados por muitas equipas e permitem resumir tarefas com IA dentro da própria ferramenta.
–	Pontos fracos: exigem configuração manual de modelos e prompts, dependem de uma única ferramenta e não oferecem, por si só, fluxo de aprovação, envio agendado e portal dedicado ao cliente (análise do grupo, ainda não testada).
–	Preço: não analisado nesta versão.
•	Processo manual (e-mail, Google Docs, Loom)
–	Pontos fortes: flexível, personalizado e direto.
–	Pontos fracos: trabalho repetitivo todas as semanas; sem histórico centralizado de relatórios enviados.
–	Preço típico: gratuito em custo direto, mas com custo elevado em tempo não faturado.
B. Falhas de Mercado (Gaps)
•	Fricção de autenticação: os portais tradicionais exigem que o cliente crie e gira mais credenciais de acesso. O ClientPulse AI procura reduzir esta fricção enviando o relatório por e-mail com uma ligação segura para o Portal do Cliente.
•	Falta de contexto qualitativo: as ferramentas analíticas mostram gráficos, mas explicam pouco o que foi feito, o que bloqueia e o que vem a seguir.
•	Ausência de síntese executiva: as plataformas de tarefas apresentam listas longas de afazeres técnicos em vez de um resumo curto para quem decide.
•	Onboarding e configuração complexos: as ferramentas de portal e de relatórios exigem configuração manual extensa; um assistente conversacional pode guiar o setup (hipótese a validar nos testes de usabilidade).
C. Fatores de Diferenciação
MVP (âmbito do projeto)
•	Síntese por IA em três blocos: tarefas concluídas, bloqueios e próximos passos (com as ações pedidas ao cliente), a partir do GitHub Projects, em linguagem simples, com idioma (ex.: português) e tom (formal ou informal) configuráveis por cliente.
•	Envio semanal agendado, sem o profissional ter de se lembrar de o fazer.
•	Revisão e aprovação antes do envio: por defeito, o profissional revê e edita o rascunho antes de seguir para o cliente; pode optar por envio direto, sem paragem.
•	Dashboard do profissional com relatórios pendentes de aprovação, relatórios enviados e estado dos clientes.
•	Portal do Cliente: página dedicada, acedida por ligação segura enviada por e-mail, com o relatório atual, o histórico de relatórios e gráficos simples de tarefas concluídas por semana.
•	Assistente conversacional (chatbot/voice bot): onboarding guiado (ligação ao GitHub, mapeamento de colunas, criação do primeiro cliente) e apoio contínuo a dúvidas de utilização.
Evolução futura (fora do MVP)
•	Outras fontes de dados: integração com Trello, Notion, Jira e outras ferramentas de gestão de tarefas.
•	Micro-aprovações do cliente: mecanismo no relatório para o cliente validar entregas com um clique, criando um histórico auditável de decisões.
Dois tipos de aprovação (para evitar confusão)
Tipo de aprovação	Quem aprova	Estado
Aprovação do relatório antes do envio	Profissional ou agência	MVP (revisão por defeito, com envio direto opcional)
Micro-aprovação de entregas	Cliente final	Evolução futura

7. Riscos e Limitações
•	Erros ou invenções da IA: o texto pode ser impreciso ou incluir informação que não existe nas tarefas. Mitigação: revisão do profissional antes do envio, relatório baseado apenas nos dados recolhidos e testes de qualidade (secção 4).
•	Privacidade dos dados do cliente: o conteúdo das tarefas é enviado a um modelo de IA externo. Mitigação: ler e enviar apenas os dados estritamente necessários, não armazenar código-fonte, evitar dados sensíveis e informar o utilizador.
•	Qualidade dos dados de origem: tarefas mal descritas ou desatualizadas dão relatórios pobres. Mitigação: boas práticas de preenchimento do Project e avisos quando faltam dados.
•	Segurança de credenciais: tokens do GitHub (OAuth ou Personal Access Token), chaves de IA e credenciais de e-mail devem ficar em variáveis de ambiente ou secrets, nunca no repositório.
•	Fiabilidade do envio agendado: falhas no agendamento ou no e-mail devem ser registadas e permitir novo envio.
•	Custo e limites das APIs: o uso de IA (incluindo voz) e da API do GitHub tem custos e limites de pedidos que condicionam a frequência e o volume.
•	Assistente conversacional: o chatbot/voice bot pode dar respostas incorretas ou incompletas e acrescenta custo e complexidade (reconhecimento e síntese de voz). Mitigação: limitar o assistente ao onboarding e às dúvidas de utilização, com respostas baseadas na documentação do produto, e testá-lo na fase de usabilidade.
•	Acesso ao Portal do Cliente: o relatório contém informação sobre o projeto de um cliente. Mitigação: ligações seguras e não adivinháveis, acesso só de leitura e possibilidade de revogar o acesso.
8. Fontes
Todas consultadas a 12/10/2026. Nota sobre fiabilidade: várias são fontes secundárias (blogs, agregadores) ou inquéritos feitos por empresas com interesse comercial no tema. Quando possível, o grupo deve confirmar os números na fonte original.
[1] Fortune Business Insights (via HackerNoon), Project Management Software Market: Growth Trends & Forecast 2026–2034. https://hackernoon.com/preview/6abe2ded3ba47f9d49c94ccb (relatório: https://www.fortunebusinessinsights.com/project-management-software-market-116360)
[2] SkyQuest (via GII), Project Management Software Market Size, Share, and Growth Analysis, 2026–2033. https://giikorea.co.kr/report/sky1899850-project-management-software-market-size-share.html
[3] VoxBooster, Project Management Software Statistics 2026 (cita Mordor Intelligence, 2026). https://voxbooster.com/blog/project-management-software-statistics-2026
[4] Asana, Anatomy of Work Index 2021 (comunicado de imprensa, Business Wire, 14/01/2021). https://www.businesswire.com/news/home/20210114005374/en
[5] Swydo, What to Say to Clients When the Marketing Data Looks Bad (01/06/2026; cita UpCity e SetUp Marketing Relationship Survey 2025). https://www.swydo.com/blog/what-to-say-to-clients-when-the-data-looks-bad/
[6] DesignRush News, Why Production-Focused Agencies Lose Clients They Never Should. https://news.designrush.com/why-overfocusing-production-causes-agencies-lose-clients
[7] Duda, Warning signs your SMB client might churn (cita SetUp Marketing Relationship Survey). https://blog.duda.co/warning-signs-your-smb-client-might-churn-and-how-to-keep-them
[8] Indie Hackers, Show IH: I built a "pizza tracker" for freelance client projects. https://www.indiehackers.com/post/show-ih-i-built-a-pizza-tracker-for-freelance-client-projects-db1651b693
[9] DEV Community, The Client Status Update System That Saves Agencies 3 Hours Every Week. https://dev.to/lisasakura/the-client-status-update-system-that-saves-agencies-3-hours-every-week-10id
[10] A List Apart, Lessons Learned by Being the Client. https://alistapart.com/column/lessons-learned-by-being-the-client/
[11] AgencyAnalytics, página de preços (https://agencyanalytics.com/pricing) e DashThis, comparação com AgencyAnalytics (valores, junho de 2026). https://dashthis.com/alternatives/agency-analytics/
[12] RFP.wiki, AgencyAnalytics vs DashThis (preços do DashThis). https://www.rfp.wiki/marketing/marketing-dashboards/agencyanalytics/dashthis
[13] Copilot, guia de planos. https://copilot.app/guide/plans (mudança de nome para Assembly: https://agiled.app/blog/copilot-review)
[14] Capterra, ManyRequests: preços e avaliações. https://www.capterra.com/p/10042668/ManyRequests
[15] Briefd (listagem no Product Hunt, via Hunted). https://hunted.space/product/briefd
[16] StealthAgents, Remote Work Async Communication Statistics 2026 (cita Buffer, State of Remote Work 2023). https://stealthagents.com/resear
