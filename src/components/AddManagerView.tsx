import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Columns3,
  ListChecks,
  Loader2,
  CornerDownRight,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Pencil,
  Copy,
  Eye,
  EyeOff,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useTableConfig, buildFieldGroups } from '../hooks/useTableConfig';
import {
  fieldsApi,
  statusApi,
  fieldsExtras,
  statusExtras,
  columnSettingsApi,
  BUILTIN_COLUMNS,
  type CustomField,
  type FieldScope,
  type FieldType,
  type StatusOption,
} from '../lib/customFields';
import { useAuthz } from '@/hooks/useAuthz';
import { toast } from 'sonner';

const WAREHOUSES: Array<'Guangzhou' | 'Yiwu'> = ['Guangzhou', 'Yiwu'];

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-500';

const iconBtn =
  'rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer disabled:opacity-30';

const AddManagerView: React.FC = () => {
  const { fields, statuses, columnSettings, loading, reload } = useTableConfig();
  const { canEdit } = useAuthz();
  const editable = canEdit('add');

  const [warehouse, setWarehouse] = useState<'Guangzhou' | 'Yiwu'>('Guangzhou');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [scope, setScope] = useState<FieldScope>('both');
  const [parentId, setParentId] = useState<string>('');
  const [statusLabel, setStatusLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ label: string; fieldType: FieldType; scope: FieldScope }>({
    label: '',
    fieldType: 'text',
    scope: 'both',
  });
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => buildFieldGroups(fields, warehouse), [fields, warehouse]);
  const parents = useMemo(
    () => fields.filter((f) => !f.parentId && (f.scope === 'both' || f.scope === warehouse)),
    [fields, warehouse],
  );

  const guard = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn();
      await reload();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  const addField = async () => {
    if (!label.trim()) return;
    setBusy(true);
    const siblings = parentId ? fields.filter((f) => f.parentId === parentId) : fields.filter((f) => !f.parentId);
    const nextOrder = (siblings.reduce((m, f) => Math.max(m, f.sortOrder), 0) || 0) + 10;
    await guard(async () => {
      const created = await fieldsApi.create({
        label: label.trim(),
        scope,
        fieldType,
        parentId: parentId || null,
      });
      await fieldsExtras.update(created.id, { sortOrder: nextOrder });
      setLabel('');
      setParentId('');
    }, 'Column added to the warehouse sheets');
    setBusy(false);
  };

  const removeField = async (f: CustomField) => {
    const kids = fields.filter((c) => c.parentId === f.id).length;
    const msg = kids ? `Delete "${f.label}" and its ${kids} sub-column(s)?` : `Delete "${f.label}"?`;
    if (!window.confirm(msg)) return;
    await guard(async () => {
      for (const c of fields.filter((c) => c.parentId === f.id)) await fieldsApi.remove(c.id);
      await fieldsApi.remove(f.id);
    }, 'Column removed');
  };

  const duplicateField = async (f: CustomField) => {
    await guard(async () => {
      const copy = await fieldsApi.create({
        label: `${f.label} (copy)`,
        scope: f.scope,
        fieldType: f.fieldType,
        parentId: f.parentId,
      });
      await fieldsExtras.update(copy.id, { sortOrder: f.sortOrder + 1 });
    }, 'Column duplicated');
  };

  const startEdit = (f: CustomField) => {
    setEditingField(f.id);
    setDraft({ label: f.label, fieldType: f.fieldType, scope: f.scope });
  };

  const saveEdit = async (f: CustomField) => {
    if (!draft.label.trim()) return;
    await guard(async () => {
      await fieldsExtras.update(f.id, {
        label: draft.label,
        fieldType: draft.fieldType,
        scope: draft.scope,
      });
      setEditingField(null);
    }, 'Column updated');
  };

  /** Move a field up/down among its siblings (same parent, in this warehouse view). */
  const moveField = async (f: CustomField, dir: -1 | 1) => {
    const siblings = (f.parentId ? fields.filter((c) => c.parentId === f.parentId) : fields.filter((c) => !c.parentId))
      .filter((c) => c.scope === 'both' || c.scope === warehouse)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    const i = siblings.findIndex((c) => c.id === f.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= siblings.length) return;
    const next = siblings.slice();
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    await guard(() => fieldsExtras.reorder(next.map((c) => c.id)), 'Order updated');
  };

  const addStatus = async () => {
    if (!statusLabel.trim()) return;
    setBusy(true);
    await guard(async () => {
      await statusApi.create(statusLabel.trim());
      setStatusLabel('');
    }, 'Status option added');
    setBusy(false);
  };

  const removeStatus = async (id: string, lbl: string) => {
    if (!window.confirm(`Delete status "${lbl}"?`)) return;
    await guard(() => statusApi.remove(id), 'Status option removed');
  };

  const moveStatus = async (s: StatusOption, dir: -1 | 1) => {
    const list = statuses.slice();
    const i = list.findIndex((x) => x.id === s.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const tmp = list[i]!;
    list[i] = list[j]!;
    list[j] = tmp;
    await guard(() => statusExtras.reorder(list.map((x) => x.id)), 'Status order updated');
  };

  const saveStatusLabel = async (s: StatusOption) => {
    if (!statusDraft.trim()) return;
    await guard(async () => {
      await statusExtras.update(s.id, { label: statusDraft });
      setEditingStatus(null);
    }, 'Status renamed');
  };

  const builtinSetting = (key: string) => columnSettings.find((c) => c.key === key);

  const renameBuiltin = async (key: string, fallback: string) => {
    const current = builtinSetting(key)?.label ?? fallback;
    const next = window.prompt(`Rename "${fallback}" to:`, current);
    if (next === null) return;
    await guard(() => columnSettingsApi.upsert(key, { label: next.trim() || null }), 'Column renamed');
  };

  const toggleBuiltin = async (key: string) => {
    const hidden = !!builtinSetting(key)?.hidden;
    await guard(() => columnSettingsApi.upsert(key, { hidden: !hidden }), hidden ? 'Column shown' : 'Column hidden');
  };

  const resetBuiltin = async (key: string) => {
    await guard(() => columnSettingsApi.upsert(key, { label: null, hidden: false }), 'Column reset');
  };

  return (
    <div className="space-y-6">
      {!editable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          You have read-only access to this section.
        </div>
      )}

      {/* Built-in columns */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800">
          <Columns3 className="h-4 w-4 text-slate-600" /> Built-in warehouse columns
        </h2>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          Rename or hide any standard column of the Guangzhou / Yiwu sheets. Changes apply live everywhere.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BUILTIN_COLUMNS.map((c) => {
            const s = builtinSetting(c.key);
            const hidden = !!s?.hidden;
            const custom = s?.label && s.label.trim() ? s.label : null;
            return (
              <div
                key={c.key}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                  hidden ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-slate-800">{custom ?? c.label}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {custom ? `was ${c.label}` : 'default'} {hidden ? '· hidden' : ''}
                  </p>
                </div>
                {editable && (
                  <div className="flex shrink-0 items-center">
                    <button className={iconBtn} title="Rename" onClick={() => renameBuiltin(c.key, c.label)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className={iconBtn} title={hidden ? 'Show' : 'Hide'} onClick={() => toggleBuiltin(c.key)}>
                      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button className={iconBtn} title="Reset" onClick={() => resetBuiltin(c.key)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom columns */}
      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800">
          <Columns3 className="h-4 w-4 text-sky-600" /> Custom columns &amp; sub-columns
        </h2>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          Anything added here appears instantly in the Guangzhou / Yiwu sheets and in the eye (details) view. Groups with
          sub-columns can be expanded / collapsed in the sheet, just like LHASA or KERUNG.
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
          {groups.map(({ field, children }) => {
            const isCollapsed = !!collapsed[field.id];
            return (
              <div key={field.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  {editingField === field.id ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input
                        className={`${inputCls} max-w-[200px]`}
                        value={draft.label}
                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(field)}
                        autoFocus
                      />
                      <select
                        className={`${inputCls} max-w-[120px]`}
                        value={draft.fieldType}
                        onChange={(e) => setDraft({ ...draft, fieldType: e.target.value as FieldType })}
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                      </select>
                      <select
                        className={`${inputCls} max-w-[170px]`}
                        value={draft.scope}
                        onChange={(e) => setDraft({ ...draft, scope: e.target.value as FieldScope })}
                      >
                        <option value="both">Both warehouses</option>
                        <option value="Guangzhou">Guangzhou only</option>
                        <option value="Yiwu">Yiwu only</option>
                      </select>
                      <button className={iconBtn} title="Save" onClick={() => saveEdit(field)}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </button>
                      <button className={iconBtn} title="Cancel" onClick={() => setEditingField(null)}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="flex items-center gap-2 text-left cursor-pointer"
                        onClick={() => setCollapsed((p) => ({ ...p, [field.id]: !isCollapsed }))}
                      >
                        {children.length > 0 &&
                          (isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ))}
                        <span>
                          <span className="block text-xs font-black text-slate-800">{field.label}</span>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {field.fieldType} · {field.scope === 'both' ? 'Both warehouses' : field.scope}
                            {children.length > 0 ? ` · ${children.length} sub-column(s)` : ''}
                          </span>
                        </span>
                      </button>
                      {editable && (
                        <div className="flex shrink-0 items-center">
                          <button className={iconBtn} title="Move up" onClick={() => moveField(field, -1)}>
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button className={iconBtn} title="Move down" onClick={() => moveField(field, 1)}>
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button className={iconBtn} title="Rename / edit" onClick={() => startEdit(field)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className={iconBtn} title="Duplicate" onClick={() => duplicateField(field)}>
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeField(field)}
                            className="rounded-lg p-1.5 text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
                            title="Delete column"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {children.length > 0 && !isCollapsed && (
                  <div className="mt-2 space-y-1.5 border-t border-dashed border-slate-200 pt-2">
                    {children.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 pl-2">
                        {editingField === c.id ? (
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <input
                              className={`${inputCls} max-w-[200px]`}
                              value={draft.label}
                              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit(c)}
                              autoFocus
                            />
                            <select
                              className={`${inputCls} max-w-[120px]`}
                              value={draft.fieldType}
                              onChange={(e) => setDraft({ ...draft, fieldType: e.target.value as FieldType })}
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                            </select>
                            <button className={iconBtn} title="Save" onClick={() => saveEdit(c)}>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </button>
                            <button className={iconBtn} title="Cancel" onClick={() => setEditingField(null)}>
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                              <CornerDownRight className="h-3 w-3 text-slate-300" />
                              {c.label}
                              <span className="text-[10px] uppercase text-slate-400">({c.fieldType})</span>
                            </p>
                            {editable && (
                              <div className="flex shrink-0 items-center">
                                <button className={iconBtn} title="Move up" onClick={() => moveField(c, -1)}>
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button className={iconBtn} title="Move down" onClick={() => moveField(c, 1)}>
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button className={iconBtn} title="Rename / edit" onClick={() => startEdit(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button className={iconBtn} title="Duplicate" onClick={() => duplicateField(c)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => removeField(c)}
                                  className="rounded-md p-1.5 text-rose-500 transition-colors hover:bg-rose-50 cursor-pointer"
                                  title="Delete sub-column"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Statuses */}
      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-800">
          <ListChecks className="h-4 w-4 text-emerald-600" /> Status dropdown options
        </h2>
        <p className="mt-1 text-[11px] font-semibold text-slate-500">
          These options power the status dropdown in both warehouse sheets — rename, reorder or remove them.
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

        <div className="mt-4 space-y-1.5">
          {statuses.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5"
            >
              {editingStatus === s.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    className={`${inputCls} max-w-[280px]`}
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveStatusLabel(s)}
                    autoFocus
                  />
                  <button className={iconBtn} title="Save" onClick={() => saveStatusLabel(s)}>
                    <Check className="h-4 w-4 text-emerald-600" />
                  </button>
                  <button className={iconBtn} title="Cancel" onClick={() => setEditingStatus(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-bold text-slate-700">{s.label}</span>
                  {editable && (
                    <div className="flex shrink-0 items-center">
                      <button className={iconBtn} title="Move up" onClick={() => moveStatus(s, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button className={iconBtn} title="Move down" onClick={() => moveStatus(s, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className={iconBtn}
                        title="Rename"
                        onClick={() => {
                          setEditingStatus(s.id);
                          setStatusDraft(s.label);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeStatus(s.id, s.label)}
                        className="rounded-lg p-1.5 text-rose-500 transition-colors hover:bg-rose-100 cursor-pointer"
                        title="Delete status"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
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
