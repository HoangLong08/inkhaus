import { csvCell, csvRow } from './csv';

describe('csvCell', () => {
  it('writes nothing for a missing value', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('leaves a plain value alone', () => {
    expect(csvCell('INK-000123')).toBe('INK-000123');
    expect(csvCell(42.5)).toBe('42.5');
    expect(csvCell(true)).toBe('true');
  });

  it('quotes a comma, a quote or a line break, doubling embedded quotes', () => {
    expect(csvCell('Ridgeline FC, Inc')).toBe('"Ridgeline FC, Inc"');
    expect(csvCell('the "big" order')).toBe('"the ""big"" order"');
    expect(csvCell('line one\nline two')).toBe('"line one\nline two"');
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });

  it.each(['=HYPERLINK("http://x")', '+1', '-1', '@SUM(A1)', '\tindented', '\rreturned'])(
    'defuses a would-be formula: %j',
    (value) => {
      expect(csvCell(value).replace(/^"/, '')).toMatch(/^'/);
    },
  );

  it('prefixes a formula, and quotes it too when it needs quoting', () => {
    expect(csvCell('=2+2')).toBe("'=2+2");
    expect(csvCell('=1+1,2')).toBe(`"'=1+1,2"`);
  });

  it('keeps a real number a number, sign and all', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell('-12.5')).toBe("'-12.5");
  });

  it('writes a Date as ISO 8601', () => {
    expect(csvCell(new Date('2026-09-11T08:00:00Z'))).toBe('2026-09-11T08:00:00.000Z');
  });
});

describe('csvRow', () => {
  it('joins cells with commas and ends the line with CRLF', () => {
    expect(csvRow(['INK-000001', null, 'a,b', 3])).toBe('INK-000001,,"a,b",3\r\n');
  });
});
