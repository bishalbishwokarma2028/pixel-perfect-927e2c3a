import React from 'react';
import {
  X, Package, MapPin, Calendar, User, Truck, FileText, Hash, Boxes,
  Weight, Ruler, Building2, Container as ContainerIcon, ClipboardCopy, Check,
  ArrowRight, CheckCircle2, Circle, Flag, StickyNote, Tag, Route,
} from 'lucide-react';
import { Consignment, TRANSIT_POINTS, STATUS_OPTIONS } from '../types';
import { formatNumber } from '../lib/utils';

interface ConsignmentDetailModalProps {
  consignment: Consignment | null;
  onClose: () => void;
}

const TONES: Record<string, { ring: string; bg: string; text: string; bar: string }> = {
  blue: { ring: 'ring-blue-200', bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500' },
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  amber: { ring: 'ring-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  indigo: { ring: 'ring-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-700', bar: 'bg-indigo-500' },
  rose: { ring: 'ring-rose-200', bg: 'bg-rose-50', text: 'text-rose-700', bar: 'bg-rose-500' },
};

const Stat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  suffix?: string;
  tone?: keyof typeof TONES;
}> = ({ icon, label, value, suffix, tone = 'blue' }) => {
  const t = TONES[tone];
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ${t.ring} transition-all hover:-translate-y-0.5 hover:shadow-md`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <span className={`rounded-lg ${t.bg} p-1.5 ${t.text}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-black leading-none tracking-tight text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-xs font-bold text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
};

const Field: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean; accent?: string }> = ({
  label, value, mono, accent,
}) => (
  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-colors hover:border-slate-300">
    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    <p className={`mt-1 text-sm font-bold break-words ${mono ? 'font-mono' : ''} ${accent || 'text-slate-800'}`}>
      {value === undefined || value === null || value === '' ? <span className="text-slate-300">—</span> : value}
    </p>
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
    <span className="rounded-md bg-slate-900 p-1 text-white">{icon}</span>
    {children}
  </h3>
);

const ConsignmentDetailModal: React.FC<ConsignmentDetailModalProps> = ({ consignment, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!consignment) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [consignment, onClose]);

  if (!consignment) return null;
  const c = consignment;

  const statusIndex = STATUS_OPTIONS.indexOf(c.status);
  const progress = statusIndex >= 0
    ? Math.round(((statusIndex + 1) / STATUS_OPTIONS.length) * 100)
    : 0;

  const loaded = c.loadedCtn ?? c.totalCtn ?? 0;
  const pending = Math.max((c.totalCtn ?? 0) - loaded, 0);

  const summary = [
    `Consignment: ${c.consignmentNo || '—'}`,
    `Marka: ${c.marka || '—'}`,
    `Client: ${c.clientName || '—'}`,
    `Route: ${c.origin} → ${c.destination || '—'}`,
    `Status: ${c.status}`,
    `CTN: ${formatNumber(c.totalCtn)} (loaded ${formatNumber(loaded)})`,
    `CBM: ${formatNumber(c.cbm)} | GW: ${formatNumber(c.gw)} kg`,
    `Lot: ${c.lotNo || '—'} | Container: ${c.container || '—'} | Dispatched: ${c.dispatchedDate || '—'}`,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const reachedIdx = TRANSIT_POINTS.reduce((acc, tp, i) => {
    const d = c.transitPoints?.[tp];
    return d && (d.containerNo || d.loadingDate || d.dispatchDate) ? i : acc;
  }, -1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="flex max-h-[93vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-slate-100 shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Hero header ─────────────────────────────── */}
        <div className="relative shrink-0 overflow-hidden bg-slate-950 px-6 py-6 text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur">
                <Package className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-300">
                  Consignment dossier
                </p>
                <h2 className="mt-0.5 text-3xl font-black leading-none tracking-tight">
                  {c.consignmentNo || '—'}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 font-mono ring-1 ring-white/15">
                    <Tag className="h-3 w-3" /> {c.marka || '—'}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/15">
                    <User className="h-3 w-3" /> {c.clientName || 'Unknown client'}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/15">
                    <Building2 className="h-3 w-3" /> {c.origin}
                    <ArrowRight className="h-3 w-3 text-indigo-300" />
                    <Flag className="h-3 w-3" /> {c.destination || '—'}
                  </span>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-200 ring-1 ring-emerald-400/40">
                    {c.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold ring-1 ring-white/20 transition-colors hover:bg-white/20 cursor-pointer"
                title="Copy summary"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <ClipboardCopy className="h-4 w-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy summary'}</span>
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-xl bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="relative mt-5">
            <div className="mb-1.5 flex justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <span>Journey progress</span>
              <span className="text-emerald-300">{progress}% complete</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────── */}
        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6 custom-scrollbar">
          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat icon={<Boxes className="h-4 w-4" />} label="Total cartons" value={formatNumber(c.totalCtn)} suffix="CTN" tone="blue" />
            <Stat icon={<Truck className="h-4 w-4" />} label="Loaded" value={formatNumber(loaded)} suffix="CTN" tone="emerald" />
            <Stat icon={<Package className="h-4 w-4" />} label="Pending" value={formatNumber(pending)} suffix="CTN" tone="amber" />
            <Stat icon={<Ruler className="h-4 w-4" />} label="Volume" value={formatNumber(c.cbm)} suffix="CBM" tone="indigo" />
            <Stat icon={<Weight className="h-4 w-4" />} label="Gross weight" value={formatNumber(c.gw)} suffix="KG" tone="rose" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Shipment */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <SectionTitle icon={<FileText className="h-3 w-3" />}>Shipment</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Date" value={c.date} mono />
                <Field label="Consignment no." value={c.consignmentNo} mono />
                <Field label="Origin warehouse" value={c.origin} />
                <Field label="Destination" value={c.destination} />
                <Field label="Marka" value={c.marka} mono accent="text-indigo-700" />
                <Field label="Status" value={c.status} accent="text-emerald-700" />
              </div>
            </section>

            {/* Lot & dispatch */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <SectionTitle icon={<ContainerIcon className="h-3 w-3" />}>Lot &amp; dispatch</SectionTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Lot no." value={c.lotNo} mono accent="text-teal-700" />
                <Field label="Container" value={c.container} mono accent="text-teal-700" />
                <Field label="Dispatched date" value={c.dispatchedDate} mono />
                <Field label={`Loaded CTN from ${c.origin}`} value={formatNumber(loaded)} mono accent="text-emerald-700" />
              </div>
            </section>

            {/* Client & remarks */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 p-4">
              <SectionTitle icon={<User className="h-3 w-3" />}>Client &amp; notes</SectionTitle>
              <div className="space-y-2.5">
                <Field label="Client name" value={c.clientName} accent="text-blue-800" />
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                    <StickyNote className="h-3 w-3" /> Remarks
                  </p>
                  <p className="mt-1 text-sm font-bold text-amber-900">
                    {c.remarks || <span className="text-amber-400">No remarks recorded</span>}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Journey */}
          <section>
            <SectionTitle icon={<Route className="h-3 w-3" />}>Transit journey — checkpoint by checkpoint</SectionTitle>

            {/* Horizontal stepper */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-1 overflow-x-auto pb-4">
                <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
                  <span className="rounded-full bg-slate-900 p-2 text-white">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-black uppercase text-slate-700">{c.origin}</span>
                </div>
                {TRANSIT_POINTS.map((tp, i) => {
                  const done = i <= reachedIdx;
                  const current = i === reachedIdx;
                  return (
                    <React.Fragment key={tp}>
                      <div className={`h-1 min-w-8 flex-1 rounded-full ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      <div className="flex shrink-0 flex-col items-center gap-1.5 px-1">
                        <span className={`rounded-full p-2 ${
                          current ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                            : done ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </span>
                        <span className={`text-[10px] font-black uppercase ${done ? 'text-slate-800' : 'text-slate-400'}`}>
                          {tp}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
                <div className={`h-1 min-w-8 flex-1 rounded-full ${reachedIdx >= 0 ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                <div className="flex shrink-0 flex-col items-center gap-1.5 px-2">
                  <span className="rounded-full bg-slate-100 p-2 text-slate-500">
                    <Flag className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    {c.destination || 'Nepal'}
                  </span>
                </div>
              </div>

              {/* Hub cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TRANSIT_POINTS.map((tp, i) => {
                  const d = c.transitPoints?.[tp];
                  const active = i <= reachedIdx;
                  return (
                    <div
                      key={tp}
                      className={`rounded-xl border p-3.5 transition-all ${
                        active
                          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm'
                          : 'border-dashed border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                          <MapPin className={`h-3.5 w-3.5 ${active ? 'text-emerald-600' : 'text-slate-300'}`} />
                          {tp}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          active ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {active ? 'Reached' : 'Pending'}
                        </span>
                      </div>
                      <dl className="mt-2.5 space-y-1.5 text-[11px]">
                        <div className="flex justify-between gap-2">
                          <dt className="font-bold uppercase tracking-wider text-slate-400">Container</dt>
                          <dd className="font-mono font-bold text-slate-700">{d?.containerNo || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="font-bold uppercase tracking-wider text-slate-400">Loading</dt>
                          <dd className="font-mono font-bold text-slate-700">{d?.loadingDate || '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="font-bold uppercase tracking-wider text-slate-400">Dispatch</dt>
                          <dd className="font-mono font-bold text-slate-700">{d?.dispatchDate || '—'}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* ── Footer ─────────────────────────────── */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-200 bg-white px-6 py-3 text-[11px] font-bold text-slate-400">
          <span className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> {c.id}</span>
          <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Created {new Date(c.createdAt).toLocaleString()}</span>
          <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Updated {new Date(c.updatedAt).toLocaleString()}</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsignmentDetailModal;
