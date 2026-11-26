export const money = (amount: number | null | undefined) => `¥${(amount ?? 0).toFixed(2)}`;
export function localTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function startDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000+08:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10) !== value) return undefined;
  return date;
}

export function dateInChina(days = 0, now = Date.now()) {
  return new Date(now + (8 + days * 24) * 3600_000).toISOString().slice(0, 10);
}

export function formatChinaDate(value: string | null | undefined) {
  const instant = value ? Date.parse(value) : NaN;
  return Number.isFinite(instant) ? new Date(instant + 8 * 3600_000).toISOString().slice(0, 10) : '';
}

export type DateRange = { from: string; to: string };

export function period(from: string, to: string, maxDays = Infinity) {
  const start = startDate(from);
  const end = startDate(to);
  if (!start || !end || start > end) return undefined;
  const exclusiveEnd = end.getTime() + 86_400_000;
  if (exclusiveEnd - start.getTime() > maxDays * 86_400_000) return undefined;
  return { startAt: start.toISOString(), endAt: new Date(exclusiveEnd).toISOString() };
}

export type CsvCell = string | number | boolean | null | undefined;

function escape(value: CsvCell) {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function asCsv(rows: CsvCell[][]): string {
  return '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
}
