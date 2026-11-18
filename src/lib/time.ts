// Saare dates India time (IST, UTC+05:30) me dikhane / samajhne ke liye.
// Server (Vercel) UTC me chalta hai, isliye har jagah timeZone explicitly dena zaroori hai.

export const IST_TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30, India me DST nahi hota

/** "18 Nov 2026, 3:36 pm" — IST me */
export function fmtIST(
  d: Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
) {
  if (!d) return "";
  return d.toLocaleString("en-IN", { ...opts, timeZone: IST_TZ });
}

/** IST ke hisaab se din ki shuruaat (raat 12 baje IST) as a real Date */
export function startOfISTDay(d: Date = new Date()) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** "2026-11-18" — IST date key, din ke hisaab se group karne ke liye */
export function istDayKey(d: Date) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-11-18 15:36" — CSV / Excel ke liye IST */
export function istStamp(d: Date) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}

/** Date -> <input type="datetime-local"> value, IST me */
export function toISTInput(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (IST maan ke) -> Date */
export function fromISTInput(s: string) {
  const withSeconds = s.length === 16 ? `${s}:00` : s;
  const d = new Date(`${withSeconds}+05:30`);
  return isNaN(d.getTime()) ? null : d;
}
