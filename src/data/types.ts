/**
 * Domain types for ClientPulse AI.
 *
 * These mirror the future Supabase schema (see docs/DECISIONS.md):
 * profiles, clients, reports, sprint_metrics, portal_tokens.
 */

export type ReportStatus = "draft" | "pending_approval" | "sent" | "scheduled" | "failed";

export type ClientLanguage = "pt" | "en";
export type ClientTone = "formal" | "executivo" | "descontraido";
export type SendFrequency = "weekly" | "biweekly" | "monthly";

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  language: ClientLanguage;
  tone: ClientTone;
  frequency: SendFrequency;
  sendDay: string;
  sendTime: string;
  autoSend: boolean;
  status: "active" | "paused" | "onboarding";
  portalToken: string;
  projectName: string;
  avatarInitials: string;
  startedAt: string;
}

export interface ReportSection {
  done: string[];
  blocks: string[];
  next: string[];
}

export interface Report {
  id: string;
  clientId: string;
  weekLabel: string;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  subject: string;
  intro: string;
  sections: ReportSection;
  /** Raw text the professional can edit in the review screen. */
  body: string;
  tasksCompleted: number;
  tasksPlanned: number;
  generatedAt: string;
  sentAt: string | null;
  openedAt: string | null;
  authorNote?: string;
  errorMessage?: string | null;
  generatedWithoutAi?: boolean;
}

export interface SprintMetric {
  sprint: string;
  label: string;
  completed: number;
  planned: number;
}

export interface DashboardSummary {
  pending: number;
  sentThisMonth: number;
  activeClients: number;
  avgCompletionRate: number;
  timeSavedHours: number;
  failed?: number;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  quickReplies?: string[];
}
