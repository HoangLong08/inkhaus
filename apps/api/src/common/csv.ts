/**
 * CSV for spreadsheets, RFC 4180 flavoured: comma separated, CRLF line ends, a
 * field quoted when it holds a comma, a quote or a line break, embedded quotes
 * doubled.
 *
 * Plus one thing RFC 4180 never considered: the file is going to be opened in
 * Excel or Sheets, and both evaluate a cell that starts with `=`, `+`, `-` or
 * `@` as a formula - `=HYPERLINK(...)` typed into a checkout name becomes a
 * link in the owner's spreadsheet. Such a cell is prefixed with `'`, which the
 * spreadsheet shows as text (OWASP's CSV-injection advice). Tab and CR are on
 * the list because some spreadsheets skip leading whitespace before looking.
 *
 * Numbers are exempt. A JS number stringifies to digits, a sign, a point or an
 * exponent and can never be a formula, and a total of -12.50 should stay a
 * number the spreadsheet can sum.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** one field, escaped */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);

  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** one line, CRLF-terminated */
export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(',') + '\r\n';
}
