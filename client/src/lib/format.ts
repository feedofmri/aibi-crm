const TZ = "Asia/Dhaka";

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateOnly = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** 26 Oct, 09:40 (Dhaka time) */
export const formatDateTime = (iso: string) => (iso ? dateTime.format(new Date(iso)).replace(",", ",") : "—");
/** 1 Nov 2026 */
export const formatDate = (iso: string) => (iso ? dateOnly.format(new Date(iso)) : "—");
/** 1 Nov */
export const formatDayMonth = (iso: string) => (iso ? dayMonth.format(new Date(iso)) : "—");
/** Sun, 1 Nov 2026 */
export const formatLongDate = (iso: string) => (iso ? longDate.format(new Date(iso)) : "—");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "8 days ago" */
export function formatRelative(iso: string, now = Date.now()) {
  if (!iso) return "—";
  const diff = now - Date.parse(iso);
  const future = diff < 0;
  const abs = Math.abs(diff);
  let text: string;
  if (abs < MINUTE) return "just now";
  if (abs < HOUR) text = `${Math.round(abs / MINUTE)} min`;
  else if (abs < DAY) text = `${Math.round(abs / HOUR)} h`;
  else {
    const days = Math.round(abs / DAY);
    text = `${days} day${days === 1 ? "" : "s"}`;
  }
  return future ? `in ${text}` : `${text} ago`;
}

/** ISO → value for <input type="datetime-local"> in Dhaka time. */
export function toDhakaInputValue(iso: string) {
  if (!iso) return "";
  const shifted = new Date(Date.parse(iso) + 6 * HOUR);
  return shifted.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (Dhaka time) → ISO. */
export function fromDhakaInputValue(value: string) {
  if (!value) return "";
  return new Date(`${value}:00+06:00`).toISOString();
}

/** Today's date in Dhaka as YYYY-MM-DD. */
export function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
