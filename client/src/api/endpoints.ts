import type {
  Analysis,
  AutomationJob,
  IntakeInput,
  Lead,
  LeadChanges,
  Meta,
  Programme,
  Queue,
  Language,
  Role,
  User,
  WeeklyReport,
  AnalysisMode,
} from "@/types";
import { request } from "./http";

export const authApi = {
  me: () => request<{ user: User }>("/auth/me").then((r) => r.user),
  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { method: "POST", body: { email, password } }).then((r) => r.user),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

export const metaApi = {
  get: () => request<Meta>("/meta"),
};

export const usersApi = {
  list: () => request<{ users: User[] }>("/users").then((r) => r.users),
  create: (input: { name: string; email: string; password: string; role: Role }) =>
    request<{ user: User }>("/users", { method: "POST", body: input }).then((r) => r.user),
};

export const leadsApi = {
  list: () => request<{ leads: Lead[] }>("/leads").then((r) => r.leads),
  update: (id: string, changes: LeadChanges) =>
    request<{ lead: Lead }>(`/leads/${id}`, { method: "PATCH", body: changes }).then((r) => r.lead),
  logContact: (id: string) =>
    request<{ lead: Lead }>(`/leads/${id}/contact`, { method: "POST" }).then((r) => r.lead),
  draftReply: (id: string) =>
    request<{ lead: Lead }>(`/leads/${id}/draft`, { method: "POST" }).then((r) => r.lead),
  remove: (id: string) => request<void>(`/leads/${id}`, { method: "DELETE" }),
};

export interface SaveIntakeInput extends IntakeInput {
  program: Programme;
  route: Queue;
  language: Language;
  reply: string;
  reason: string;
  mode: AnalysisMode;
  sourceId?: string;
}

export const intakeApi = {
  analyze: (input: IntakeInput) =>
    request<{ analysis: Analysis }>("/intake/analyze", { method: "POST", body: input }).then((r) => r.analysis),
  save: (input: SaveIntakeInput) =>
    request<{ lead: Lead; created: boolean }>("/intake", { method: "POST", body: input }),
};

export const automationApi = {
  get: () => request<{ settings: { mode: "manual" | "automatic" }; jobs: AutomationJob[] }>("/automation"),
  setMode: (mode: "manual" | "automatic") =>
    request<{ settings: { mode: "manual" | "automatic" } }>("/automation/settings", { method: "PUT", body: { mode } }),
  process: (input: IntakeInput) =>
    request<{ job: AutomationJob }>("/automation/jobs", { method: "POST", body: input }).then((r) => r.job),
  review: (id: string, action: "approve" | "reject", changes?: Partial<Analysis>) =>
    request<{ job: AutomationJob }>(`/automation/jobs/${id}/review`, {
      method: "POST",
      body: { action, changes: changes ?? {} },
    }).then((r) => r.job),
};

export const reportsApi = {
  weekly: (end: string) =>
    request<{ report: WeeklyReport }>(`/reports/weekly?end=${encodeURIComponent(end)}`).then((r) => r.report),
};

export const adminApi = {
  resetDemo: () => request<{ imported: number }>("/admin/reset-demo", { method: "POST" }),
};
