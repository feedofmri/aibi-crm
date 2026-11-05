export type Stage = "New" | "Contacted" | "Interested" | "Paid" | "Lost";
export type Queue = "Sales" | "Support" | "Careers" | "Spam";
export type Programme = "Bootcamp" | "Fellowship" | "Corporate training" | "Unspecified";
export type Language = "English" | "Bangla" | "Banglish";
export type Channel = "WhatsApp" | "Facebook Messenger" | "Facebook comment" | "Website form" | "Phone call note";
export type Role = "Admin" | "Admissions" | "Support" | "Sales";
export type DraftMode = "live" | "sample" | "heuristic" | "human-reviewed" | "manual";
export type AnalysisMode = "live" | "sample" | "heuristic" | "manual";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Message {
  id: string;
  text: string;
  channel: Channel;
  receivedAt: string;
  sourceId: string;
  sender: string;
  phone: string;
}

export interface ActivityEntry {
  id: number;
  action: string;
  author: string;
  at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  program: Programme;
  route: Queue;
  language: Language;
  status: Stage;
  supportStatus: "Open" | "Resolved";
  priority: "Normal" | "Urgent";
  owner: string;
  notes: string;
  nextAction: string;
  nextFollowUp: string;
  lastContactAt: string;
  receivedAt: string;
  draft: string;
  draftMode: DraftMode;
  analysisReason: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  activity: ActivityEntry[];
}

export type LeadChanges = Partial<
  Pick<
    Lead,
    | "name"
    | "phone"
    | "program"
    | "route"
    | "language"
    | "status"
    | "supportStatus"
    | "priority"
    | "owner"
    | "notes"
    | "nextAction"
    | "nextFollowUp"
    | "draft"
  >
>;

export interface Sample {
  id: string;
  channel: Channel;
  name: string;
  phone: string;
  message: string;
  receivedAt: string;
}

export interface Meta {
  stages: Stage[];
  routes: Queue[];
  programs: Programme[];
  languages: Language[];
  channels: Channel[];
  roles: Role[];
  followUpHours: number;
  ai: { mode: "live" | "rules"; provider: string | null; model: string | null };
  database: string;
  /** The separately hosted channel simulator website. */
  simulatorUrl: string;
  samples: Sample[];
}

export interface Analysis {
  name: string;
  phone: string;
  program: Programme;
  route: Queue;
  language: Language;
  reason: string;
  reply: string;
  mode: AnalysisMode;
}

export interface IntakeInput {
  message: string;
  channel: Channel;
  name: string;
  phone: string;
}

export interface AutomationJob {
  id: string;
  status: "Processing" | "Pending" | "Completed" | "Approved" | "Rejected" | "Failed";
  mode: "manual" | "automatic";
  input: IntakeInput & { sourceId?: string };
  result: Analysis | null;
  reasons: string[];
  error: string;
  leadId: string;
  createdAt: string;
  completedAt: string;
}

export interface WeeklyReport {
  period: { start: string; end: string; endDate: string };
  totals: {
    messages: number;
    contacts: number;
    sales: number;
    support: number;
    careers: number;
    spam: number;
    overdueNow: number;
  };
  programmes: Record<Programme, number>;
  supportCases: { id: string; name: string; status: string; priority: string }[];
  priorities: string[];
  mode: "live" | "rules";
  notice: string;
  generatedAt: string;
}
