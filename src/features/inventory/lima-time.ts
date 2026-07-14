import { APP_TIMEZONE } from "@/lib/constants";

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const limaPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getLimaParts(date: Date): DateTimeParts | null {
  if (Number.isNaN(date.getTime())) return null;
  const formatted = limaPartsFormatter.formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => Number(formatted.find((part) => part.type === type)?.value);
  const year = valueFor("year");
  const month = valueFor("month");
  const day = valueFor("day");
  const hour = valueFor("hour");
  const minute = valueFor("minute");
  if ([year, month, day, hour, minute].some((value) => !Number.isInteger(value))) {
    return null;
  }
  return { year, month, day, hour, minute };
}

function partsAsUtc(parts: DateTimeParts) {
  const value = new Date(0);
  value.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  value.setUTCHours(parts.hour, parts.minute, 0, 0);
  return value.getTime();
}

function sameParts(left: DateTimeParts, right: DateTimeParts) {
  return left.year === right.year && left.month === right.month && left.day === right.day
    && left.hour === right.hour && left.minute === right.minute;
}

function parseLocalDateTime(value: string): DateTimeParts | null {
  const match = localDateTimePattern.exec(value);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  if (parts.year < 1 || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31
    || parts.hour > 23 || parts.minute > 59) return null;
  const calendarCheck = new Date(partsAsUtc(parts));
  if (calendarCheck.getUTCFullYear() !== parts.year || calendarCheck.getUTCMonth() + 1 !== parts.month
    || calendarCheck.getUTCDate() !== parts.day || calendarCheck.getUTCHours() !== parts.hour
    || calendarCheck.getUTCMinutes() !== parts.minute) return null;
  return parts;
}

export function formatDateTimeLocalInLima(value: Date | string | number = new Date()) {
  const parts = getLimaParts(value instanceof Date ? value : new Date(value));
  if (!parts) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function limaDateTimeLocalToUtc(value: string) {
  const requested = parseLocalDateTime(value);
  if (!requested) return null;

  const requestedAsUtc = partsAsUtc(requested);
  let candidate = requestedAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const represented = getLimaParts(new Date(candidate));
    if (!represented) return null;
    const adjustment = requestedAsUtc - partsAsUtc(represented);
    candidate += adjustment;
    if (adjustment === 0) break;
  }

  const instant = new Date(candidate);
  const verified = getLimaParts(instant);
  return verified && sameParts(verified, requested) ? instant.toISOString() : null;
}
