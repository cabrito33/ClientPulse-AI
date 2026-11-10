import type { Report, ReportSection } from "./types";

/**
 * DEMO DATA — reports are fictional. Each body is deterministic so the
 * review editor and the client portal show consistent content.
 */

function bodyFrom(intro: string, s: ReportSection): string {
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return [
    intro,
    "",
    "## O que foi feito",
    bullets(s.done),
    "",
    "## Bloqueios e pontos de atenção",
    bullets(s.blocks),
    "",
    "## Próximos passos e decisões",
    bullets(s.next),
  ].join("\n");
}

const atelierThisWeek: ReportSection = {
  done: [
    "Página inicial concluída com nova grelha de portfólio e versão móvel.",
    "Formulário de contacto ligado ao e-mail do atelier e testado.",
    "Revisão de textos da página «Projetos» com a vossa equipa.",
  ],
  blocks: [
    "Faltam as fotografias finais de dois projetos (Casa do Lago e Loja Alfama) para fechar a galeria.",
  ],
  next: [
    "Publicar a versão de testes no endereço de pré-visualização esta segunda-feira.",
    "Decidir se mantemos o agendamento de visitas dentro do site ou por link externo.",
  ],
};

const vitalisThisWeek: ReportSection = {
  done: [
    "Módulo de marcação de consultas entregue e validado com a equipa de receção.",
    "Integração com o sistema de faturação concluída em ambiente de testes.",
    "Correção de seis erros reportados na semana anterior.",
  ],
  blocks: [
    "Aguarda-se resposta do fornecedor de faturação sobre o certificado de produção.",
    "Sem bloqueios do lado da equipa de desenvolvimento.",
  ],
  next: [
    "Testes com dez pacientes reais na terça-feira.",
    "Preparar a formação de 30 minutos para a equipa da clínica.",
  ],
};

const mareThisWeek: ReportSection = {
  done: [
    "Carrinho de compras redesenhado e ligado ao novo sistema de pagamentos.",
    "Página de produto com galeria de imagens e tamanhos disponíveis.",
  ],
  blocks: [
    "Faltam os preços finais de três modelos de fato de neoprene para publicar a loja.",
  ],
  next: [
    "Campanha de lançamento para a newsletter em preparação.",
    "Ligação das encomendas ao sistema de stock do armazém.",
  ],
};

const atelierPrev: ReportSection = {
  done: [
    "Estrutura do site aprovada e instalada no servidor de testes.",
    "Página «Sobre» com novo texto institucional.",
  ],
  blocks: ["Cedência de imagens do arquivo fotográfico pendente."],
  next: ["Início da página de portfólio.", "Definição do menu de navegação final."],
};

const vitalisPrev: ReportSection = {
  done: [
    "Ecrã de perfil do paciente com histórico de consultas.",
    "Notificações por e-mail para marcações confirmadas.",
  ],
  blocks: ["Integração de faturação à espera de credenciais do fornecedor."],
  next: ["Início do módulo de marcações.", "Revisão de acessibilidade do formulário."],
};

const marePrev: ReportSection = {
  done: ["Catálogo importado a partir da folha de cálculo da equipa.", "Página inicial em testes."],
  blocks: ["Fotografia de produto em falta para nove artigos."],
  next: ["Início do carrinho de compras.", "Configuração das entregas em Portugal continental."],
};

export const reports: Report[] = [
  {
    id: "rpt-atelier-w42",
    clientId: "atelier-mira",
    weekLabel: "Semana 42 · 12–16 out",
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    status: "pending_approval",
    subject: "Atelier Mira — progresso da semana 42",
    intro:
      "Boa tarde, Joana. Esta semana fechámos a página inicial e o formulário de contacto. O próximo passo é a galeria de projetos, que depende das fotografias finais.",
    sections: atelierThisWeek,
    body: bodyFrom(
      "Boa tarde, Joana. Esta semana fechámos a página inicial e o formulário de contacto. O próximo passo é a galeria de projetos, que depende das fotografias finais.",
      atelierThisWeek,
    ),
    tasksCompleted: 7,
    tasksPlanned: 9,
    generatedAt: "2026-10-16T09:00:00+01:00",
    sentAt: null,
    openedAt: null,
    authorNote: "Verificar se as fotografias chegam até quarta.",
  },
  {
    id: "rpt-vitalis-w42",
    clientId: "clinica-vitalis",
    weekLabel: "Semana 42 · 12–16 out",
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    status: "pending_approval",
    subject: "Clínica Vitalis — progresso da semana 42",
    intro:
      "Boa tarde, Dr. Ricardo. O módulo de marcações está entregue e validado pela receção. Falta apenas o certificado de produção do fornecedor de faturação para avançarmos.",
    sections: vitalisThisWeek,
    body: bodyFrom(
      "Boa tarde, Dr. Ricardo. O módulo de marcações está entregue e validado pela receção. Falta apenas o certificado de produção do fornecedor de faturação para avançarmos.",
      vitalisThisWeek,
    ),
    tasksCompleted: 9,
    tasksPlanned: 11,
    generatedAt: "2026-10-16T09:00:00+01:00",
    sentAt: null,
    openedAt: null,
  },
  {
    id: "rpt-mare-w41",
    clientId: "mare-surf",
    weekLabel: "Semana 41 · 5–9 out",
    periodStart: "2026-10-05",
    periodEnd: "2026-10-09",
    status: "pending_approval",
    subject: "Maré Surf Co. — progresso da semana 41",
    intro:
      "Olá Hugo! O carrinho ficou pronto e a página de produto está concluída. Para abrirmos a loja só faltam os preços de três modelos.",
    sections: mareThisWeek,
    body: bodyFrom(
      "Olá Hugo! O carrinho ficou pronto e a página de produto está concluída. Para abrirmos a loja só faltam os preços de três modelos.",
      mareThisWeek,
    ),
    tasksCompleted: 5,
    tasksPlanned: 7,
    generatedAt: "2026-10-09T09:00:00+01:00",
    sentAt: null,
    openedAt: null,
  },
  {
    id: "rpt-atelier-w41",
    clientId: "atelier-mira",
    weekLabel: "Semana 41 · 5–9 out",
    periodStart: "2026-10-05",
    periodEnd: "2026-10-09",
    status: "sent",
    subject: "Atelier Mira — progresso da semana 41",
    intro:
      "Boa tarde, Joana. A estrutura do site está aprovada e já está no servidor de testes. Esta semana avançámos com a página «Sobre» e preparámos o portfólio.",
    sections: atelierPrev,
    body: bodyFrom(
      "Boa tarde, Joana. A estrutura do site está aprovada e já está no servidor de testes. Esta semana avançámos com a página «Sobre» e preparámos o portfólio.",
      atelierPrev,
    ),
    tasksCompleted: 6,
    tasksPlanned: 8,
    generatedAt: "2026-10-09T09:00:00+01:00",
    sentAt: "2026-10-09T17:02:00+01:00",
    openedAt: "2026-10-09T18:41:00+01:00",
  },
  {
    id: "rpt-vitalis-w41",
    clientId: "clinica-vitalis",
    weekLabel: "Semana 41 · 5–9 out",
    periodStart: "2026-10-05",
    periodEnd: "2026-10-09",
    status: "sent",
    subject: "Clínica Vitalis — progresso da semana 41",
    intro:
      "Boa tarde, Dr. Ricardo. O ecrã de perfil do paciente está concluído e as notificações por e-mail já funcionam em ambiente de testes.",
    sections: vitalisPrev,
    body: bodyFrom(
      "Boa tarde, Dr. Ricardo. O ecrã de perfil do paciente está concluído e as notificações por e-mail já funcionam em ambiente de testes.",
      vitalisPrev,
    ),
    tasksCompleted: 8,
    tasksPlanned: 9,
    generatedAt: "2026-10-09T09:00:00+01:00",
    sentAt: "2026-10-09T18:01:00+01:00",
    openedAt: null,
  },
  {
    id: "rpt-mare-w39",
    clientId: "mare-surf",
    weekLabel: "Semana 39 · 21–25 set",
    periodStart: "2026-09-21",
    periodEnd: "2026-09-25",
    status: "sent",
    subject: "Maré Surf Co. — progresso da semana 39",
    intro:
      "Olá Hugo! O catálogo já está importado e a página inicial está em testes. Vamos agora avançar para o carrinho.",
    sections: marePrev,
    body: bodyFrom(
      "Olá Hugo! O catálogo já está importado e a página inicial está em testes. Vamos agora avançar para o carrinho.",
      marePrev,
    ),
    tasksCompleted: 4,
    tasksPlanned: 6,
    generatedAt: "2026-09-25T09:00:00+01:00",
    sentAt: "2026-09-25T16:31:00+01:00",
    openedAt: "2026-09-26T08:12:00+01:00",
  },
  {
    id: "rpt-atica-w42",
    clientId: "fundacao-atica",
    weekLabel: "Semana 42 · 12–16 out",
    periodStart: "2026-10-12",
    periodEnd: "2026-10-16",
    status: "draft",
    subject: "Fundação Ática — progresso da semana 42",
    intro:
      "Boa tarde, Dra. Mariana. Esta semana iniciámos o levantamento de requisitos da plataforma de candidaturas.",
    sections: {
      done: ["Sessão de arranque com a equipa da Fundação.", "Levantamento dos formulários atuais."],
      blocks: ["Falta confirmar quem aprova as candidaturas no fluxo interno."],
      next: ["Proposta de estrutura de dados para validação.", "Calendário de entregas."],
    },
    body: bodyFrom(
      "Boa tarde, Dra. Mariana. Esta semana iniciámos o levantamento de requisitos da plataforma de candidaturas.",
      {
        done: ["Sessão de arranque com a equipa da Fundação.", "Levantamento dos formulários atuais."],
        blocks: ["Falta confirmar quem aprova as candidaturas no fluxo interno."],
        next: ["Proposta de estrutura de dados para validação.", "Calendário de entregas."],
      },
    ),
    tasksCompleted: 2,
    tasksPlanned: 4,
    generatedAt: "2026-10-16T09:00:00+01:00",
    sentAt: null,
    openedAt: null,
  },
  {
    id: "rpt-vitalis-w40",
    clientId: "clinica-vitalis",
    weekLabel: "Semana 40 · 28 set–2 out",
    periodStart: "2026-09-28",
    periodEnd: "2026-10-02",
    status: "failed",
    subject: "Clínica Vitalis — progresso da semana 40",
    intro:
      "Boa tarde, Dr. Ricardo. Segue o resumo dos desenvolvimentos da semana 40.",
    sections: vitalisPrev,
    body: bodyFrom(
      "Boa tarde, Dr. Ricardo. Segue o resumo dos desenvolvimentos da semana 40.",
      vitalisPrev,
    ),
    tasksCompleted: 7,
    tasksPlanned: 9,
    generatedAt: "2026-10-02T09:00:00+01:00",
    sentAt: null,
    openedAt: null,
    errorMessage: "Falha na entrega de e-mail (Resend API): 422 Invalid recipient address.",
  },
];

export const reportsById = Object.fromEntries(reports.map((r) => [r.id, r])) as Record<
  string,
  Report
>;
