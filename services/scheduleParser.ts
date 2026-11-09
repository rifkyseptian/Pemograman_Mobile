import { daysList, DayType } from '../types';

export type ScannedScheduleFields = {
  subject: string;
  day: DayType | null;
  timeStart: string;
  timeEnd: string;
};

const findDay = (text: string): DayType | null => {
  const normalized = text.toLocaleLowerCase('id-ID').replace(/jum\s*['’]?at/g, 'jumat');
  return daysList.find((day) => new RegExp(`\\b${day.toLocaleLowerCase('id-ID')}\\b`, 'i').test(normalized)) ?? null;
};

export function extractScheduleFields(text: string, fallbackDay: DayType): ScannedScheduleFields {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const day = findDay(text) ?? fallbackDay;
  const timeRange = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:-|–|—|s\.d\.?|sampai|to)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/i;
  const timeLine = lines.find((line) => timeRange.test(line));

  if (!timeLine) return { subject: '', day: findDay(text), timeStart: '', timeEnd: '' };

  const match = timeLine.match(timeRange);
  if (!match) return { subject: '', day, timeStart: '', timeEnd: '' };

  const timeStart = `${match[1].padStart(2, '0')}:${match[2]}`;
  const timeEnd = `${match[3].padStart(2, '0')}:${match[4]}`;
  const subject = timeLine
    .replace(timeRange, ' ')
    .replace(/\b(senin|selasa|rabu|kamis|jumat|jum['’]?at|sabtu|minggu)\b/gi, ' ')
    .replace(/\b(jam|pukul|mata\s+pelajaran|mata\s+kuliah|kelas)\b/gi, ' ')
    .replace(/[|•;,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { subject, day, timeStart, timeEnd };
}
