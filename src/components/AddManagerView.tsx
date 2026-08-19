import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Columns3, ListChecks, Loader2, CornerDownRight } from 'lucide-react';
import { useTableConfig, buildFieldGroups } from '../hooks/useTableConfig';
import { fieldsApi, statusApi, type CustomField, type FieldScope, type FieldType } from '../lib/customFields';
import { useAuthz } from '@/hooks/useAuthz';
import { toast } from 'sonner';

const WAREHOUSES: Array<'Guangzhou' | 'Yiwu'> = ['Guangzhou', 'Yiwu'];

const AddManagerView: React.FC = () => {
  const { fields, statuses, loading, reload } = useTableConfig();
  const { canEdit } = useAuthz();
  const editable = canEdit('add');

  const [warehouse, setWarehouse] = useState<'Guangzhou' | 'Yiwu'>('Guangzhou');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [scope, setScope] = useState<FieldScope>('both');
  const [parentId, setParentId] = useState<string>('');
  const [statusLabel, setStatusLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => buildFieldGroups(fields, warehouse), [fields, warehouse]);
  const parents = useMemo(
    () => fields.filter((f) => !f.parentId && (f.scope === 'both' || f.scope === warehouse)),
    [fields, warehouse],
  );

  const addField = async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await fieldsApi.create({
        label: label.trim(),
        scope,
        fieldType,
        parentId: parentId || null,
      });
      setLabel('');
      setParentId('');
      await reload();
      toast.success('Column added to the warehouse sheets');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the column');
    } finally {
      setBusy(false);
    }
  };

  const removeField = async (f: CustomField) => {
    const kids = fields.filter((c) => c.parentId === f.id).length;
    const msg = kids
      ? `Delete "${f.label}" and its ${kids} sub-column(s)?`
      : `Delete "${f.label}"?`;
    if (!window.confirm(msg)) return;
    try {
      for (const c of fields.filter((c) => c.parentId === f.id)) await fieldsApi.remove(c.id);
      await fieldsApi.remove(f.id);
      await reload();
      toast.success('Column removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the column');
    }
  };

  const addStatus = async () => {
    if (!statusLabel.trim()) return;
    setBusy(true);
    try {
      await statusApi.create(statusLabel.trim());
      setStatusLabel('');
      await reload();
      toast.success('Status option added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the status');
    } finally {
      setBusy(false);
    }
  };

  const removeStatus = async (id: string, lbl: string) => {
    if (!window.confirm(`Delete status "${lbl}"?`)) return;
    try {
      await statusApi.remove(id);
      await reload();
      toast.success('Status option removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the status');
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-500';

  return (
    <div className="space-y-6">
      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          You have read-only access to this section.
        </div>
      )}

      {/* Columns */}
      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800">
          <Columns3 className="h-4 w-4 text-sky-600" /> Warehouse columns &amp; sub-columns
        </h2>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          Anything added here appears instantly in the Guangzhou / Yiwu sheets and in the eye (details) view.
        </p>

        <div className="mt-4 flex gap-2">
          {WAREHOUSES.map((w) => (
            <button
              key={w}
              onClick={() => setWarehouse(w)}
              className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors cursor-pointer ${
                warehouse === w ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        {editable && (
          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
            <input
              className={inputCls}
              placeholder="Column label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addField()}
            />
            <select className={inputCls} value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
            <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as FieldScope)}>
              <option value="both">Both warehouses</option>
              <option value="Guangzhou">Guangzhou only</option>
              <option value="Yiwu">Yiwu only</option>
            </select>
            <select className={inputCls} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Top-level column</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  Sub-column of {p.label}
                </option>
              ))}
            </select>
            <button
              onClick={addField}
              disabled={busy || !label.trim()}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {loading && <p className="text-xs font-bold text-slate-400">Loading configuration…</p>}
          {!loading && groups.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-400">
              No custom columns for {warehouse} yet.
            </p>
          )}
          {groups.map(({ field, children }) => (
            <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-800">{field.label}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {field.fieldType} · {field.scope === 'both' ? 'Both warehouses' : field.scope}
                  </p>
                </div>
                {editable && (
                  <button
                    onClick={() => removeField(field)}
                    className="rounded-lg bg-rose-50 p-2 text-rose-600 transition-colors hover:bg-rose-100 cursor-pointer"
                    title="Delete column"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {children.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-dashed border-slate-200 pt-2">
                  {children.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 pl-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <CornerDownRight className="h-3 w-3 text-slate-300" />
                        {c.label}
                        <span className="text-[10px] uppercase text-slate-400">({c.fieldType})</span>
                      </p>
                      {editable && (
                        <button
                          onClick={() => removeField(c)}
                          className="rounded-md p-1.5 text-rose-500 transition-colors hover:bg-rose-50 cursor-pointer"
                          title="Delete sub-column"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Statuses */}
      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800">
          <ListChecks className="h-4 w-4 text-emerald-600" /> Status dropdown options
        </h2>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          These options power the status dropdown in both warehouse sheets.
        </p>

        {editable && (
          <div className="mt-4 flex gap-2">
            <input
              className={inputCls}
              placeholder="New status label"
              value={statusLabel}
              onChange={(e) => setStatusLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStatus()}
            />
            <button
              onClick={addStatus}
              disabled={busy || !statusLabel.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add status
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-2 text-xs font-bold text-slate-700"
            >
              {s.label}
              {editable && (
                <button
                  onClick={() => removeStatus(s.id, s.label)}
                  className="rounded-full p-1 text-rose-500 transition-colors hover:bg-rose-100 cursor-pointer"
                  title="Delete status"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
          {statuses.length === 0 && !loading && (
            <p className="text-xs font-bold text-slate-400">No status options configured.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default AddManagerView;
