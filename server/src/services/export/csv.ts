export function toCsv(rows: Record<string, string>[], headers: string[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h] ?? '')).join(','))];
  return lines.join('\n');
}
