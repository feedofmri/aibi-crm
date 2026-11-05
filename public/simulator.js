// BIAI Inbound Channel Simulator Script
import { icons } from "./icons.js";

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

let activeChannel = "WhatsApp";
let autoReply = true;
let lastLead = null;

const PRESETS = {
  rafi: {
    name: "Rafi Ahmed",
    phone: "01711000001",
    channel: "WhatsApp",
    message: "Assalamualaikum, apnader 3 day bootcamp er price koto? Payment kibhabe korbo?",
  },
  tahmina: {
    name: "Tahmina Akter",
    phone: "",
    channel: "Facebook Messenger",
    message: "ফেলোশিপ প্রোগ্রামে ভর্তি হতে চাই। কবে শুরু হবে?",
  },
  mahmud: {
    name: "Mahmud Hasan",
    phone: "01711000003",
    channel: "WhatsApp",
    message: "We are a 40-person textile company in Gazipur looking for corporate AI training this month.",
  },
  habibur: {
    name: "Habibur Rahman",
    phone: "01711000015",
    channel: "Phone call note",
    message: "Caller wants to cancel his enrolment and get his money back. Very upset. Said he will post about it on Facebook if not solved today.",
  },
  job: {
    name: "Arif Hossain",
    phone: "01711000019",
    channel: "Website form",
    message: "Looking for a job as an AI intern. Where do I apply?",
  },
  spam: {
    name: "Marketing Bot",
    phone: "",
    channel: "Facebook comment",
    message: "Special discount on automated SEO and social followers! Check link in bio.",
  },
};

const CHANNEL_CONFIG = {
  WhatsApp: {
    class: "channel-whatsapp",
    title: "BIAI Admissions",
    sub: "WhatsApp Business Account · Online",
    avatar: () => icons.whatsapp("header-icon"),
  },
  "Facebook Messenger": {
    class: "channel-messenger",
    title: "BIAI Admissions",
    sub: "Facebook Messenger · Active Now",
    avatar: () => icons.messenger("header-icon"),
  },
  "Facebook comment": {
    class: "channel-comment",
    title: "BIAI Page Post",
    sub: "Public Post Comments · Automated Sync",
    avatar: () => icons.comment("header-icon"),
  },
  "Website form": {
    class: "channel-web",
    title: "BIAI Live Support",
    sub: "Website Admissions Widget · Online",
    avatar: () => icons.globe("header-icon"),
  },
  "Phone call note": {
    class: "channel-phone",
    title: "Admissions Phone Call Note",
    sub: "Inbound Staff Call Intake",
    avatar: () => icons.phone("header-icon"),
  },
};

function toast(text) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3500);
}

function setChannel(channel) {
  activeChannel = channel;
  const cfg = CHANNEL_CONFIG[channel] || CHANNEL_CONFIG["WhatsApp"];

  // Update body class
  document.body.className = "simulator-body " + cfg.class;

  // Update buttons
  document.querySelectorAll(".channel-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.channel === channel);
  });

  // Update header
  $("#chat-header-name").textContent = cfg.title;
  $("#chat-header-sub").textContent = cfg.sub;
  $("#header-avatar").innerHTML = cfg.avatar();
  $("#current-channel-pill").textContent = channel;
}

function appendMessage({ text, isOutgoing, author, time, isTicks = true }) {
  const box = $("#chat-messages");
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble " + (isOutgoing ? "outgoing" : "incoming");

  const stamp = time || new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
  });

  bubble.innerHTML = `
    ${author ? `<div class="msg-author">${esc(author)}</div>` : ""}
    <div class="msg-text">${esc(text)}</div>
    <div class="msg-meta">
      <span>${stamp}</span>
      ${isOutgoing && isTicks ? `<span class="msg-ticks">${icons.doubleCheck("msg-tick-svg")}</span>` : ""}
    </div>
  `;

  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
}

function updateTelemetry(data) {
  $("#telemetry-empty").hidden = true;
  $("#telemetry-content").hidden = false;

  const dot = $("#sim-telemetry-dot");
  if (dot) dot.hidden = false;

  const lead = data.lead;
  const analysis = data.analysis;

  $("#res-route").textContent = lead.route;
  $("#res-program").textContent = lead.program;
  $("#res-language").textContent = lead.language;
  $("#res-stage").textContent = lead.status;

  $("#res-name").textContent = lead.name;
  $("#res-phone").textContent = lead.phone || "(Not provided)";
  $("#res-id").textContent = lead.id;
  $("#res-thread-type").textContent = data.isNewLead
    ? "New Lead Created in PostgreSQL"
    : `Existing Thread Merged (${lead.messages.length} messages)`;

  const routeColors = {
    Sales: "#2b6e3f",
    Support: "#a43726",
    Careers: "#83550f",
    Spam: "#706a63",
  };
  $("#res-route").style.color = routeColors[lead.route] || "#222222";

  $("#res-reason").textContent = analysis.reason || lead.notes || "Standard inquiry";
  $("#res-reply").textContent = data.reply || lead.draft || "(No reply required)";

  const crmLink = $("#view-crm-btn");
  if (crmLink) {
    crmLink.href = `/?lead=${lead.id}`;
    crmLink.innerHTML = `Open ${esc(lead.name)} in Admissions Pipeline &rarr;`;
  }
}

async function handleSendMessage(e) {
  if (e) e.preventDefault();
  const input = $("#message-input");
  const text = input.value.trim();
  if (!text) return;

  const name = $("#sender-name").value.trim() || "Prospective Student";
  const phone = $("#sender-phone").value.trim();

  // Clear input
  input.value = "";

  // 1. Render student message
  appendMessage({
    text,
    isOutgoing: true,
    author: name,
    isTicks: true,
  });

  // 2. Show typing indicator if autoReply
  if (autoReply) {
    $("#typing-indicator").hidden = false;
    $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight;
  }

  try {
    const res = await fetch("/api/simulator/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: activeChannel,
        name,
        phone,
        message: text,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to process inbound message.");

    lastLead = data.lead;

    // 3. Render simulated BIAI reply after brief natural pause
    if (autoReply) {
      setTimeout(() => {
        $("#typing-indicator").hidden = true;
        appendMessage({
          text: data.reply || "Thank you for contacting BIAI. An admissions officer will follow up shortly.",
          isOutgoing: false,
          author: "BIAI Admissions",
          isTicks: false,
        });
      }, 700);
    }

    // 4. Update Telemetry
    updateTelemetry(data);
    toast(`Inbound message synced to PostgreSQL: ${data.lead.name} (${data.lead.route})`);
  } catch (err) {
    $("#typing-indicator").hidden = true;
    toast("Error: " + err.message);
  }
}

function switchMobileView(viewName) {
  const layout = $(".sim-layout");
  if (!layout) return;
  layout.dataset.view = viewName;
  document.querySelectorAll("[data-tab-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tabView === viewName);
  });
  if (viewName === "telemetry") {
    const dot = $("#sim-telemetry-dot");
    if (dot) dot.hidden = true;
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Mobile View Switcher
  document.querySelectorAll("[data-tab-view]").forEach((btn) => {
    btn.onclick = () => switchMobileView(btn.dataset.tabView);
  });

  // Channel switches
  document.querySelectorAll(".channel-btn").forEach((btn) => {
    btn.onclick = () => {
      setChannel(btn.dataset.channel);
      // Auto switch to chat on mobile when channel selected
      if (window.innerWidth <= 1024) switchMobileView("chat");
    };
  });

  // Auto-reply checkbox
  const autoReplyBox = $("#auto-reply-toggle");
  if (autoReplyBox) {
    autoReplyBox.onchange = (e) => {
      autoReply = e.target.checked;
    };
  }

  // Preset Application Engine
  function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    $("#sender-name").value = p.name;
    $("#sender-phone").value = p.phone;
    setChannel(p.channel);
    $("#message-input").value = p.message;
    $("#message-input").focus();
    toast(`Loaded scenario: ${p.name}`);
    if (window.innerWidth <= 1024) switchMobileView("chat");
  }

  const presetSelect = $("#preset-select");
  const loadPresetBtn = $("#load-preset-btn");
  if (presetSelect && loadPresetBtn) {
    loadPresetBtn.onclick = () => applyPreset(presetSelect.value);
    presetSelect.onchange = () => applyPreset(presetSelect.value);
  }

  document.querySelectorAll(".preset-chip-btn, .preset-chip").forEach((chip) => {
    chip.onclick = () => {
      const key = chip.dataset.preset;
      if (presetSelect) presetSelect.value = key;
      applyPreset(key);
    };
  });

  // Form submission
  $("#chat-form").onsubmit = handleSendMessage;

  // Enter to send (Shift+Enter for newline)
  $("#message-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
});
