import { icons } from "./icons.js";

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let boardMode = "board";
let state,
  view = "pipeline",
  query = "",
  route = "Sales",
  program = "",
  ownerFilter = "",
  selected = "",
  intakeResult = null,
  cleanContact = "";
const practice =
  new URLSearchParams(location.search).get("workspace") === "practice";
const initials = (n) =>
  n
    .split(/[\s(]+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
const fmt = (d) =>
  new Date(d).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const localDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
function due(l) {
  return (
    !(l.route === "Support" && l.supportStatus === "Resolved") &&
    !["Paid", "Lost"].includes(l.status) &&
    !["Spam", "Careers"].includes(l.route) &&
    (l.nextFollowUp
      ? Date.parse(l.nextFollowUp) < Date.now()
      : Date.now() - Date.parse(l.lastContactAt || l.receivedAt) >= 172800000)
  );
}
function dueLabel(l) {
  if (!due(l))
    return l.route === "Support" && l.supportStatus === "Resolved"
      ? "Resolved"
      : l.nextFollowUp
        ? fmt(l.nextFollowUp)
        : ["Paid", "Lost"].includes(l.status) ||
            ["Spam", "Careers"].includes(l.route)
          ? "Not applicable"
          : "Within 48h";
  const deadline = l.nextFollowUp
    ? Date.parse(l.nextFollowUp)
    : Date.parse(l.lastContactAt || l.receivedAt) + 172800000;
  const hours = Math.max(1, Math.floor((Date.now() - deadline) / 3600000));
  return hours >= 24
    ? Math.floor(hours / 24) + " days overdue"
    : hours + " hours overdue";
}
function flags(l) {
  return [
    ...(!l.phone ? ["Missing phone"] : []),
    ...(l.program === "Unspecified" && l.route === "Sales"
      ? ["Clarify programme"]
      : []),
  ];
}
let currentUser = null;
const TOKEN_KEY = "biai_crm_token";
const USER_KEY = "biai_crm_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  currentUser = user;
  updateUserUI();
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  currentUser = null;
  updateUserUI();
}

function updateUserUI() {
  if (!currentUser) {
    if ($("#sidebar-user-name")) $("#sidebar-user-name").textContent = "Sign In";
    if ($("#sidebar-user-role")) $("#sidebar-user-role").textContent = "Guest";
    if ($("#sidebar-avatar")) $("#sidebar-avatar").textContent = "??";
    if ($("#topbar-avatar")) $("#topbar-avatar").textContent = "??";
    return;
  }
  const init = initials(currentUser.name || currentUser.email);
  if ($("#sidebar-user-name")) $("#sidebar-user-name").textContent = currentUser.name;
  if ($("#sidebar-user-role")) $("#sidebar-user-role").textContent = currentUser.role || "Admissions";
  if ($("#sidebar-avatar")) $("#sidebar-avatar").textContent = init;
  if ($("#topbar-avatar")) $("#topbar-avatar").textContent = init;
}

async function initAuth() {
  const token = getToken();
  if (token) {
    try {
      const res = await api("auth/me");
      currentUser = res.user;
      updateUserUI();
      return;
    } catch {
      clearAuth();
    }
  }
  // Auto-login as default Admin BIAI for seamless initial load
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@biai.com.bd", password: "Admin123!" }),
    });
    if (res.ok) {
      const data = await res.json();
      setAuth(data.token, data.user);
    }
  } catch {}
}

function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
async function api(path, method = "GET", data) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(
    "/api/" + path + (practice ? "?workspace=practice" : ""),
    {
      method,
      headers,
      ...(data ? { body: JSON.stringify(data) } : {}),
    },
  );
  const value = await res.json();
  if (res.status === 401) {
    openAuthDialog();
    throw new Error(value.error || "Authentication required.");
  }
  if (!res.ok) throw new Error(value.error || "Something went wrong.");
  return value;
}
async function reload() {
  state = await api("state");
  render();
}
const option = (items, value, blank) =>
  `${blank ? `<option value="">${blank}</option>` : ""}` +
  items
    .map((x) => `<option ${x === value ? "selected" : ""}>${esc(x)}</option>`)
    .join("");
function render() {
  const titles = {
    automation: [
      "Automation & verification",
      "Choose how enquiries are processed and review exceptions.",
    ],
    pipeline: [
      "Sales pipeline",
      "Track enquiries by stage and manage follow-ups.",
    ],
    enquiries: ["All enquiries", "Search contacts and review message history."],
    followups: ["Follow-ups", "Overdue enquiries and scheduled follow-ups."],
    insights: [
      "Weekly brief",
      "Enquiry volume and outstanding work for a chosen week.",
    ],
  };
  $("#metrics").hidden = ["automation", "insights"].includes(view);
  $("#page-title").textContent = titles[view][0];
  $("#page-subtitle").textContent = titles[view][1];
  $("#breadcrumb").textContent = {
    automation: "Automation",
    pipeline: "Pipeline",
    enquiries: "All enquiries",
    followups: "Follow-ups",
    insights: "Weekly brief",
  }[view];
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => { b.classList.toggle("active", b.dataset.view === view); if(b.dataset.view === view) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  $("#review-count").textContent =
    state.jobs.filter((j) => j.status === "Pending").length || "";
  $("#nav-count").textContent = state.stats.sales;
  $("#due-count").textContent = state.stats.overdue;
  if ($("#db-mode")) {
    $("#db-mode").textContent = state.isPg ? "PostgreSQL" : "SQLite";
    $("#db-mode").title = state.db;
    $("#db-mode").className = "mode-pill " + (state.isPg ? "live" : "");
  }
  $("#mode").textContent =
    state.mode === "live" ? `AI live · ${state.ai.provider}` : "No AI key · rule-based";
  $("#mode").className = "mode-pill " + (state.mode === "live" ? "live" : "");
  $("#date").textContent = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  
  const overdueCount = state.stats.overdue;
  const pendingCount = state.jobs.filter((j) => j.status === "Pending").length;
  if (overdueCount > 0 && view === "followups") {
    $("#mode-banner").hidden = false;
    $("#mode-banner").innerHTML = `<span><strong>${overdueCount} contact${overdueCount === 1 ? "" : "s"}</strong> need follow-up: no logged contact for 48 hours, or a scheduled follow-up is due.</span>`;
  } else if (pendingCount > 0 && view === "automation") {
    $("#mode-banner").hidden = false;
    $("#mode-banner").innerHTML = `<span><strong>${pendingCount} enquir${pendingCount === 1 ? "y is" : "ies are"}</strong> waiting for review before saving.</span>`;
  } else {
    $("#mode-banner").hidden = true;
    $("#mode-banner").innerHTML = "";
  }
  updateUserUI();
  $("#metrics").innerHTML = [
    [
      "Contacts",
      state.stats.total,
      `from ${state.stats.messages} enquiries`,
      "all",
    ],
    [
      "Sales pipeline",
      state.stats.sales,
      "in the sales queue",
      "sales",
    ],
    [
      "Follow-ups due",
      state.stats.overdue,
      "48-hour rule or scheduled date",
      "followups",
    ],
    [
      "Support cases",
      state.stats.support,
      "payment and cancellation issues",
      "support",
    ],
  ]
    .map(
      ([label, n, sub, action], i) =>
        `<article class="metric ${i === 2 ? "warm" : ""}" data-metric-nav="${action}" role="button" tabindex="0" title="Show ${label.toLowerCase()}"><div>${label}</div><strong>${n}</strong><small>${sub}</small></article>`,
    )
    .join("");

  document.querySelectorAll("[data-metric-nav]").forEach((card) => {
    card.onclick = () => {
      const act = card.dataset.metricNav;
      if (act === "all") {
        query = ""; route = ""; program = ""; ownerFilter = ""; render();
      } else if (act === "sales") {
        view = "pipeline"; route = "Sales"; render();
      } else if (act === "followups") {
        view = "followups"; render();
      } else if (act === "support") {
        view = "enquiries"; route = "Support"; render();
      }
    };
  });

  if (view === "automation") {
    renderAutomation();
    return;
  }
  if (view === "insights") {
    renderInsights();
    return;
  }
  $("#content").innerHTML =
    `
    <div class="filters">
      <div class="filter-inputs">
        <label class="search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="search" type="search" aria-label="Search enquiries" placeholder="Search enquiries…" value="${esc(query)}">
        </label>
        <select id="route-filter" aria-label="Filter by queue">${option(["Sales", "Support", "Careers", "Spam"], route, "All queues")}</select>
        <select id="program-filter" aria-label="Filter by programme">${option(state.programs, program, "All programmes")}</select>
        <select id="owner-filter" aria-label="Filter by owner"><option value="">All owners</option><option value="__unassigned" ${ownerFilter === "__unassigned" ? "selected" : ""}>Unassigned</option>${option([...new Set(state.leads.map((l) => l.owner).filter(Boolean))], ownerFilter)}</select>
        <button id="clear-filters" type="button" title="Reset all search filters">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
          <span>Reset filters</span>
        </button>
      </div>
      <div class="filter-actions">
        <span class="result-count" id="result-count"></span>
        ${view === "pipeline" ? `<div class="view-toggle" aria-label="Pipeline display"><button id="board-view" aria-pressed="${boardMode === "board"}">Board</button><button id="list-view" aria-pressed="${boardMode === "list"}">List</button></div>` : ""}
      </div>
    </div>
    <div id="results"></div>`;
  if($("#board-view")) { $("#board-view").onclick=()=>{boardMode="board";render();}; $("#list-view").onclick=()=>{boardMode="list";render();}; }
  $("#clear-filters").onclick=()=>{query="";route=view==="pipeline"?"Sales":"";program="";ownerFilter="";render();};
  $("#owner-filter").addEventListener("change", (e) => {
    ownerFilter = e.target.value;
    renderResults();
  });
  $("#search").addEventListener("input", (e) => {
    query = e.target.value;
    renderResults();
  });
  $("#route-filter").addEventListener("change", (e) => {
    route = e.target.value;
    renderResults();
  });
  $("#program-filter").addEventListener("change", (e) => {
    program = e.target.value;
    renderResults();
  });
  renderResults();
}
function filtered() {
  return state.leads.filter(
    (l) =>
      (!route || l.route === route) &&
      (!program || l.program === program) &&
      (!ownerFilter ||
        (ownerFilter === "__unassigned"
          ? !l.owner
          : l.owner === ownerFilter)) &&
      JSON.stringify([l.name, l.phone, l.notes, l.messages.map((m) => m.text)])
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (view !== "followups" || due(l)),
  );
}
function nextStage(stage) {
  const idx = state.stages.indexOf(stage);
  return idx >= 0 && idx < state.stages.length - 1 ? state.stages[idx + 1] : null;
}

function card(l) {
  const channel = l.messages.at(-1).channel;
  const next = nextStage(l.status);
  const cleanPhone = l.phone ? l.phone.replace(/\D/g, "") : "";
  const waPhone = cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone;
  const waMsg = encodeURIComponent(
    l.draft || `Assalamualaikum ${l.name}, BIAI team here regarding your enquiry.`,
  );
  return `<div class="lead-card" draggable="true" data-lead="${l.id}" role="button" tabindex="0">
    <div class="card-top">
      <span class="channel-chip">${icons.channel(channel)} <span>${esc(channel)}</span></span>
      ${l.messages.length > 1 ? `<span class="thread-count">${l.messages.length} msgs</span>` : ""}
      <span class="card-more" title="Open contact">${icons.external()}</span>
    </div>
    <div class="contact-row">
      <span class="avatar contact-avatar">${esc(initials(l.name))}</span>
      <h3 title="${esc(l.name)}">${esc(l.name.split(" (")[0])}</h3>
    </div>
    <span class="programme ${l.program === "Unspecified" ? "unspecified" : ""}">${esc(l.program === "Unspecified" ? "Programme to confirm" : l.program)}</span>
    <p class="message-preview">${esc(l.messages.at(-1).text)}</p>
    <div class="card-flags">${flags(l).map((f) => `<span>${esc(f)}</span>`).join("")}</div>
    <div class="card-bottom">
      <span class="card-due ${due(l) ? "overdue" : ""}">${due(l) ? `${icons.clock()} ${dueLabel(l)}` : l.nextFollowUp ? fmt(l.nextFollowUp) : fmt(l.receivedAt)}</span>
      <span class="card-owner" title="Assigned Owner">${esc(l.owner || "Unassigned")}</span>
    </div>
    <div class="card-actions">
      ${cleanPhone ? `<a class="card-action-btn wa-btn" href="https://wa.me/880${waPhone}?text=${waMsg}" target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp" data-wa="${l.id}">${icons.whatsapp()} <span>WhatsApp</span></a>` : ""}
      ${cleanPhone ? `<a class="card-action-btn call-btn" href="tel:${cleanPhone}" title="Call ${esc(cleanPhone)}" onclick="event.stopPropagation()">${icons.phone()} <span>Call</span></a>` : ""}
      ${next ? `<button class="card-action-btn advance-btn" data-advance="${l.id}" data-next="${next}" title="Move to ${next}"><span>${next}</span> ${icons.arrowRight()}</button>` : ""}
    </div>
  </div>`;
}

function initKanbanDragDrop() {
  document.querySelectorAll(".lead-card").forEach((cardEl) => {
    cardEl.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", cardEl.dataset.lead);
      e.dataTransfer.effectAllowed = "move";
      cardEl.classList.add("dragging");
    });
    cardEl.addEventListener("dragend", () => {
      cardEl.classList.remove("dragging");
      document.querySelectorAll(".column-body").forEach((c) => c.classList.remove("drag-over"));
    });
  });

  document.querySelectorAll(".column-body").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove("drag-over");
    });
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const leadId = e.dataTransfer.getData("text/plain");
      const targetStage = col.dataset.stage;
      const lead = state.leads.find((x) => x.id === leadId);
      if (lead && lead.status !== targetStage) {
        lead.status = targetStage;
        if (targetStage === "Contacted" && lead.status === "New") {
          lead.lastContactAt = new Date().toISOString();
        }
        await api("leads/" + leadId, "PATCH", { status: targetStage });
        await reload();
        toast(`Moved ${lead.name} to ${targetStage}`);
      }
    });
  });
}

function renderResults() {
  const leads = filtered();
  $("#result-count").textContent = leads.length + " contacts";
  if (view === "pipeline" && boardMode === "board") {
    $("#results").innerHTML = `<div class="board">${state.stages
      .map((s, i) => {
        const items = leads.filter((l) => l.status === s);
        return `<section class="column" data-stage="${s}"><div class="column-heading"><span class="stage-dot stage-${i}"></span><h3>${s}</h3><span class="count">${items.length}</span></div><div class="column-body" data-stage="${s}">${items.map(card).join("") || '<div class="empty-column"><span class="empty-placeholder">No active enquiries</span></div>'}</div></section>`;
      })
      .join("")}</div>`;
    initKanbanDragDrop();
  } else {
    const sorted =
      view === "followups"
        ? [...leads].sort(
            (a, b) =>
              (a.priority === "Urgent" ? -2 : a.route === "Support" ? -1 : 0) -
                (b.priority === "Urgent"
                  ? -2
                  : b.route === "Support"
                    ? -1
                    : 0) ||
              Date.parse(a.lastContactAt || a.receivedAt) -
                Date.parse(b.lastContactAt || b.receivedAt),
          )
        : leads;
    $("#results").innerHTML = sorted.length
      ? `<div class="table-wrap"><table><thead><tr><th>Contact</th><th>Programme / queue</th><th>Stage</th><th>Last enquiry</th><th>Follow-up</th><th>Actions</th></tr></thead><tbody>${sorted.map((l) => {
          const cleanPhone = l.phone ? l.phone.replace(/\D/g, "") : "";
          const waPhone = cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone;
          const waMsg = encodeURIComponent(l.draft || `Assalamualaikum ${l.name}, BIAI team here.`);
          return `<tr>
            <td><button class="table-contact" data-lead="${l.id}"><span class="avatar">${esc(initials(l.name))}</span><span><strong>${esc(l.name)}</strong><small>${esc(l.phone || "Phone not provided")}</small></span></button></td>
            <td>${esc(l.program)}<small>${esc(l.route)} · ${l.messages.length} message${l.messages.length > 1 ? "s" : ""}</small></td>
            <td><span class="stage-badge">${esc(l.route === "Support" ? l.supportStatus || "Open" : l.status)}</span>${l.priority === "Urgent" ? "<small class=urgent>Urgent</small>" : ""}</td>
            <td>${fmt(l.receivedAt)}</td>
            <td><span class="${due(l) ? "overdue" : ""}">${esc(dueLabel(l))}</span><small>${esc(l.owner || "Unassigned")} · ${esc(l.nextAction || "Set next action")}</small></td>
            <td>
              <div class="row-actions">
                ${view === "followups" ? `<button class="quick-contact-btn" data-quick-contact="${l.id}" title="Log completed contact">${icons.check()} <span>Log contact</span></button>` : ""}
                ${cleanPhone ? `<a class="icon-link-btn" href="https://wa.me/880${waPhone}?text=${waMsg}" target="_blank" rel="noopener noreferrer" title="Chat on WhatsApp" aria-label="WhatsApp ${esc(l.name)}">${icons.whatsapp()}</a>` : `<span class="icon-link-btn placeholder" title="No phone number" aria-hidden="true"></span>`}
                <button class="icon-button" data-lead="${l.id}" aria-label="Open ${esc(l.name)}">${icons.external()}</button>
              </div>
            </td>
          </tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="empty-state">${icons.check()}<h3>No matching enquiries</h3><p>Try another queue or clear your filters.</p></div>`;
  }

  document.querySelectorAll("[data-lead]").forEach((b) =>
    b.addEventListener("click", (e) => {
      if (e.target.closest(".card-actions") || e.target.closest(".row-actions")) return;
      openLead(b.dataset.lead);
    }),
  );

  document.querySelectorAll("[data-advance]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.advance;
      const next = btn.dataset.next;
      const lead = state.leads.find((x) => x.id === id);
      if (!lead) return;
      await api("leads/" + id, "PATCH", { status: next });
      await reload();
      toast(`Advanced ${lead.name} to ${next}`);
    });
  });

  document.querySelectorAll("[data-wa]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = link.dataset.wa;
      const lead = state.leads.find((x) => x.id === id);
      if (lead && lead.status === "New") {
        setTimeout(async () => {
          if (confirm(`WhatsApp opened for ${lead.name}. Mark status as Contacted?`)) {
            await api("leads/" + id + "/contact", "POST", {});
            await reload();
            toast(`Marked ${lead.name} as Contacted.`);
          }
        }, 500);
      }
    });
  });

  document.querySelectorAll("[data-quick-contact]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.quickContact;
      const lead = state.leads.find((x) => x.id === id);
      await api("leads/" + id + "/contact", "POST", {});
      await reload();
      toast(`Contact logged for ${lead?.name || "enquiry"}. Overdue alert cleared.`);
    });
  });
}

function formFields(l, prefix = "edit") {
  const teamOptions = (state.team || []).map(u => `<option value="${esc(u.name)}">${esc(u.role)}</option>`).join("");
  return `<div class="form-grid"><h3 class="form-section-title">Contact details</h3><label>Name<input name="name" value="${esc(l.name || "")}" required maxlength="200"></label><label>Phone<input name="phone" value="${esc(l.phone || "")}" placeholder="Not provided" inputmode="tel"></label><label>Programme<select name="program">${option(state.programs, l.program || "Unspecified")}</select></label><label>Queue<select name="route">${option(state.routes, l.route || "Sales")}</select></label><label>Language<select name="language">${option(state.languages, l.language || "English")}</select></label>${prefix === "edit" ? `<h3 class="form-section-title">Follow-up & ownership</h3><label>Sales stage<select name="status">${option(state.stages, l.status)}</select></label><label data-support-field ${l.route !== "Support" ? "hidden" : ""}>Support case<select name="supportStatus">${option(["Open", "Resolved"], l.supportStatus || "Open")}</select></label><label>Priority<select name="priority">${option(["Normal", "Urgent"], l.priority || "Normal")}</select></label><label>Next action<input name="nextAction" value="${esc(l.nextAction || "")}" placeholder="What should happen next?"></label><label>Owner<input name="owner" list="team-members-list" value="${esc(l.owner)}" placeholder="Assign a teammate"><datalist id="team-members-list">${teamOptions}</datalist></label><label>Next follow-up <small>Dhaka time</small><input type="datetime-local" name="nextFollowUp" value="${l.nextFollowUp ? new Date(Date.parse(l.nextFollowUp) + 21600000).toISOString().slice(0, 16) : ""}"></label>` : ""}</div>`;
}

function openLead(id) {
  selected = id;
  const l = state.leads.find((x) => x.id === id);
  if (!l) return;
  const cleanPhone = l.phone ? l.phone.replace(/\D/g, "") : "";
  const waPhone = cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone;
  const waMsg = encodeURIComponent(
    l.draft || `Assalamualaikum ${l.name}, BIAI team here regarding your enquiry.`,
  );
  $("#detail").innerHTML =
    `<div class="dialog-header"><span class="eyebrow">CONTACT WORKSPACE</span><button class="close" data-close="detail-dialog" aria-label="Close contact">×</button></div>
    <div class="detail-heading">
      <span class="avatar large">${esc(initials(l.name))}</span>
      <div>
        <h2 id="detail-title">${esc(l.name)}</h2>
        <p>${esc(l.route)} queue · ${l.messages.length} original message${l.messages.length > 1 ? "s" : ""}</p>
      </div>
    </div>
    ${cleanPhone ? `
    <div class="detail-actions-bar">
      <a class="action-pill-btn wa-pill" href="https://wa.me/880${waPhone}?text=${waMsg}" target="_blank" rel="noopener noreferrer">${icons.whatsapp()} <span>Open WhatsApp Chat</span></a>
      <a class="action-pill-btn call-pill" href="tel:${cleanPhone}">${icons.phone()} <span>Call (${esc(l.phone)})</span></a>
    </div>` : ""}
    ${l.route === "Support" ? '<div class="notice support-notice">Human review required. A payment claim is not a verified payment.</div>' : ""}
    ${l.route === "Spam" ? '<div class="notice support-notice">Quarantined from sales. No reply will be suggested.</div>' : ""}
    <form id="edit-form">
      ${formFields(l)}
      <label>Team notes<textarea name="notes" rows="3">${esc(l.notes)}</textarea></label>
      <div class="form-actions">
        <button class="primary" type="submit">Save contact & reply</button>
        <button class="secondary" id="contacted" type="button">Log completed contact</button>
        <button class="delete-lead-btn" id="delete-lead" type="button">Delete enquiry</button>
      </div>
      <p class="helper">Logging contact saves your edits and records an outreach you already completed. Future scheduled follow-ups are preserved. Nothing is sent.</p>
    </form>
    <section class="detail-section">
      <div class="section-head"><h3>Conversation</h3><span class="muted">Original messages, preserved</span></div>
      ${l.messages.map((m) => `<article class="message"><div><strong>${esc(m.channel)}</strong><time>${fmt(m.receivedAt)}</time></div><p>${esc(m.text)}</p></article>`).join("")}
    </section>
    <section class="detail-section">
      <div class="section-head"><h3>Reply draft</h3><span class="mode-pill">${esc(l.draftMode === "live" ? "AI Engine" : l.draftMode === "sample" ? "Reviewed sample" : l.draftMode === "heuristic" ? "Rule-based draft" : l.draftMode === "human-reviewed" ? "Human-reviewed" : "Manual")}</span></div>
      <textarea id="reply-text" rows="4" aria-label="Editable reply draft" placeholder="No reply draft yet">${esc(l.draft)}</textarea>
      <div class="form-actions">
        <button class="secondary" id="generate-reply" ${l.route === "Spam" ? "disabled" : ""}>${icons.aiSpark()} <span>Draft reply</span></button>
        <button class="secondary" id="save-reply">Save edited reply</button>
        <button class="secondary" id="copy-reply">Copy reply</button>
      </div>
      <p class="helper">Review before sending through the original channel. No prices, policies or payment confirmations are assumed.</p>
    </section>
    <details class="audit"><summary>Activity history · ${l.audit.length} events</summary>${[
      ...l.audit,
    ]
      .reverse()
      .map((a) => `<p><small>${fmt(a.at)}</small>${esc(a.action)}</p>`)
      .join("")}</details>`;
  cleanContact = contactSnapshot();
  bindClose();
  $("#delete-lead").onclick = (e) => {
    e.preventDefault();
    if (confirm(`Are you sure you want to delete the enquiry from "${l.name}"? This cannot be undone.`)) {
      act($("#delete-lead"), async () => {
        await api("leads/" + id, "DELETE");
        $("#detail-dialog").close();
        await reload();
        toast("Enquiry deleted.");
      });
    }
  };
  $("#save-reply").onclick = (e) =>
    act(e.target, async () => {
      await saveContact(id);
      await reload();
      openLead(id);
      toast("Reply and contact saved.");
    });
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
  $("#edit-form").addEventListener("submit", (e) => {
    e.preventDefault();
    act(e.submitter, async () => {
      await saveContact(id);
      await reload();
      openLead(id);
      toast("Contact and reply saved.");
    });
  });
  $("#contacted").addEventListener("click", (e) =>
    act(e.target, async () => {
      await saveContact(id);
      await api("leads/" + id + "/contact", "POST", {});
      await reload();
      openLead(id);
      toast("Completed contact logged. Future follow-up preserved.");
    }),
  );
  $("#generate-reply").addEventListener("click", (e) =>
    act(e.target, async () => {
      await saveContact(id);
      const beforeDraft = contactSnapshot();
      await api("leads/" + id + "/draft", "POST", {});
      await reload();
      if ($("#detail-dialog").open && selected === id) {
        if (contactSnapshot() !== beforeDraft) {
          toast(
            "AI draft saved. Your newer unsaved edits remain in the editor; save them to keep them.",
          );
          return;
        }
        openLead(id);
      }
      toast("Draft saved. Review it before sending.");
    }),
  );
  $("#copy-reply").addEventListener("click", (e) =>
    act(e.target, async () => {
      await saveContact(id);
      await navigator.clipboard.writeText($("#reply-text").value);
      toast("Draft saved and copied. Nothing was sent.");
    }),
  );
}
function contactSnapshot() {
  const form = $("#edit-form");
  return form
    ? JSON.stringify([
        Object.fromEntries(new FormData(form)),
        $("#reply-text")?.value,
      ])
    : "";
}
function allowClose() {
  return (
    contactSnapshot() === cleanContact ||
    confirm("Discard your unsaved contact or reply changes?")
  );
}
function bindClose() {
  document.querySelectorAll("[data-close]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.close !== "detail-dialog" || allowClose())
          $("#" + b.dataset.close).close();
      }),
  );
}
async function act(button, fn) {
  const old = button.innerHTML,
    scope = button.closest("dialog") || $("main");
  scope.querySelector(".action-error")?.remove();
  button.disabled = true;
  if (button.tagName !== "SELECT") button.textContent = "Working…";
  try {
    await fn();
  } catch (e) {
    const error = document.createElement("p");
    error.className = "action-error";
    error.setAttribute("role", "alert");
    error.textContent = e.message;
    scope.append(error);
    error.scrollIntoView({ block: "nearest" });
    toast(e.message);
  } finally {
    button.disabled = false;
    if (button.tagName !== "SELECT") button.innerHTML = old;
  }
}
async function saveContact(id) {
  const form = $("#edit-form");
  if (!form.reportValidity())
    throw new Error("Please check the contact fields.");
  const data = Object.fromEntries(new FormData(form));
  data.nextFollowUp = data.nextFollowUp
    ? new Date(data.nextFollowUp + ":00+06:00").toISOString()
    : "";
  data.draft = $("#reply-text").value;
  await api("leads/" + id, "PATCH", data);
  cleanContact = contactSnapshot();
}
function openIntake() {
  intakeResult = null;
  $("#intake").innerHTML =
    `<div class="dialog-header"><span class="eyebrow">NEW ENQUIRY</span><button class="close" data-close="intake-dialog" aria-label="Close intake">×</button></div><h2 id="intake-title">New enquiry</h2><p class="muted">${state.automation.mode === "automatic" ? "Automatic processing is active. Unrecognized queries route to verification." : "Paste an enquiry, or pick a supplied sample, to extract the details and draft a reply."}</p><label>Supplied sample message <small>optional</small><select id="sample-picker"><option value="">Choose one of the 20 supplied messages…</option>${state.samples.map((s) => `<option value="${s.id}">#${s.id} · ${esc(s["sender name"])}</option>`).join("")}</select></label><form id="intake-form"><div class="form-grid"><label>Source<select name="channel">${option(["WhatsApp", "Facebook Messenger", "Facebook comment", "Website form", "Phone call note"], "WhatsApp")}</select></label><label>Sender name <small>if provided</small><input name="name" maxlength="200"></label><label>Phone <small>if provided</small><input name="phone" inputmode="tel"></label></div><label>Original message<textarea name="message" rows="5" maxlength="8000" required placeholder="Paste or type the prospect enquiry…"></textarea></label><button class="primary" type="submit">${icons.aiSpark()} ${state.automation.mode === "automatic" ? "Process enquiry" : "Extract details & draft reply"}</button><button class="text-button" type="button" id="manual-entry">Enter details manually</button><p class="helper">${state.automation.mode === "automatic" ? "Complete sales enquiries are saved automatically. Exceptions require manual verification." : "Extracts name, phone, programme, queue and language, then drafts a reply for you to review before saving."}</p></form><div id="extracted"></div>`;
  bindClose();
  $("#intake-dialog").showModal();
  $("#sample-picker").onchange = (e) => {
    const s = state.samples.find((x) => x.id === e.target.value);
    if (!s) return;
    const f = $("#intake-form");
    for (const [k, v] of Object.entries({
      channel: s.channel,
      name: s["sender name"],
      phone: s.phone,
      message: s.message,
    }))
      f.elements[k].value = v;
    $("#extracted").innerHTML = "";
  };
  $("#intake-form").onsubmit = (e) => {
    e.preventDefault();
    act(e.submitter, async () => {
      const input = Object.fromEntries(new FormData(e.target));
      if (state.automation.mode === "automatic") {
        const job = await api("automation/process", "POST", input);
        if (job.status === "Failed") throw new Error(job.error);
        $("#intake-dialog").close();
        view = "automation";
        await reload();
        toast(
          job.status === "Completed"
            ? "Saved automatically; draft and follow-up prepared."
            : "Added to verification queue.",
        );
        return;
      }
      const result = await api("analyze", "POST", input);
      if (!$("#intake-dialog").open) return;
      if (
        JSON.stringify(Object.fromEntries(new FormData($("#intake-form")))) !==
        JSON.stringify(input)
      )
        throw new Error(
          "The message changed during extraction. Please extract again.",
        );
      intakeResult = { ...input, ...result };
      renderExtracted();
    });
  };
  $("#manual-entry").onclick = () => {
    const input = Object.fromEntries(new FormData($("#intake-form")));
    if (!input.message.trim())
      return toast("Paste the original message first.");
    intakeResult = {
      ...input,
      program: "Unspecified",
      route: "Sales",
      language: "English",
      reason: "Manually reviewed intake.",
      reply: "",
      mode: "manual",
    };
    renderExtracted();
  };
  $("#intake-form").addEventListener("input", () => {
    $("#extracted").innerHTML = "";
    intakeResult = null;
  });
}
function renderExtracted() {
  const r = intakeResult;
  $("#extracted").innerHTML =
    `<section class="extraction"><div class="section-head"><h3>Review extracted details</h3><span class="mode-pill">${r.mode === "live" ? "AI Engine" : r.mode === "sample" ? "Reviewed sample" : r.mode === "heuristic" ? "Rule-based (no live AI)" : "Manual entry"}</span></div><p class="extraction-reason">${esc(r.reason)}</p><form id="review-form">${formFields(r, "intake")}<label>Reply draft<textarea name="reply" rows="3">${esc(r.reply)}</textarea></label><p class="helper">Saving applies these reviewed details and this reply to the matching contact. Owner, sales stage and team notes are preserved. Original messages are never duplicated.</p><button type="submit" class="primary">Save reviewed enquiry &rarr;</button></form></section>`;
  $("#review-form").onsubmit = (e) => {
    e.preventDefault();
    act(e.submitter, async () => {
      const values = Object.fromEntries(new FormData(e.target));
      const s = state.samples.find(
        (s) =>
          s.message === r.message &&
          s["sender name"] === r.name &&
          s.phone === r.phone &&
          s.channel === r.channel,
      );
      const payload = {
        ...r,
        ...values,
        ...(s
          ? {
              sourceId: s.id,
              receivedAt: s["received at"].replace(" ", "T") + ":00+06:00",
            }
          : {}),
      };
      const result = await api("leads", "POST", payload);
      $("#intake-dialog").close();
      await reload();
      openLead(result.lead.id);
      toast(
        result.duplicate
          ? "Reviewed details and reply saved to the existing contact."
          : result.merged
            ? "Added to the existing contact."
            : "Enquiry saved.",
      );
    });
  };
}
function renderInsights() {
  $("#content").innerHTML =
    `<div class="brief-grid"><section class="brief-panel"><div class="eyebrow">WEEKLY BRIEF</div><h2>Reporting period</h2><p>Enquiries received in the seven days ending on the chosen date, plus follow-ups outstanding today.</p><label>Week ending <small>Asia/Dhaka</small><input id="week-ending" type="date" value="2026-11-01"></label><button class="primary" id="generate-summary">${icons.aiSpark()} Create report</button><p class="helper">Totals are calculated from the data. Priorities come from live AI when a key is configured, otherwise from simple rules.</p></section><section class="summary-panel"><div class="section-head"><h3>Summary</h3><div class="summary-header-actions"><button class="secondary small-btn" id="copy-summary" style="display:none;" type="button">${icons.clipboard()} Copy report</button><span class="mode-pill ${state.mode === "live" ? "live" : ""}">${state.mode === "live" ? "Live AI" : "Rule-based"}</span></div></div><div id="summary-output">${icons.activity()}<h3>No report generated</h3><p>Select a week ending date, then click Create report.</p></div></section></div>`;
  $("#generate-summary").onclick = (e) =>
    act(e.target, async () => {
      const result = await api("summary", "POST", {
        end: $("#week-ending").value,
      });
      $("#summary-output").innerHTML =
        `<div class="summary-meta">${esc(result.mode === "live" ? "Calculated totals + live AI action priorities" : "Calculated totals + rule-based priorities (no live AI)")}</div><div class="summary-text" id="report-text" style="white-space: pre-wrap; font-family: inherit; line-height: 1.6;">${esc(result.text)}</div>`;
      const copyBtn = $("#copy-summary");
      if (copyBtn) {
        copyBtn.style.display = "inline-flex";
        copyBtn.onclick = async () => {
          await navigator.clipboard.writeText(result.text);
          toast("Weekly report copied to clipboard.");
        };
      }
    });
}
function openAuthDialog() {
  const dlg = $("#auth-dialog");
  let activeTab = "switch"; // "switch", "login", "register"

  const renderDialog = () => {
    const defaultUsers = [
      { name: "Admin BIAI", email: "admin@biai.com.bd", role: "Admin", pass: "Admin123!" },
      { name: "Tanvir Ahmed", email: "tanvir@biai.com.bd", role: "Admissions", pass: "Admin123!" },
      { name: "Ayesha Siddiqua", email: "ayesha@biai.com.bd", role: "Support", pass: "Admin123!" },
      { name: "Rahim Chowdhury", email: "rahim@biai.com.bd", role: "Sales", pass: "Admin123!" },
    ];

    dlg.querySelector("#auth-box").innerHTML = `
      <div class="auth-header">
        <h2 id="auth-title">Team member</h2>
        <button class="close" id="close-auth-btn" aria-label="Close dialog">×</button>
      </div>

      ${currentUser ? `
        <div class="current-user-card">
          <span class="avatar">${esc(initials(currentUser.name))}</span>
          <div class="current-user-details">
            <strong>${esc(currentUser.name)} <span class="role-badge">${esc(currentUser.role)}</span></strong>
            <small>${esc(currentUser.email)}</small>
          </div>
        </div>
      ` : `
        <p class="helper">You are not signed in. Choose a team member below or sign in.</p>
      `}

      <div class="auth-tabs">
        <button class="auth-tab ${activeTab === "switch" ? "active" : ""}" data-tab="switch">Switch member</button>
        <button class="auth-tab ${activeTab === "login" ? "active" : ""}" data-tab="login">Sign In</button>
        <button class="auth-tab ${activeTab === "register" ? "active" : ""}" data-tab="register">Add member</button>
      </div>

      <div id="auth-tab-content">
        ${activeTab === "switch" ? `
          <p class="helper">Changes you make are credited to this person in each contact's activity history. Demo accounts only; this does not restrict access.</p>
          <div class="user-chips">
            ${defaultUsers.map(u => `
              <button class="user-chip ${currentUser?.email === u.email ? "active" : ""}" data-quick-user="${u.email}" data-quick-pass="${u.pass}">
                <span class="avatar small">${esc(initials(u.name))}</span>
                <div>
                  <strong>${esc(u.name)}</strong>
                  <small>${esc(u.role)}</small>
                </div>
              </button>
            `).join("")}
          </div>
          ${currentUser ? `<button class="secondary" id="logout-btn" style="width:100%;margin-top:10px;">Log out</button>` : ""}
        ` : activeTab === "login" ? `
          <form id="login-form" class="auth-form">
            <label>Email address<input type="email" name="email" required placeholder="name@biai.com.bd"></label>
            <label>Password<input type="password" name="password" required placeholder="Enter password"></label>
            <div id="auth-err" class="auth-error" hidden></div>
            <button class="primary" type="submit" style="margin-top:8px;">Sign in</button>
          </form>
        ` : `
          <form id="register-form" class="auth-form">
            <label>Full name<input type="text" name="name" required placeholder="e.g. Nusrat Jahan"></label>
            <label>Email address<input type="email" name="email" required placeholder="nusrat@biai.com.bd"></label>
            <label>Role
              <select name="role">
                <option value="Admissions">Admissions</option>
                <option value="Sales">Sales</option>
                <option value="Support">Support</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <label>Password<input type="password" name="password" required minlength="6" placeholder="At least 6 characters"></label>
            <div id="auth-err" class="auth-error" hidden></div>
            <button class="primary" type="submit" style="margin-top:8px;">Create account</button>
          </form>
        `}
      </div>
    `;

    dlg.querySelector("#close-auth-btn").onclick = () => dlg.close();

    dlg.querySelectorAll(".auth-tab").forEach(tab => {
      tab.onclick = () => {
        activeTab = tab.dataset.tab;
        renderDialog();
      };
    });

    dlg.querySelectorAll("[data-quick-user]").forEach(chip => {
      chip.onclick = async () => {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: chip.dataset.quickUser, password: chip.dataset.quickPass }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setAuth(data.token, data.user);
          dlg.close();
          toast(`Switched to ${data.user.name} (${data.user.role})`);
          await reload();
        } catch (e) {
          alert(e.message);
        }
      };
    });

    const logoutBtn = dlg.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        clearAuth();
        dlg.close();
        toast("Logged out.");
      };
    }

    const loginForm = dlg.querySelector("#login-form");
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const errBox = dlg.querySelector("#auth-err");
        errBox.hidden = true;
        const formData = new FormData(loginForm);
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(formData)),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setAuth(data.token, data.user);
          dlg.close();
          toast(`Signed in as ${data.user.name}`);
          await reload();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.hidden = false;
        }
      };
    }

    const registerForm = dlg.querySelector("#register-form");
    if (registerForm) {
      registerForm.onsubmit = async (e) => {
        e.preventDefault();
        const errBox = dlg.querySelector("#auth-err");
        errBox.hidden = true;
        const formData = new FormData(registerForm);
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.fromEntries(formData)),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setAuth(data.token, data.user);
          dlg.close();
          toast(`Account created for ${data.user.name}`);
          await reload();
        } catch (err) {
          errBox.textContent = err.message;
          errBox.hidden = false;
        }
      };
    }
  };

  renderDialog();
  dlg.showModal();
}

if ($("#user-profile")) $("#user-profile").onclick = openAuthDialog;
if ($("#topbar-user")) $("#topbar-user").onclick = openAuthDialog;

document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      query = "";
      program = "";
      ownerFilter = "";
      route = view === "pipeline" ? "Sales" : "";
      render();
    }),
);
$("#new-enquiry").onclick = openIntake;
initAuth()
  .then(() => reload())
  .then(() => {
    const params = new URLSearchParams(window.location.search);
    const targetLead = params.get("lead");
    if (targetLead) {
      setTimeout(() => openLead(targetLead), 150);
    }
  })
  .catch((e) => {
    $("#content").innerHTML =
      `<div class="empty-state"><h2>Unable to load the workspace.</h2><p>${esc(e.message)}</p><p>Refresh once the local server is running.</p></div>`;
  });

$("#detail-dialog").addEventListener("cancel", (e) => {
  if (!allowClose()) e.preventDefault();
});
window.addEventListener("beforeunload", (e) => {
  if ($("#detail-dialog").open && contactSnapshot() !== cleanContact) {
    e.preventDefault();
    e.returnValue = "";
  }
});

function renderAutomation() {
  $("#content").innerHTML =
    `<section class="automation-settings"><label>Processing mode<select id="automation-mode"><option value="manual" ${state.automation.mode === "manual" ? "selected" : ""}>Manual verification</option><option value="automatic" ${state.automation.mode === "automatic" ? "selected" : ""}>Automatic with exception review</option></select></label><p class="helper">Automatic: extract, classify, draft, save complete sales enquiries and schedule follow-up in 48 hours. Missing details, non-sales enquiries and existing contacts require verification. Manual: review every result before saving. No messages are sent and payment claims never change a contact to Paid.</p><button class="secondary" id="process-samples">${icons.aiSpark()} Process all 20 sample messages</button><p id="batch-progress" role="status"></p></section><div class="section-head"><h2>Processing history</h2><span class="muted">${state.jobs.filter((j) => j.status === "Pending").length} awaiting verification</span></div><div class="automation-jobs">${state.jobs.length ? [...state.jobs].sort((a,b)=>(a.status === "Pending" ? -1 : 0)-(b.status === "Pending" ? -1 : 0)).map((j) => `<article class="automation-job"><div class="section-head"><h3>${esc(j.input.name || "Unknown sender")}</h3><span class="stage-badge job-${esc(j.status.toLowerCase())}">${esc(j.status === "Completed" ? "Saved automatically" : j.status === "Pending" ? "Needs review" : j.status)}</span></div><p>${esc(j.input.message)}</p><small>${esc(j.input.channel)} · ${esc(j.mode)} · ${fmt(j.createdAt)}</small>${j.error ? `<p class="action-error">${esc(j.error)}</p>` : ""}${j.status === "Pending" ? `<p class="helper">${esc(j.reasons.join(" · ") || "Manual verification selected")}</p><details class="review-details"><summary>Review details and reply</summary><form data-review="${j.id}">${formFields(j.result, "intake")}<label>Reply draft<textarea name="reply" rows="3">${esc(j.result.reply)}</textarea></label><div class="form-actions"><button class="primary" type="submit">Approve & save</button><button class="secondary" type="button" data-reject="${j.id}">Reject</button></div></form></details>` : ""}${j.leadId ? `<button class="text-button" data-open="${j.leadId}">Open saved contact</button>` : ""}${j.status === "Failed" ? `<button class="secondary" data-retry="${j.id}">Retry processing</button>` : ""}</article>`).join("") : '<p class="empty-state">Nothing processed yet. Submit a new enquiry, or process the sample messages above.</p>'}</div>`;
  $("#automation-mode").onchange = (e) =>
    act(e.target, async () => {
      await api("automation/settings", "POST", { mode: e.target.value });
      await reload();
      toast("Processing mode saved. Existing results are unchanged.");
    });
  document.querySelectorAll("[data-review]").forEach(
    (f) =>
      (f.onsubmit = (e) => {
        e.preventDefault();
        act(e.submitter, async () => {
          await api("automation/" + f.dataset.review + "/review", "POST", {
            action: "approve",
            changes: Object.fromEntries(new FormData(f)),
          });
          await reload();
          toast("Verified and saved.");
        });
      }),
  );
  document.querySelectorAll("[data-reject]").forEach(
    (b) =>
      (b.onclick = () =>
        act(b, async () => {
          await api("automation/" + b.dataset.reject + "/review", "POST", {
            action: "reject",
          });
          await reload();
        })),
  );
  document
    .querySelectorAll("[data-open]")
    .forEach((b) => (b.onclick = () => openLead(b.dataset.open)));
  document.querySelectorAll("[data-retry]").forEach(
    (b) =>
      (b.onclick = () =>
        act(b, async () => {
          const job = state.jobs.find((j) => j.id === b.dataset.retry);
          await api("automation/process", "POST", job.input);
          await reload();
        })),
  );
  $("#process-samples").onclick = (e) =>
    act(e.target, async () => {
      const button = e.target;
      let failed = 0;
      for (let i = 0; i < state.samples.length; i++) {
        const sample = state.samples[i];
        if ($("#batch-progress"))
          $("#batch-progress").textContent =
            "Processing " + (i + 1) + " of " + state.samples.length + "…";
        try {
          const j = await api("automation/process", "POST", {
            message: sample.message,
            channel: sample.channel,
            name: sample["sender name"],
            phone: sample.phone,
          });
          if (j.status === "Failed") failed++;
        } catch {
          failed++;
        }
      }
      await reload();
      toast(
        "Processing complete. " +
          failed +
          " failed; review the history for details.",
      );
    });
}

document.addEventListener("change", e=>{if(e.target.matches("select[name=route]")){const label=e.target.closest("form")?.querySelector("[data-support-field]");if(label)label.hidden=e.target.value!=="Support";}});
