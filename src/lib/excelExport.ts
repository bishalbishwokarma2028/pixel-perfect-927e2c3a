import ExcelJS from 'exceljs';
import { Consignment } from '../types';
import logoUrl from '../assets/ado-logo.png';
import qrUrl from '../assets/ado-qr.png';

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };

async function saveWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * MASTER WAREHOUSE EXPORT (Guangzhou & Yiwu Hubs)
 *
 * Fixed column order (never re-sorted / re-arranged):
 * Date → Consignment No. → Marka → Total CTN → Loaded CTN from <Origin> → CBM → GW (KG)
 * → Destination → Status → Client Name → Lot No. → Container → Dispatched Date
 * → each transit hub with its 4 sub-columns → Remarks
 */
export async function exportConsignmentsToExcel(
  items: Consignment[],
  filename: string,
  title: string = 'Consignment Cargo Report',
  options: { showLoadedCtn?: boolean; loadedCtnLabel?: string } = {}
) {
  if (items.length === 0) return;

  const showLoadedCtn = options.showLoadedCtn ?? true;
  const loadedCtnLabel = options.loadedCtnLabel || `Loaded CTN from ${items[0]?.origin || 'Warehouse'}`;
  const loadedOf = (c: Consignment) => c.loadedCtn ?? c.totalCtn ?? 0;

  const transitHubs = [
    { key: 'LHASA' as const, label: 'Lhasa' },
    { key: 'NYLAM' as const, label: 'Nyalam' },
    { key: 'KERUNG' as const, label: 'Kerung' },
    { key: 'TATOPANI' as const, label: 'Tatopani' },
    { key: 'RASUWA' as const, label: 'Rasuwa' },
  ];
  const SUB_COLS = 4;

  const leadHeaders = [
    'Date',
    'Consignment No.',
    'Marka',
    'Total CTN',
    ...(showLoadedCtn ? [loadedCtnLabel] : []),
    'CBM',
    'GW (KG)',
    'Destination',
    'Status',
    'Client Name',
    'Lot No.',
    'Container',
    'Dispatched Date',
  ];
  const leadingCols = leadHeaders.length;
  const totalColumns = leadingCols + transitHubs.length * SUB_COLS + 1;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ADO International Supply Chain Management Co Ltd';
  const sheet = workbook.addWorksheet('Consignments', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const lastColLetter = (n: number) => sheet.getColumn(n).letter;

  // Title row
  sheet.mergeCells(`A1:${lastColLetter(totalColumns)}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = `${title} — Generated: ${new Date().toLocaleDateString()}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = CENTER;
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  sheet.getRow(1).height = 26;

  // Header rows 2 & 3
  const row2 = sheet.getRow(2);
  const row3 = sheet.getRow(3);
  leadHeaders.forEach((label, i) => {
    const col = i + 1;
    sheet.mergeCells(2, col, 3, col);
    const cell = sheet.getCell(2, col);
    cell.value = label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = CENTER;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.border = BORDER_THIN;
  });

  let col = leadingCols + 1;
  transitHubs.forEach(hub => {
    sheet.mergeCells(2, col, 2, col + SUB_COLS - 1);
    const g = sheet.getCell(2, col);
    g.value = `${hub.label} Transit Hub`;
    g.font = { bold: true, color: { argb: 'FF93C5FD' }, size: 10 };
    g.alignment = CENTER;
    g.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    g.border = BORDER_THIN;
    ['Container No.', 'Dispatch Date', 'Dispatched To', 'Loaded CTN'].forEach((sub, si) => {
      const c = sheet.getCell(3, col + si);
      c.value = sub;
      c.font = { bold: true, color: { argb: 'FFE2E8F0' }, size: 9 };
      c.alignment = CENTER;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      c.border = BORDER_THIN;
    });
    col += SUB_COLS;
  });
  sheet.mergeCells(2, totalColumns, 3, totalColumns);
  const remarksHeader = sheet.getCell(2, totalColumns);
  remarksHeader.value = 'Remarks';
  remarksHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  remarksHeader.alignment = CENTER;
  remarksHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  remarksHeader.border = BORDER_THIN;
  row2.height = 22;
  row3.height = 18;

  // Data rows — emitted in exactly the order supplied by the warehouse screen.
  items.forEach((c, index) => {
    const values: (string | number)[] = [
      c.date || '',
      c.consignmentNo || '',
      c.marka || '',
      c.totalCtn || 0,
      ...(showLoadedCtn ? [loadedOf(c)] : []),
      c.cbm || 0,
      c.gw || 0,
      c.destination || '',
      c.status || '',
      c.clientName || '',
      c.lotNo || '-',
      c.container || '-',
      c.dispatchedDate || '-',
    ];

    transitHubs.forEach(h => {
      const tp: any = c.transitPoints?.[h.key] || {};
      const hubLoaded = tp.loadedCtn;
      values.push(
        tp.containerNo || '-',
        tp.dispatchDate || tp.loadingDate || '-',
        tp.dispatchedTo || '-',
        hubLoaded === undefined || hubLoaded === null || hubLoaded === '' ? '-' : Number(hubLoaded)
      );
    });
    values.push(c.remarks || '');

    const row = sheet.addRow(values);
    row.eachCell({ includeEmpty: true }, cell => {
      cell.alignment = CENTER;
      cell.border = BORDER_THIN;
      cell.font = { size: 10 };
      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
    [2, 3, 4, ...(showLoadedCtn ? [5] : [])].forEach(i => {
      row.getCell(i).font = { size: 10, bold: true };
    });
  });

  // Grand total
  const totalRowIdx = sheet.rowCount + 1;
  const totalRow = sheet.getRow(totalRowIdx);
  sheet.mergeCells(totalRowIdx, 1, totalRowIdx, 3);
  totalRow.getCell(1).value = `GRAND TOTAL (${items.length} Consignments)`;
  const firstDataRow = 4;
  const lastDataRow = totalRowIdx - 1;
  const sumFormula = (colIdx: number) => ({
    formula: `SUM(${sheet.getColumn(colIdx).letter}${firstDataRow}:${sheet.getColumn(colIdx).letter}${lastDataRow})`,
  });
  totalRow.getCell(4).value = sumFormula(4) as any;
  if (showLoadedCtn) totalRow.getCell(5).value = sumFormula(5) as any;
  totalRow.getCell(showLoadedCtn ? 6 : 5).value = sumFormula(showLoadedCtn ? 6 : 5) as any;
  totalRow.getCell(showLoadedCtn ? 7 : 6).value = sumFormula(showLoadedCtn ? 7 : 6) as any;
  const totalsEndCol = showLoadedCtn ? 7 : 6;
  sheet.mergeCells(totalRowIdx, totalsEndCol + 1, totalRowIdx, totalColumns);
  totalRow.getCell(totalsEndCol + 1).value = 'Cross-Border Cargo Management';
  for (let i = 1; i <= totalColumns; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
    cell.alignment = CENTER;
    cell.border = BORDER_THIN;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  }
  totalRow.height = 22;

  // Column widths
  for (let i = 1; i <= totalColumns; i++) {
    const header = String(sheet.getCell(i <= leadingCols ? 2 : 3, i).value ?? '');
    sheet.getColumn(i).width = Math.min(Math.max(header.length + 4, 12), 28);
  }
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: totalColumns } };

  await saveWorkbook(workbook, filename);
}

/**
 * OFFICIAL ADO CLIENT STATEMENT EXPORT (.xlsx)
 *
 * Reproduces the printed ADO letterhead statement, including the floating
 * ADO logo (top-left) and QR code (right of the contact block). Both images
 * are inserted as movable / resizable Excel pictures.
 */
export async function exportClientLedgerToExcel(
  clientName: string,
  items: Consignment[],
  filename?: string
) {
  if (items.length === 0) return;

  const num = (v: any) => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const portOf = (c: Consignment): string => {
    const s = (c.status || '').toLowerCase();
    const hubs = ['rasuwa', 'tatopani', 'kerung', 'nyalam', 'nylam', 'lhasa'];
    const found = hubs.find(h => s.includes(h));
    if (found) return found === 'nylam' ? 'Nyalam' : found.charAt(0).toUpperCase() + found.slice(1);
    return c.destination || '-';
  };

  const carOf = (c: Consignment): string => {
    if (c.container?.trim()) return c.container.trim();
    const tp = Object.values(c.transitPoints || {}).find((t: any) => t?.containerNo?.trim());
    return (tp as any)?.containerNo?.trim() || '-';
  };

  const rows = items.map(c => [
    c.lotNo || '-',
    carOf(c),
    c.date || '-',
    c.consignmentNo || '-',
    c.marka || '-',
    num(c.totalCtn),
    num(c.cbm),
    num(c.gw),
    portOf(c),
    c.status || '-',
    c.remarks || '-',
  ]);

  const NUM_COLS = 11;
  const safeFilename =
    filename ||
    `ADO_Statement_${clientName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ADO International Supply Chain Management Co Ltd';
  const sheet = workbook.addWorksheet(clientName.slice(0, 28) || 'Statement');
  sheet.properties.showGridLines = false;

  const widths = [12, 16, 18, 18, 16, 10, 10, 12, 14, 22, 26];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));

  const styleBlock = (
    range: string,
    value: string,
    opts: { size?: number; bold?: boolean; height?: number; fill?: string; color?: string } = {}
  ) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = value;
    cell.alignment = CENTER;
    cell.font = {
      bold: opts.bold ?? true,
      size: opts.size ?? 11,
      color: { argb: opts.color ?? 'FF000000' },
    };
    if (opts.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    return cell;
  };

  // ---- LETTERHEAD (rows 1-3): logo occupies A1:B3, titles span C..J ----
  sheet.getRow(1).height = 20;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 20;
  sheet.mergeCells('A1:B3');
  styleBlock('C1:K1', '义乌市阿卓国际供应链管理有限公司', { size: 11 });
  styleBlock('C2:K2', 'ADO INTERNATIONAL SUPPLY CHAIN MANAGEMENT CO LTD', { size: 14 });
  styleBlock('C3:K3', '广东省广州市白云区石井镇凰岗村领龙国际1F001档', { size: 11 });

  // ---- CONTACT BLOCK (rows 4-7): left contacts, right contacts, QR area ----
  for (let r = 4; r <= 7; r++) sheet.getRow(r).height = 20;
  styleBlock(
    'A4:D7',
    'Nepal: +977 9851067385 / 9851066781\nKerung: +8613889021731\nTatopani: +977 9846207176\nLhasa: +8613728961850',
    { size: 10 }
  );
  styleBlock(
    'E4:H7',
    'Chinese Speaking Mobile: +8613322519322\nNepali Speaking Mobile: +8619908916803\nEmail: 1973459072@qq.com\nKathmandu',
    { size: 10 }
  );
  sheet.mergeCells('I4:K7');

  // ---- CLIENT NAME (bold, centred) ----
  const clientCell = styleBlock('A8:K8', clientName, { size: 14 });
  clientCell.font = { bold: true, size: 14 };
  sheet.getRow(8).height = 26;

  // ---- COLUMN HEADERS ----
  const headers = [
    'Lot No',
    'Car No',
    'Consignment Date',
    'Consignment No',
    'Marka',
    'T.CTNS',
    'T.CBM',
    'T.GW',
    'Port',
    'Status',
    'Remarks',
  ];
  const headerRow = sheet.getRow(9);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 10 };
    cell.alignment = CENTER;
    cell.border = BORDER_THIN;
  });
  headerRow.height = 22;

  // ---- DATA ROWS ----
  rows.forEach(r => {
    const row = sheet.addRow(r);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = CENTER;
      cell.border = BORDER_THIN;
      cell.font = { size: 10, bold: colNumber === 5 || colNumber >= NUM_COLS - 1 };
      if (colNumber >= 6 && colNumber <= 8) cell.numFmt = '0.00';
      if (colNumber === NUM_COLS - 1 || colNumber === NUM_COLS) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      }
    });
  });

  // ---- TOTALS ----
  const firstDataRow = 10;
  const lastDataRow = 9 + rows.length;
  const totalRow = sheet.getRow(lastDataRow + 1);
  [6, 7, 8].forEach(ci => {
    const letter = sheet.getColumn(ci).letter;
    totalRow.getCell(ci).value = { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})` } as any;
    totalRow.getCell(ci).numFmt = '0.00';
  });
  for (let i = 1; i <= NUM_COLS; i++) {
    const cell = totalRow.getCell(i);
    cell.alignment = CENTER;
    cell.border = BORDER_THIN;
    cell.font = { size: 10, bold: true };
  }

  // ---- Letterhead is borderless (matches printed statement) ----

  // ---- FLOATING IMAGES: logo (top-left) + QR (right of contact block) ----
  const [logoBuf, qrBuf] = await Promise.all([
    fetchImageBuffer(logoUrl),
    fetchImageBuffer(qrUrl),
  ]);

  if (logoBuf) {
    const logoId = workbook.addImage({ buffer: logoBuf as any, extension: 'png' });
    sheet.addImage(logoId, {
      tl: { col: 0.14, row: 0.5 },
      br: { col: 1.9, row: 2.5 },
      editAs: 'twoCell',
    } as any);
  }

  if (qrBuf) {
    const qrId = workbook.addImage({ buffer: qrBuf as any, extension: 'png' });
    sheet.addImage(qrId, {
      tl: { col: 9.55, row: 3.1 },
      br: { col: 10.45, row: 6.9 },
      editAs: 'twoCell',
    } as any);
  }


  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  await saveWorkbook(workbook, safeFilename);
}
