import { Facebook, Globe, MessageCircle, MessageSquare, Phone, type LucideIcon } from "lucide-react";
import type { Channel } from "./api";

export const CHANNEL_META: Record<Channel, { key: string; short: string; icon: LucideIcon; subtitle: string }> = {
  WhatsApp: { key: "whatsapp", short: "WhatsApp", icon: MessageCircle, subtitle: "WhatsApp Business" },
  "Facebook Messenger": { key: "messenger", short: "Messenger", icon: MessageSquare, subtitle: "Facebook Messenger" },
  "Facebook comment": { key: "comment", short: "FB comment", icon: Facebook, subtitle: "Comment on a Facebook post" },
  "Website form": { key: "web", short: "Website form", icon: Globe, subtitle: "biai.com.bd contact form" },
  "Phone call note": { key: "phone", short: "Call note", icon: Phone, subtitle: "Note typed after a phone call" },
};

export const firstName = (name: string) => name.replace(/\s*\(.*\)\s*$/, "");
