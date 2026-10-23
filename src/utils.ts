/**
 * src/utils.ts — Universal helpers for EcoRide Share.
 * Formats Indian Currency (en-IN), Asia/Kolkata timestamps, and distances.
 */

/**
 * Parse an ISO date or Date object into a Date in UTC.
 * If an ISO string has no timezone indicator (e.g. "2026-10-22T18:15:00"),
 * treats it as UTC by appending "Z" to avoid browser-local assumptions.
 */
export function parseDateSafe(val: string | Date): Date {
  if (val instanceof Date) return val;
  if (!val) return new Date();
  let s = String(val).trim();
  if (s.includes('T') && !s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += 'Z';
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Formats time in Indian Standard Time (Asia/Kolkata).
 * If relative to reference date (or current IST date), shows "tomorrow 12:15 am"
 * if the date is the next calendar day in IST.
 */
export function formatTime(
  val: string | Date,
  options?: {
    baseDate?: string | Date;
    includeDayIfDifferent?: boolean;
  }
): string {
  if (!val) return '--:--';
  const targetDate = parseDateSafe(val);
  const baseDate = options?.baseDate ? parseDateSafe(options.baseDate) : new Date();

  // Extract IST calendar parts for target
  const targetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const baseFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const targetParts = targetFormatter.formatToParts(targetDate);
  const baseParts = baseFormatter.formatToParts(baseDate);

  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value || '';

  const tYear = parseInt(getPart(targetParts, 'year'), 10);
  const tMonth = parseInt(getPart(targetParts, 'month'), 10);
  const tDay = parseInt(getPart(targetParts, 'day'), 10);

  const bYear = parseInt(getPart(baseParts, 'year'), 10);
  const bMonth = parseInt(getPart(baseParts, 'month'), 10);
  const bDay = parseInt(getPart(baseParts, 'day'), 10);

  const hour = getPart(targetParts, 'hour');
  const minute = getPart(targetParts, 'minute');
  const dayPeriod = getPart(targetParts, 'dayPeriod').toLowerCase();

  const timeStr = `${hour}:${minute} ${dayPeriod}`;

  const includeDay = options?.includeDayIfDifferent !== false;
  if (!includeDay) {
    return timeStr;
  }

  // Calculate day difference in IST calendar days
  const targetDayNum = Date.UTC(tYear, tMonth - 1, tDay) / 86400000;
  const baseDayNum = Date.UTC(bYear, bMonth - 1, bDay) / 86400000;
  const diffDays = Math.round(targetDayNum - baseDayNum);

  if (diffDays === 1) {
    return `tomorrow ${timeStr}`;
  } else if (diffDays === -1) {
    return `yesterday ${timeStr}`;
  } else if (diffDays > 1) {
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    });
    return `${weekdayFormatter.format(targetDate)} ${timeStr}`;
  }

  return timeStr;
}

export function formatDateTime(val: string | Date): string {
  if (!val) return '';
  const d = parseDateSafe(val);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .toLowerCase();
}

/**
 * Money formatting:
 * - Whole rupees only, never decimals.
 * - Indian grouping: en-IN (e.g. Rs 1,500).
 * - Estimates rounded to the nearest 10 with "about" in front (e.g. "about Rs 830").
 */
export function formatINR(val: number, isEstimate: boolean = false): string {
  if (isNaN(val)) return 'Rs 0';
  let num = val;
  if (isEstimate) {
    num = Math.round(val / 10) * 10;
  } else {
    num = Math.round(val);
  }
  const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
  return isEstimate ? `about Rs ${formatted}` : `Rs ${formatted}`;
}

export function formatEstimateINR(val: number): string {
  return formatINR(val, true);
}

export function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatKm(km: number, decimals: number = 1): string {
  if (isNaN(km)) return '0 km';
  const val = Number(km.toFixed(decimals));
  return `${val} km`;
}

// Backwards-compatible alias for formatTime
export const formatTimeIST = formatTime;
export const formatDateIST = formatDateTime;

/** The next quarter-hour at least 5 minutes away (the default landing time). */
export function nextQuarterHour(from: Date = new Date()): Date {
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  const m = d.getMinutes() + 5;
  d.setMinutes(Math.ceil(m / 15) * 15);
  return d;
}

/** 4:05 style countdown for invite windows and landing timers. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** "Deepa", "Deepa and Rahul", "Deepa, Rahul and Kavya" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
