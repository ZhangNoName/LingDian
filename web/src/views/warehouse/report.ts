/** Protect spreadsheet consumers from formula injection, including leading whitespace. */
export function csvCell(value: string | number): string {
  let text = String(value)
  if (typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/u.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}
export function buildCsv(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const url = URL.createObjectURL(new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
