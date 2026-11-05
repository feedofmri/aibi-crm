export type Channel = "WhatsApp" | "Facebook Messenger" | "Facebook comment" | "Website form" | "Phone call note";

export interface Sample {
  id: string;
  channel: Channel;
  name: string;
  phone: string;
  message: string;
}

export interface ChannelInfo {
  channels: Channel[];
  ai: { mode: "live" | "rules"; provider: string | null };
  crmUrl: string;
  samples: Sample[];
}

export interface InboundResult {
  created: boolean;
  contact: {
    id: string;
    name: string;
    phone: string;
    program: string;
    route: "Sales" | "Support" | "Careers" | "Spam";
    language: string;
    messages: number;
    crmUrl: string;
  };
  analysis: { mode: "live" | "sample" | "heuristic" | "manual"; reason: string };
  reply: string;
}

const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const CHANNEL_KEY = import.meta.env.VITE_CHANNEL_KEY || "dev-channel-key";

export class ApiError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/channels${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Channel-Key": CHANNEL_KEY, ...init.headers },
    });
  } catch {
    throw new ApiError(`Can't reach the CRM at ${API_URL || "this site's /api"}. Is the server running?`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error?.message ?? `Request failed (${response.status}).`);
  return data as T;
}

export const channelApi = {
  info: () => call<ChannelInfo>("/info"),
  send: (input: { message: string; channel: Channel; name: string; phone: string }) =>
    call<InboundResult>("/inbound", { method: "POST", body: JSON.stringify(input) }),
};
