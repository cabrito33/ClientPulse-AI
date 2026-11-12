// ==============================================================================
// ClientPulse AI — Base de Conhecimento e FAQ (PRD & Arquitetura)
// File: supabase/functions/_shared/faq.ts
//
// PURPOSE:
// Fornece a base factual embutida em PT-PT para o assistente conversacional (PulseBot)
// e a lógica de resposta determinística em caso de indisponibilidade da IA.
//
// REGRAS:
// - Fiel ao PRD e docs de arquitetura.
// - Sem invenção de preços, métricas ou funcionalidades não existentes no MVP.
// - Trello, Notion, Jira e voz são identificados como evolução futura (fora do MVP).
// ==============================================================================

export const PRODUCT_KNOWLEDGE_BASE = `
CONTEXTO DO PRODUTO (CLIENTPULSE AI):
- O que é: Plataforma SaaS B2B que automatiza a geração e o envio de relatórios semanais de progresso para clientes de pequenas agências digitais e freelancers.
- Destinatários: Donos e gestores de pequenas agências (web, design, marketing) e consultores/freelancers independentes.
- Como funciona o fluxo:
  1. Conexão ao GitHub Projects (fonte de dados única do MVP).
  2. Geração automática por IA de um rascunho de relatório executivo em 3 blocos: Tarefas Concluídas, Bloqueios e Próximos Passos.
  3. Revisão e aprovação prévia pelo profissional no Dashboard (com opção de envio direto automático se ativada).
  4. Envio do relatório por e-mail ao cliente com link seguro para o Portal do Cliente.
- Privacidade e Segurança de Código:
  • O ClientPulse AI NUNCA lê, descarrega, analisa nem armazena código-fonte dos repositórios.
  • Apenas lê metadados dos cartões/issues do GitHub Projects: títulos, estados das colunas, etiquetas, responsáveis e datas.
  • Os tokens de acesso (PAT) do GitHub são cifrados com AES-GCM (256-bit) em repouso na base de dados.
- Portal do Cliente:
  • Acesso só de leitura, seguro e sem login (sem necessidade de conta ou palavra-passe para o cliente final).
  • O cliente acede através de um link com token individualizado incluído no e-mail semanal.
  • Apresenta o resumo da semana, histórico de relatórios e gráfico de tarefas concluídas por sprint/semana.
- Revisão Humana e IA:
  • Como qualquer modelo de IA generativa pode cometer imprecisões, o fluxo normal prevê sempre a revisão e afinação do rascunho pelo gestor antes de disparar o e-mail (a menos que o profissional ative conscientemente o envio direto).
- Agendamento:
  • Envio semanal por defeito (por exemplo, à sexta-feira), configurável por cliente.
- Âmbito do MVP vs. Evolução Futura:
  • MVP: Apenas integração com GitHub Projects (v2).
  • Evolução Futura (fora do MVP): Integrações com Trello, Notion e Jira.
  • Evolução Futura (fora do MVP): Reconhecimento ou síntese de voz no assistente e micro-aprovações formais no portal.
`.trim();

/**
 * Resposta determinística para FAQ quando o Gemini falha ou para testes de conformidade.
 * Analisa as palavras-chave da mensagem do utilizador e responde rigorosamente
 * com base na base de conhecimento oficial.
 */
export function getDeterministicFaqAnswer(
  userMessage: string,
  isConnected: boolean
): string {
  const norm = userMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Tentativa de avanço sem token / conexão válida
  if (
    /avanc|proximo|passo seguinte|continuar|pular|saltar|seguir/.test(norm) &&
    !isConnected
  ) {
    return 'Para avançar para o passo seguinte, precisamos primeiro de validar a ligação ao teu GitHub. Por favor, cola aqui o teu Personal Access Token (classic com permissão read:project) para listarmos os teus boards.';
  }

  // 2. O que é o ClientPulse AI
  if (
    /o que e|quem e|para que serve|clientpulse|sobre o produto|o que faz/.test(norm)
  ) {
    return 'O ClientPulse AI é uma plataforma SaaS B2B que automatiza a elaboração e envio de relatórios semanais de progresso a partir do GitHub Projects para clientes de agências e freelancers.';
  }

  // 3. Leitura de código / Privacidade
  if (/codigo|ler meu codigo|seguranca|privacidade|repositorio/.test(norm)) {
    return 'Não lemos nem guardamos qualquer código-fonte dos teus repositórios. O ClientPulse AI apenas acede aos metadados dos cartões do GitHub Projects (títulos, estados, etiquetas e responsáveis).';
  }

  // 4. Portal do cliente e necessidade de conta / login
  if (/conta|login|portal|password|palavra-passe|cliente precisa/.test(norm)) {
    return 'O teu cliente não precisa de criar conta nem de fazer login. O acesso ao Portal do Cliente é feito através de um link seguro com token exclusivo enviado por e-mail.';
  }

  // 5. Integrações de evolução futura (Trello, Notion, Jira)
  if (/trello|notion|jira|asana|clickup/.test(norm)) {
    return 'O suporte a ferramentas como Trello, Notion e Jira é uma evolução futura, fora do âmbito do MVP (que suporta exclusivamente o GitHub Projects).';
  }

  // 6. Voz / Voice bot
  if (/voz|falar|microfone|audio|speech/.test(norm)) {
    return 'A interação por voz no assistente é uma evolução futura, fora do âmbito do MVP.';
  }

  // 7. Preços ou custos (não existentes na documentação do MVP)
  if (/preco|custo|pagar|gratis|valor|mensalidade|plano/.test(norm)) {
    return 'Sou o assistente de onboarding e suporte técnico. Para informações comerciais, consulta os canais oficiais da plataforma.';
  }

  // 8. Questões claramente fora do âmbito (política, desporto, receitas, piadas, código genérico)
  if (
    /jogo|ganhou|futebol|benfica|porto|sporting|tempo|chuva|politica|governo|receita|piada|historia|javascript|python|css|html/.test(
      norm
    )
  ) {
    return 'Sou o assistente do ClientPulse AI e foco-me apenas em ajudar-te a configurar a tua conta e tirar dúvidas sobre a plataforma. Não consigo responder a questões fora deste âmbito. Vamos continuar a configuração?';
  }

  // 9. Resposta padrão orientada ao estado de onboarding
  if (!isConnected) {
    return 'Para começarmos, gera um Personal Access Token (classic) no GitHub com a permissão read:project (e repo se os teus repositórios forem privados) e cola-o aqui.';
  }

  return 'O teu GitHub já está conectado com sucesso! Podes agora selecionar o teu board e mapear as colunas no ecrã de onboarding.';
}
