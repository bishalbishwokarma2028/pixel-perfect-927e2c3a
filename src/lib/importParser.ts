import { Consignment, Status, STATUS_OPTIONS } from '../types';

export type ImportField =
  | 'date'
  | 'consignmentNo'
  | 'lotNo'
  | 'clientName'
  | 'marka'
  | 'totalCtn'
  | 'cbm'
  | 'gw'
  | 'destination'
  | 'status'
  | 'remarks';

export interface ParseResult {
  rows: Partial<Consignment>[];
  mapping: Record<number, ImportField>;
  headerDetected: boolean;
  delimiter: 'tab' | 'comma' | 'semicolon' | 'spaces';
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Low level tokenizing                                                */
/* ------------------------------------------------------------------ */

const detectDelimiter = (text: string): ParseResult['delimiter'] => {
  const firstLines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 5);
  const count = (re: RegExp) =>
    firstLines.reduce((n, l) => n + (l.match(re)?.length || 0), 0);
  if (count(/\t/g) > 0) return 'tab';
  if (count(/;/g) >= firstLines.length) return 'semicolon';
  if (count(/,/g) >= firstLines.length) return 'comma';
  if (count(/ {2,}/g) > 0) return 'spaces';
  return 'tab';
};

/** Splits the whole pasted text into rows/cells, honouring "quoted" cells
 *  (including quoted cells that contain the delimiter or a line break). */
export const tokenize = (text: string, delimiter: ParseResult['delimiter']): string[][] => {
  if (delimiter === 'spaces') {
    return text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.split(/ {2,}|\t/).map(c => c.trim()));
  }

  const delimChar = delimiter === 'tab' ? '\t' : delimiter === 'comma' ? ',' : ';';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      inQuotes = true;
      cell = '';
      continue;
    }
    if (ch === delimChar) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);

  return rows.filter(r => r.some(c => c !== ''));
};

/* ------------------------------------------------------------------ */
/* Value coercion                                                      */
/* ------------------------------------------------------------------ */

export const parseNumber = (val: unknown): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined) return 0;
  let s = String(val).trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '');
  // strip units / currency / spaces
  s = s.replace(/[^0-9.,\-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // whichever comes last is the decimal separator
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // 1,234 -> thousands ; 12,5 -> decimal
    const after = s.length - lastComma - 1;
    s = after === 3 ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negative ? -n : n;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
export const today = () => new Date().toISOString().split('T')[0];

/** Returns YYYY-MM-DD or null when the value clearly is not a date. */
export const tryParseDate = (val: string): string | null => {
  const str = (val || '').trim();
  if (!str) return null;

  // Excel serial number (days since 1899-12-30)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    if (serial > 20000 && serial < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return d.toISOString().split('T')[0];
    }
  }

  // YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  let m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  // D/M/YYYY or M/D/YYYY (2 or 4 digit year)
  m = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    let year = +m[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    let day = a;
    let month = b;
    if (a > 12 && b <= 12) { day = a; month = b; }        // clearly D/M
    else if (b > 12 && a <= 12) { day = b; month = a; }    // clearly M/D
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // 12 May 2025 / May 12, 2025 / 12-May-25
  m = str.match(/^(\d{1,2})[\s\-/]*([A-Za-z]{3,9})[\s\-/,]*(\d{2,4})$/);
  if (m && MONTHS[m[2].toLowerCase().slice(0, 4)] || (m && MONTHS[m[2].toLowerCase().slice(0, 3)])) {
    const mon = MONTHS[m![2].toLowerCase().slice(0, 4)] ?? MONTHS[m![2].toLowerCase().slice(0, 3)];
    let year = +m![3];
    if (year < 100) year += 2000;
    return `${year}-${pad(mon)}-${pad(+m![1])}`;
  }
  m = str.match(/^([A-Za-z]{3,9})[\s\-/]*(\d{1,2})[\s\-/,]*(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 4)] ?? MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mon) {
      let year = +m[3];
      if (year < 100) year += 2000;
      return `${year}-${pad(mon)}-${pad(+m[2])}`;
    }
  }

  return null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Fuzzy-matches free text to a known Status, else null. */
export const matchStatus = (val: string): Status | null => {
  const v = norm(val);
  if (!v) return null;
  const exact = STATUS_OPTIONS.find(o => norm(o) === v);
  if (exact) return exact;
  const partial = STATUS_OPTIONS.find(o => norm(o).includes(v) || v.includes(norm(o)));
  return partial ?? null;
};

/* ------------------------------------------------------------------ */
/* Header mapping                                                      */
/* ------------------------------------------------------------------ */

const HEADER_SYNONYMS: Array<[ImportField, string[]]> = [
  ['date', ['date', 'shipmentdate', 'loadingdate', 'entrydate', 'receiveddate', 'dt', 'miti']],
  ['consignmentNo', ['consignmentno', 'consignment', 'consignmentnumber', 'cnno', 'cn', 'awb', 'blno', 'bl', 'trackingno', 'shipmentno', 'invoiceno']],
  ['lotNo', ['lotno', 'lot', 'lotnumber', 'batch', 'batchno', 'lotbatch']],
  ['clientName', ['clientname', 'client', 'customer', 'customername', 'consignee', 'consigneename', 'party', 'partyname', 'importer', 'receiver', 'name']],
  ['marka', ['marka', 'mark', 'marks', 'markano', 'shippingmark', 'shippingmarks', 'markcode', 'code']],
  ['totalCtn', ['totalctn', 'ctn', 'ctns', 'carton', 'cartons', 'cartonqty', 'qty', 'quantity', 'packages', 'pkgs', 'pcs', 'boxes', 'nofctn', 'noofctn', 'totalcarton']],
  ['cbm', ['cbm', 'volume', 'vol', 'm3', 'cubicmeter', 'cubicmeters', 'totalcbm']],
  ['gw', ['gw', 'grossweight', 'weight', 'kg', 'kgs', 'wt', 'gwkg', 'totalweight', 'netweight', 'nw']],
  ['destination', ['destination', 'dest', 'deliveryto', 'deliverypoint', 'to', 'city', 'place', 'finaldestination']],
  ['status', ['status', 'currentstatus', 'shipmentstatus', 'stage', 'location']],
  ['remarks', ['remarks', 'remark', 'note', 'notes', 'comment', 'comments', 'description', 'details', 'item', 'items', 'goods', 'cargo', 'commodity']],
];

const headerToField = (raw: string): ImportField | null => {
  const h = norm(raw);
  if (!h) return null;
  for (const [field, syns] of HEADER_SYNONYMS) if (syns.includes(h)) return field;
  for (const [field, syns] of HEADER_SYNONYMS) {
    if (syns.some(s => s.length >= 3 && (h === s || h.startsWith(s) || h.endsWith(s)))) return field;
  }
  for (const [field, syns] of HEADER_SYNONYMS) {
    if (syns.some(s => s.length >= 4 && h.includes(s))) return field;
  }
  return null;
};

const looksLikeHeader = (cells: string[]): boolean => {
  const nonEmpty = cells.filter(c => c.trim());
  if (nonEmpty.length < 2) return false;
  const mapped = nonEmpty.filter(c => headerToField(c) !== null).length;
  const numeric = nonEmpty.filter(c => /^[\d.,]+$/.test(c.trim())).length;
  const dated = nonEmpty.filter(c => tryParseDate(c) !== null).length;
  return numeric === 0 && dated === 0 && mapped >= Math.max(2, Math.ceil(nonEmpty.length * 0.4));
};

/* ------------------------------------------------------------------ */
/* Positional inference (no header row)                                */
/* ------------------------------------------------------------------ */

const DEST_HINTS = ['kathmandu', 'ktm', 'pokhara', 'birgunj', 'biratnagar', 'butwal', 'nepalgunj', 'bhairahawa', 'chitwan', 'narayanghat', 'dharan', 'itahari', 'hetauda', 'lalitpur', 'bhaktapur', 'rasuwa', 'kerung', 'tatopani', 'lhasa', 'nyalam'];

const inferMapping = (rows: string[][]): Record<number, ImportField> => {
  const width = Math.max(...rows.map(r => r.length));
  const col = (i: number) => rows.map(r => (r[i] ?? '').trim());
  const ratio = (vals: string[], fn: (v: string) => boolean) => {
    const filled = vals.filter(v => v !== '');
    if (!filled.length) return 0;
    return filled.filter(fn).length / filled.length;
  };

  const mapping: Record<number, ImportField> = {};
  const used = new Set<ImportField>();
  const assign = (i: number, f: ImportField) => {
    if (mapping[i] !== undefined || used.has(f)) return;
    mapping[i] = f;
    used.add(f);
  };

  const stats = Array.from({ length: width }, (_, i) => {
    const vals = col(i);
    const nums = vals.filter(v => v !== '' && /^[\s\d.,\-]+$/.test(v)).map(parseNumber);
    return {
      i,
      vals,
      dateRatio: ratio(vals, v => tryParseDate(v) !== null),
      numRatio: ratio(vals, v => /^[\s\d.,\-]+$/.test(v) && v !== ''),
      statusRatio: ratio(vals, v => matchStatus(v) !== null),
      destRatio: ratio(vals, v => DEST_HINTS.includes(norm(v))),
      decimalRatio: ratio(vals, v => /[.,]\d/.test(v)),
      avgNum: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0,
      avgLen: vals.filter(Boolean).reduce((a, b) => a + b.length, 0) / Math.max(1, vals.filter(Boolean).length),
      codeRatio: ratio(vals, v => /^[A-Za-z]{0,6}[-/ ]?\d+[A-Za-z0-9\-/]*$/.test(v) && v.length <= 18),
      wordRatio: ratio(vals, v => /[A-Za-z]{3,}\s|[A-Za-z]{4,}/.test(v) && !/^\d/.test(v)),
    };
  });

  // 1. date
  const dateCol = stats.filter(s => s.dateRatio >= 0.6).sort((a, b) => b.dateRatio - a.dateRatio)[0];
  if (dateCol) assign(dateCol.i, 'date');

  // 2. status
  const statusCol = stats.filter(s => !mapping[s.i] && s.statusRatio >= 0.5).sort((a, b) => b.statusRatio - a.statusRatio)[0];
  if (statusCol) assign(statusCol.i, 'status');

  // 3. destination
  const destCol = stats.filter(s => !mapping[s.i] && s.destRatio >= 0.5).sort((a, b) => b.destRatio - a.destRatio)[0];
  if (destCol) assign(destCol.i, 'destination');

  // 4. numeric block -> ctn / cbm / gw
  const numCols = stats.filter(s => !mapping[s.i] && s.numRatio >= 0.7);
  if (numCols.length >= 3) {
    // take the 3 numeric columns that sit closest together
    let best = numCols.slice(0, 3);
    for (let k = 0; k + 2 < numCols.length; k++) {
      const win = numCols.slice(k, k + 3);
      if (win[2].i - win[0].i < best[2].i - best[0].i) best = win;
    }
    const cbmCol = [...best].sort((a, b) => (b.decimalRatio - a.decimalRatio) || (a.avgNum - b.avgNum))[0];
    const rest = best.filter(s => s.i !== cbmCol.i);
    const gwCol = [...rest].sort((a, b) => b.avgNum - a.avgNum)[0];
    const ctnCol = rest.find(s => s.i !== gwCol.i)!;
    assign(ctnCol.i, 'totalCtn');
    assign(cbmCol.i, 'cbm');
    assign(gwCol.i, 'gw');
  } else if (numCols.length === 2) {
    const cbmCol = [...numCols].sort((a, b) => (b.decimalRatio - a.decimalRatio) || (a.avgNum - b.avgNum))[0];
    const other = numCols.find(s => s.i !== cbmCol.i)!;
    assign(other.i, 'totalCtn');
    assign(cbmCol.i, 'cbm');
  } else if (numCols.length === 1) {
    assign(numCols[0].i, 'totalCtn');
  }

  // 5. remaining text columns, left to right
  const remaining = stats.filter(s => mapping[s.i] === undefined && s.vals.some(v => v !== ''));
  const textOrder: ImportField[] = ['consignmentNo', 'clientName', 'marka', 'destination', 'remarks'];
  // consignment no = first code-like column
  const cnCol = remaining.find(s => s.codeRatio >= 0.6);
  if (cnCol) assign(cnCol.i, 'consignmentNo');
  // marka = short code-like column that isn't consignment no
  const markaCol = remaining.find(s => mapping[s.i] === undefined && s.codeRatio >= 0.5 && s.avgLen <= 14);
  if (markaCol) assign(markaCol.i, 'marka');
  // client = wordy column with the longest values
  const clientCol = remaining
    .filter(s => mapping[s.i] === undefined && s.wordRatio >= 0.5)
    .sort((a, b) => b.avgLen - a.avgLen)[0];
  if (clientCol) assign(clientCol.i, 'clientName');

  for (const s of remaining) {
    if (mapping[s.i] !== undefined) continue;
    const next = textOrder.find(f => !used.has(f));
    if (next) assign(s.i, next);
    else mapping[s.i] = 'remarks';
  }

  return mapping;
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const parseImportText = (
  text: string,
  origin: 'Guangzhou' | 'Yiwu',
  makeId: () => string,
): ParseResult => {
  const warnings: string[] = [];
  const delimiter = detectDelimiter(text);
  let grid = tokenize(text, delimiter);
  if (grid.length === 0) return { rows: [], mapping: {}, headerDetected: false, delimiter, warnings };

  // drop fully empty trailing columns
  const width = Math.max(...grid.map(r => r.length));
  grid = grid.map(r => {
    const copy = r.slice(0, width);
    while (copy.length < width) copy.push('');
    return copy;
  });

  let mapping: Record<number, ImportField> = {};
  let headerDetected = false;
  let dataRows = grid;

  if (looksLikeHeader(grid[0])) {
    headerDetected = true;
    dataRows = grid.slice(1);
    const taken = new Set<ImportField>();
    grid[0].forEach((h, i) => {
      const f = headerToField(h);
      if (f && !taken.has(f)) {
        mapping[i] = f;
        taken.add(f);
      }
    });
    const unmapped = grid[0].filter((h, i) => h.trim() && mapping[i] === undefined);
    if (unmapped.length) warnings.push(`Ignored unrecognised column(s): ${unmapped.join(', ')}`);
    if (dataRows.length === 0) warnings.push('Header row found but no data rows below it.');
    // fall back to inference if the header gave us almost nothing
    if (Object.keys(mapping).length < 2 && dataRows.length) {
      mapping = inferMapping(dataRows);
      warnings.push('Header row was unclear — columns were detected from the data instead.');
    }
  } else {
    mapping = inferMapping(grid);
    warnings.push('No header row found — columns were detected from the data.');
  }

  const rows: Partial<Consignment>[] = [];
  dataRows.forEach((cells, rowIdx) => {
    if (!cells.some(c => c.trim())) return;
    const get = (f: ImportField): string => {
      const idx = Object.keys(mapping).find(k => mapping[+k] === f);
      return idx === undefined ? '' : (cells[+idx] ?? '').trim();
    };
    // Anything mapped to remarks (there may be several) gets joined
    const remarkParts = Object.keys(mapping)
      .filter(k => mapping[+k] === 'remarks')
      .map(k => (cells[+k] ?? '').trim())
      .filter(Boolean);

    const rawDate = get('date');
    const parsedDate = tryParseDate(rawDate);
    if (rawDate && !parsedDate) warnings.push(`Row ${rowIdx + 1}: could not read date "${rawDate}" — used today's date.`);

    const rawStatus = get('status');
    const status = matchStatus(rawStatus) ?? (`Pending in ${origin}` as Status);
    if (rawStatus && !matchStatus(rawStatus)) warnings.push(`Row ${rowIdx + 1}: unknown status "${rawStatus}" — set to "${status}".`);

    let consignmentNo = get('consignmentNo').trim();
    if (!consignmentNo) consignmentNo = `CON-${Math.floor(1000 + Math.random() * 9000)}`;

    rows.push({
      id: makeId(),
      origin,
      date: parsedDate ?? today(),
      consignmentNo,
      lotNo: get('lotNo'),
      clientName: get('clientName') || 'Direct Client',
      marka: get('marka'),
      totalCtn: parseNumber(get('totalCtn')),
      cbm: parseNumber(get('cbm')),
      gw: parseNumber(get('gw')),
      destination: get('destination') || 'Kathmandu',
      status,
      remarks: remarkParts.join(' | '),
      transitPoints: {},
    });
  });

  return { rows, mapping, headerDetected, delimiter, warnings };
};

export const FIELD_LABELS: Record<ImportField, string> = {
  date: 'Date',
  consignmentNo: 'Consignment No',
  lotNo: 'Lot No',
  clientName: 'Client Name',
  marka: 'Marka',
  totalCtn: 'Total CTN',
  cbm: 'CBM',
  gw: 'GW (KG)',
  destination: 'Destination',
  status: 'Status',
  remarks: 'Remarks',
};
