import React, { useMemo, useRef, useState } from 'react';
import { Consignment, Status, STATUS_OPTIONS } from '../types';
import { X, Upload, AlertCircle, FileSpreadsheet, Loader2, CheckCircle, Copy, ArrowRight, Trash2, Plus, ArrowLeft, Wand2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatNumber } from '../lib/utils';

interface ImportModalProps {
  origin: 'Guangzhou' | 'Yiwu';
  onClose: () => void;
  onImport: (data: Partial<Consignment>[]) => Promise<void>;
}

type FieldKey =
  | 'ignore'
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

const FIELDS: { key: FieldKey; label: string; type: 'text' | 'number' | 'date' | 'status'; aliases: string[] }[] = [
  { key: 'ignore', label: '— Skip this column —', type: 'text', aliases: [] },
  { key: 'date', label: 'Date', type: 'date', aliases: ['date', 'dt', 'loading date', 'entry date', 'mitti'] },
  { key: 'consignmentNo', label: 'Consignment No', type: 'text', aliases: ['consignment', 'consignment no', 'cons no', 'cn', 'awb', 'bill no', 'invoice'] },
  { key: 'lotNo', label: 'Lot No', type: 'text', aliases: ['lot', 'lot no', 'lot number', 'container'] },
  { key: 'clientName', label: 'Client Name', type: 'text', aliases: ['client', 'client name', 'customer', 'party', 'name', 'consignee'] },
  { key: 'marka', label: 'Marka', type: 'text', aliases: ['marka', 'mark', 'marking', 'shipping mark'] },
  { key: 'totalCtn', label: 'Total CTN', type: 'number', aliases: ['ctn', 'ctns', 'carton', 'cartons', 'total ctn', 'qty', 'quantity', 'pcs', 'packages'] },
  { key: 'cbm', label: 'CBM', type: 'number', aliases: ['cbm', 'volume', 'm3', 'cubic'] },
  { key: 'gw', label: 'Gross Weight (KG)', type: 'number', aliases: ['gw', 'weight', 'kg', 'gross', 'gross weight', 'g.w'] },
  { key: 'destination', label: 'Destination', type: 'text', aliases: ['destination', 'dest', 'to', 'city', 'delivery'] },
  { key: 'status', label: 'Status', type: 'status', aliases: ['status', 'stage', 'position'] },
  { key: 'remarks', label: 'Remarks', type: 'text', aliases: ['remark', 'remarks', 'note', 'notes', 'description', 'comment', 'item'] },
];

const DEFAULT_ORDER: FieldKey[] = [
  'date', 'consignmentNo', 'clientName', 'marka', 'totalCtn', 'cbm', 'gw', 'destination', 'status', 'remarks',
];

const splitLine = (line: string, delim: string): string[] => {
  if (delim !== ',') return line.split(delim).map(c => c.trim());
  // CSV aware split (handles quoted commas)
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

const detectDelimiter = (line: string): string => {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.includes(',')) return ',';
  if (/\s{2,}/.test(line)) return '  ';
  return '\t';
};

const looksLikeHeader = (cols: string[]): boolean => {
  const joined = cols.join(' ').toLowerCase();
  const hits = FIELDS.filter(f => f.key !== 'ignore').filter(f =>
    f.aliases.some(a => joined.includes(a))
  ).length;
  const numeric = cols.filter(c => c && !isNaN(Number(c.replace(/[^0-9.-]/g, '')))).length;
  return hits >= 2 && numeric <= 1;
};

const guessField = (header: string, index: number, used: Set<FieldKey>): FieldKey => {
  const h = header.trim().toLowerCase().replace(/[._]/g, ' ');
  if (h) {
    let best: { key: FieldKey; score: number } | null = null;
    for (const f of FIELDS) {
      if (f.key === 'ignore' || used.has(f.key)) continue;
      for (const a of f.aliases) {
        let score = 0;
        if (h === a) score = 100;
        else if (h.startsWith(a) || h.endsWith(a)) score = 70;
        else if (h.includes(a)) score = 50;
        if (score && (!best || score > best.score)) best = { key: f.key, score };
      }
    }
    if (best) return best.key;
  }
  const fallback = DEFAULT_ORDER[index];
  if (fallback && !used.has(fallback)) return fallback;
  return 'ignore';
};

export default function ImportModal({ origin, onClose, onImport }: ImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pastedData, setPastedData] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [preview, setPreview] = useState<Partial<Consignment>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sampleExcelText = `Date\tConsignment No\tClient Name\tMarka\tTotal CTN\tCBM\tGW\tDestination\tStatus\tRemarks
2025-05-10\tCNP-8001\tABC Trading\tKTM-ABC\t120\t14.5\t2800\tKathmandu\tPending in ${origin}\tElectronics container
2025-05-11\tCNP-8002\tHimalaya Imports\tHIM-01\t250\t28.2\t5200\tKathmandu\tPending in ${origin}\tFabric rolls
2025-05-12\tCNP-8003\tNepal Goods\tNG-99\t85\t9.8\t1950\tPokhara\tPending in ${origin}\tHardware fittings`;

  const copySample = () => {
    navigator.clipboard?.writeText(sampleExcelText).catch(() => {});
    setPastedData(sampleExcelText);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parseDate = (val: string): string => {
    if (!val || !val.trim()) return new Date().toISOString().split('T')[0];
    const str = val.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
      const p = str.split('-');
      return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
    }
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(str)) {
      const p = str.split(/[\/\-\.]/);
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return new Date().toISOString().split('T')[0];
  };

  const matchStatus = (val: string): Status => {
    const v = (val || '').trim().toLowerCase();
    const found = STATUS_OPTIONS.find(s => s.toLowerCase() === v) ||
      STATUS_OPTIONS.find(s => v && s.toLowerCase().includes(v));
    return (found || (`Pending in ${origin}` as Status)) as Status;
  };

  /** STEP 1 → 2: split raw text into a grid and auto-guess headings */
  const buildGrid = (text: string, headerFlag: boolean) => {
    setError(null);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      setError('Please paste some data from Excel first.');
      return;
    }
    const delim = detectDelimiter(lines[0]);
    const grid = lines.map(l => (delim === '  ' ? l.split(/\s{2,}/).map(c => c.trim()) : splitLine(l, delim)));
    const width = Math.max(...grid.map(r => r.length));
    const padded = grid.map(r => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim()));

    const autoHeader = headerFlag && looksLikeHeader(padded[0]);
    const headerRow = autoHeader ? padded[0] : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
    const dataRows = autoHeader ? padded.slice(1) : padded;

    if (dataRows.length === 0) {
      setError('Only a header row was found — no data rows to import.');
      return;
    }

    const used = new Set<FieldKey>();
    const map: FieldKey[] = headerRow.map((h, i) => {
      const key = guessField(autoHeader ? h : '', i, used);
      if (key !== 'ignore') used.add(key);
      return key;
    });

    setHeaders(headerRow);
    setRows(dataRows);
    setMapping(map);
    setHasHeaderRow(autoHeader);
    setStep(2);
  };

  const setColumnField = (index: number, key: FieldKey) => {
    setMapping(prev => prev.map((m, i) => (i === index ? key : m === key && key !== 'ignore' ? 'ignore' : m)));
  };

  const mappedFields = useMemo(() => new Set<FieldKey>(mapping.filter(m => m !== 'ignore')), [mapping]);

  /** STEP 2 → 3: apply mapping */
  const applyMapping = () => {
    setError(null);
    if (!mappedFields.has('consignmentNo') && !mappedFields.has('clientName') && !mappedFields.has('marka')) {
      setError('Map at least one identifying column (Consignment No, Client Name or Marka) before continuing.');
      return;
    }
    const parsed: Partial<Consignment>[] = rows.map(cols => {
      const rec: any = {
        id: uuidv4(),
        origin,
        date: new Date().toISOString().split('T')[0],
        consignmentNo: '',
        lotNo: '',
        clientName: '',
        marka: '',
        totalCtn: 0,
        cbm: 0,
        gw: 0,
        destination: 'Kathmandu',
        status: `Pending in ${origin}` as Status,
        remarks: '',
        transitPoints: {},
      };
      mapping.forEach((field, i) => {
        if (field === 'ignore') return;
        const raw = cols[i] ?? '';
        switch (field) {
          case 'date': rec.date = parseDate(raw); break;
          case 'totalCtn': rec.totalCtn = parseNumber(raw); break;
          case 'cbm': rec.cbm = parseNumber(raw); break;
          case 'gw': rec.gw = parseNumber(raw); break;
          case 'status': rec.status = matchStatus(raw); break;
          case 'destination': rec.destination = raw.trim() || 'Kathmandu'; break;
          case 'remarks': rec.remarks = rec.remarks ? `${rec.remarks} ${raw.trim()}` : raw.trim(); break;
          default: rec[field] = raw.trim();
        }
      });
      if (!rec.consignmentNo) rec.consignmentNo = `CON-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!rec.clientName) rec.clientName = 'Direct Client';
      return rec as Partial<Consignment>;
    });

    if (parsed.length === 0) {
      setError('No rows could be built from the pasted data.');
      return;
    }
    setPreview(parsed);
    setStep(3);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setPastedData(text);
    buildGrid(text, true);
  };

  const handleRemoveRow = (index: number) => setPreview(prev => prev.filter((_, i) => i !== index));

  const handleAddRow = () => {
    setPreview(prev => [
      ...prev,
      {
        id: uuidv4(),
        origin,
        date: new Date().toISOString().split('T')[0],
        consignmentNo: `CON-${Math.floor(1000 + Math.random() * 9000)}`,
        lotNo: '',
        clientName: 'Direct Client',
        marka: '',
        totalCtn: 0,
        cbm: 0,
        gw: 0,
        destination: 'Kathmandu',
        status: `Pending in ${origin}` as Status,
        remarks: '',
        transitPoints: {},
      },
    ]);
  };

  const handleUpdateField = (index: number, field: keyof Consignment, value: any) => {
    setPreview(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const totals = useMemo(() => preview.reduce<{ ctn: number; cbm: number; gw: number }>(
    (acc, r) => ({
      ctn: acc.ctn + (r.totalCtn || 0),
      cbm: acc.cbm + (r.cbm || 0),
      gw: acc.gw + (r.gw || 0),
    }),
    { ctn: 0, cbm: 0, gw: 0 },
  ), [preview]);

  const handleConfirm = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    try {
      await onImport(preview);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import consignments into database.');
      setLoading(false);
    }
  };

  const StepDot = ({ n, label }: { n: 1 | 2 | 3; label: string }) => (
    <div className="flex items-center space-x-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step >= n ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{n}</div>
      <span className={`text-xs font-semibold ${step >= n ? 'text-white' : 'text-slate-500'}`}>{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-inner">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Consignments into {origin} Warehouse</h2>
                <p className="text-xs text-slate-400 mt-0.5">Paste from Excel / upload CSV, choose your own column headings, then review before saving</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center space-x-4 mt-4">
            <StepDot n={1} label="Paste data" />
            <div className="h-px flex-1 bg-slate-700" />
            <StepDot n={2} label="Match headings" />
            <div className="h-px flex-1 bg-slate-700" />
            <StepDot n={3} label="Review & save" />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start space-x-2 text-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Any column order works — you map the headings in the next step
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-200 transition-colors"
                    >
                      <Upload size={13} />
                      <span>Upload CSV / TSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={copySample}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1.5 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <Copy size={13} />
                      <span>{copiedSample ? 'Sample Filled!' : 'Fill with Sample Data'}</span>
                    </button>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
                />
                <p className="text-xs text-slate-500">
                  Supports tab, comma and semicolon separated data. Header row is detected automatically and can be overridden.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Paste Copied Excel Data Here (Ctrl+V / Cmd+V):</label>
                <textarea
                  value={pastedData}
                  onChange={e => setPastedData(e.target.value)}
                  placeholder="Paste rows copied from Excel sheet here..."
                  className="w-full h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs bg-white shadow-inner whitespace-pre overflow-x-auto"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => buildGrid(pastedData, true)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm flex items-center space-x-2 shadow-sm transition-colors"
                >
                  <span>Continue to Heading Mapping</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Wand2 size={15} className="text-emerald-600" /> Set the heading for each column
                  </h3>
                  <p className="text-xs text-slate-500">
                    {rows.length} data rows detected. Change any dropdown to re-assign a column, or skip it entirely.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={e => buildGrid(pastedData, e.target.checked)}
                  />
                  First row contains headings
                </label>
              </div>

              <div className="bg-white border-2 border-slate-400 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar max-h-[420px]">
                  <table className="text-left border-collapse text-xs w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900 text-white">
                        {headers.map((h, i) => (
                          <th key={i} className="border border-slate-600 p-2 align-top min-w-[170px]">
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate" title={h}>{h || `Column ${i + 1}`}</div>
                            <select
                              value={mapping[i] ?? 'ignore'}
                              onChange={e => setColumnField(i, e.target.value as FieldKey)}
                              className={`mt-1 w-full text-[11px] p-1.5 rounded font-bold border ${mapping[i] && mapping[i] !== 'ignore' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                            >
                              {FIELDS.map(f => (
                                <option key={f.key} value={f.key}>{f.label}</option>
                              ))}
                            </select>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r, ri) => (
                        <tr key={ri} className="bg-white hover:bg-blue-50/60">
                          {headers.map((_, ci) => (
                            <td key={ci} className={`border border-slate-300 p-2 truncate max-w-[220px] ${mapping[ci] === 'ignore' ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                              {r[ci] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 8 && (
                  <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200">
                    Showing first 8 of {rows.length} rows
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {FIELDS.filter(f => f.key !== 'ignore').map(f => (
                  <span
                    key={f.key}
                    className={`text-[11px] px-2 py-1 rounded border font-semibold ${mappedFields.has(f.key) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}
                  >
                    {mappedFields.has(f.key) ? '✓ ' : '– '}{f.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Previewing {preview.length} Consignments ready to import into {origin}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Every cell is editable — fix anything before confirming. Totals: {formatNumber(totals.ctn)} CTN · {formatNumber(totals.cbm)} CBM · {formatNumber(totals.gw)} KG
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={13} /> Add Empty Row
                </button>
              </div>

              <div className="bg-white border-2 border-slate-400 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar max-h-[420px]">
                  <table className="w-full text-center border-collapse border border-slate-300 font-sans text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-white z-10">
                      <tr>
                        <th className="border border-slate-600 p-2 font-bold w-10">S.N.</th>
                        <th className="border border-slate-600 p-2 font-bold">Date</th>
                        <th className="border border-slate-600 p-2 font-bold">Consignment No</th>
                        <th className="border border-slate-600 p-2 font-bold bg-teal-950 text-teal-200">Lot No.</th>
                        <th className="border border-slate-600 p-2 font-bold bg-blue-950 text-blue-200">Client Name</th>
                        <th className="border border-slate-600 p-2 font-bold bg-indigo-950 text-indigo-200">Marka</th>
                        <th className="border border-slate-600 p-2 font-bold">Total CTN</th>
                        <th className="border border-slate-600 p-2 font-bold">CBM</th>
                        <th className="border border-slate-600 p-2 font-bold">GW (KG)</th>
                        <th className="border border-slate-600 p-2 font-bold">Destination</th>
                        <th className="border border-slate-600 p-2 font-bold">Status</th>
                        <th className="border border-slate-600 p-2 font-bold">Remarks</th>
                        <th className="border border-slate-600 p-2 font-bold w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-blue-50/60 transition-colors bg-white">
                          <td className="border border-slate-300 p-2 font-mono text-slate-500 font-bold">{idx + 1}</td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="date" value={row.date || ''} onChange={e => handleUpdateField(idx, 'date', e.target.value)}
                              className="w-full text-center text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="text" value={row.consignmentNo || ''} onChange={e => handleUpdateField(idx, 'consignmentNo', e.target.value)}
                              className="w-full text-center font-mono font-bold text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5 bg-teal-50/40">
                            <input type="text" value={row.lotNo || ''} onChange={e => handleUpdateField(idx, 'lotNo', e.target.value)} placeholder="Lot #"
                              className="w-full text-center font-mono font-bold text-teal-800 text-xs p-1 border border-transparent hover:border-teal-300 focus:border-teal-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5 bg-blue-50/40">
                            <input type="text" value={row.clientName || ''} onChange={e => handleUpdateField(idx, 'clientName', e.target.value)}
                              className="w-full text-center font-bold text-blue-700 text-xs p-1 border border-transparent hover:border-blue-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5 bg-indigo-50/40">
                            <input type="text" value={row.marka || ''} onChange={e => handleUpdateField(idx, 'marka', e.target.value)}
                              className="w-full text-center font-bold text-indigo-700 text-xs p-1 border border-transparent hover:border-indigo-300 focus:border-indigo-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="number" value={row.totalCtn} onChange={e => handleUpdateField(idx, 'totalCtn', parseFloat(e.target.value) || 0)}
                              className="w-20 text-center font-bold text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="number" step="any" value={row.cbm} onChange={e => handleUpdateField(idx, 'cbm', parseFloat(e.target.value) || 0)}
                              className="w-20 text-center font-bold text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="number" step="any" value={row.gw} onChange={e => handleUpdateField(idx, 'gw', parseFloat(e.target.value) || 0)}
                              className="w-20 text-center text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="text" value={row.destination || ''} onChange={e => handleUpdateField(idx, 'destination', e.target.value)}
                              className="w-full text-center text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <select value={row.status} onChange={e => handleUpdateField(idx, 'status', e.target.value)}
                              className="text-[11px] p-1 border border-slate-200 rounded font-semibold text-slate-800">
                              {STATUS_OPTIONS.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
                            </select>
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <input type="text" value={row.remarks || ''} onChange={e => handleUpdateField(idx, 'remarks', e.target.value)}
                              className="w-full text-center text-xs p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded" />
                          </td>
                          <td className="border border-slate-300 p-1.5">
                            <button type="button" onClick={() => handleRemoveRow(idx)} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors" title="Remove row">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-slate-100">
                      <tr className="font-bold text-slate-800">
                        <td className="border border-slate-300 p-2" colSpan={6}>TOTAL ({preview.length} rows)</td>
                        <td className="border border-slate-300 p-2">{formatNumber(totals.ctn)}</td>
                        <td className="border border-slate-300 p-2">{formatNumber(totals.cbm)}</td>
                        <td className="border border-slate-300 p-2">{formatNumber(totals.gw)}</td>
                        <td className="border border-slate-300 p-2" colSpan={4}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0 gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-5 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-sm transition-colors shadow-xs">
              Cancel
            </button>
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setError(null); setStep(step === 3 ? 2 : 1); }}
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={15} /> Back
              </button>
            )}
          </div>

          {step === 2 && (
            <button type="button" onClick={applyMapping}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm flex items-center space-x-2 shadow-sm transition-colors">
              <span>Apply Headings & Preview</span>
              <ArrowRight size={16} />
            </button>
          )}

          {step === 3 && preview.length > 0 && (
            <button type="button" onClick={handleConfirm} disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              <span>Confirm & Save {preview.length} Consignments to {origin}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
