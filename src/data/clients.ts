import type { Client } from "./types";

/**
 * DEMO DATA — every client below is fictional and exists only to make the
 * prototype navigable. Do not present these as real customers anywhere.
 */
export const clients: Client[] = [
  {
    id: "atelier-mira",
    name: "Atelier Mira",
    company: "Atelier Mira · Arquitetura de Interiores",
    email: "joana@ateliermira.pt",
    language: "pt",
    tone: "formal",
    frequency: "weekly",
    sendDay: "Sexta-feira",
    sendTime: "17:00",
    autoSend: false,
    status: "active",
    portalToken: "demo-abc123",
    projectName: "Website 2026 — Atelier Mira",
    avatarInitials: "AM",
    startedAt: "2026-08-04",
  },
  {
    id: "clinica-vitalis",
    name: "Clínica Vitalis",
    company: "Clínica Vitalis · Saúde",
    email: "ricardo@clinicavitalis.pt",
    language: "pt",
    tone: "executivo",
    frequency: "weekly",
    sendDay: "Sexta-feira",
    sendTime: "18:00",
    autoSend: true,
    status: "active",
    portalToken: "demo-vitalis-77f",
    projectName: "Portal do Paciente — Fase 2",
    avatarInitials: "CV",
    startedAt: "2026-06-15",
  },
  {
    id: "mare-surf",
    name: "Maré Surf Co.",
    company: "Maré Surf Co. · Retalho",
    email: "hugo@maresurf.pt",
    language: "pt",
    tone: "descontraido",
    frequency: "biweekly",
    sendDay: "Quinta-feira",
    sendTime: "16:30",
    autoSend: false,
    status: "active",
    portalToken: "demo-mare-9k2",
    projectName: "Loja online — Shopify headless",
    avatarInitials: "MS",
    startedAt: "2026-09-01",
  },
  {
    id: "fundacao-atica",
    name: "Fundação Ática",
    company: "Fundação Ática · Cultura",
    email: "mariana@fundacaoatica.pt",
    language: "pt",
    tone: "formal",
    frequency: "weekly",
    sendDay: "Sexta-feira",
    sendTime: "12:00",
    autoSend: false,
    status: "onboarding",
    portalToken: "demo-atica-3px",
    projectName: "Plataforma de candidaturas",
    avatarInitials: "FA",
    startedAt: "2026-10-12",
  },
];

export const clientsById = Object.fromEntries(clients.map((c) => [c.id, c])) as Record<
  string,
  Client
>;
