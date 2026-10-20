import type { SprintMetric } from "./types";

/** DEMO DATA — sprint metrics per client, used by dashboard + portal charts. */
export const sprintMetrics: Record<string, SprintMetric[]> = {
  "atelier-mira": [
    { sprint: "S36", label: "Semana 36", completed: 3, planned: 6 },
    { sprint: "S37", label: "Semana 37", completed: 5, planned: 7 },
    { sprint: "S38", label: "Semana 38", completed: 4, planned: 6 },
    { sprint: "S39", label: "Semana 39", completed: 7, planned: 8 },
    { sprint: "S40", label: "Semana 40", completed: 5, planned: 7 },
    { sprint: "S41", label: "Semana 41", completed: 6, planned: 8 },
    { sprint: "S42", label: "Semana 42", completed: 7, planned: 9 },
  ],
  "clinica-vitalis": [
    { sprint: "S36", label: "Semana 36", completed: 6, planned: 8 },
    { sprint: "S37", label: "Semana 37", completed: 7, planned: 9 },
    { sprint: "S38", label: "Semana 38", completed: 5, planned: 8 },
    { sprint: "S39", label: "Semana 39", completed: 9, planned: 10 },
    { sprint: "S40", label: "Semana 40", completed: 7, planned: 9 },
    { sprint: "S41", label: "Semana 41", completed: 8, planned: 9 },
    { sprint: "S42", label: "Semana 42", completed: 9, planned: 11 },
  ],
  "mare-surf": [
    { sprint: "S35", label: "Semana 35", completed: 2, planned: 5 },
    { sprint: "S37", label: "Semana 37", completed: 4, planned: 6 },
    { sprint: "S39", label: "Semana 39", completed: 4, planned: 6 },
    { sprint: "S41", label: "Semana 41", completed: 5, planned: 7 },
  ],
  "fundacao-atica": [{ sprint: "S42", label: "Semana 42", completed: 2, planned: 4 }],
};

/** Sprint backlog cards used in the dashboard "Tarefas por sprint" panel. */
export interface SprintCard {
  id: string;
  title: string;
  column: "done" | "in_progress" | "blocked";
  clientId: string;
  label?: string;
}

export const sprintCards: SprintCard[] = [
  { id: "#142", title: "Galeria de projetos com filtros", column: "in_progress", clientId: "atelier-mira", label: "Frontend" },
  { id: "#139", title: "Formulário de contacto → e-mail", column: "done", clientId: "atelier-mira", label: "Integração" },
  { id: "#137", title: "Página inicial responsiva", column: "done", clientId: "atelier-mira", label: "Frontend" },
  { id: "#151", title: "Fotografias finais do portfólio", column: "blocked", clientId: "atelier-mira", label: "Conteúdo" },
  { id: "#208", title: "Módulo de marcação de consultas", column: "done", clientId: "clinica-vitalis", label: "Produto" },
  { id: "#211", title: "Certificado de produção — faturação", column: "blocked", clientId: "clinica-vitalis", label: "Externo" },
  { id: "#214", title: "Testes com pacientes reais", column: "in_progress", clientId: "clinica-vitalis", label: "QA" },
  { id: "#87", title: "Carrinho e checkout", column: "done", clientId: "mare-surf", label: "E-commerce" },
  { id: "#91", title: "Preços finais de três modelos", column: "blocked", clientId: "mare-surf", label: "Conteúdo" },
  { id: "#95", title: "Ligação ao stock do armazém", column: "in_progress", clientId: "mare-surf", label: "Integração" },
  { id: "#12", title: "Levantamento de requisitos", column: "done", clientId: "fundacao-atica", label: "Descoberta" },
  { id: "#16", title: "Fluxo de aprovação de candidaturas", column: "in_progress", clientId: "fundacao-atica", label: "Produto" },
];
