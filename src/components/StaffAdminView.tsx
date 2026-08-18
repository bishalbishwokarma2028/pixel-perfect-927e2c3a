import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Plus, ShieldCheck, Trash2, UserCheck, UserX, KeyRound, Save, X,
} from "lucide-react";
import {
  createStaff, deleteStaff, listStaff, resetStaffPassword, setStaffActive, setStaffPermissions,
} from "@/lib/staff.functions";
import { MODULES, emptyPermissions, type PermissionMap, type StaffMember } from "@/lib/permissions";

export default function StaffAdminView() {
  const fetchStaff = useServerFn(listStaff);
  const addStaff = useServerFn(createStaff);
  const savePerms = useServerFn(setStaffPermissions);
  const toggleActive = useServerFn(setStaffActive);
  const removeStaff = useServerFn(deleteStaff);
  const resetPassword = useServerFn(resetStaffPassword);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPerms, setNewPerms] = useState<PermissionMap>(emptyPermissions());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPerms, setDraftPerms] = useState<PermissionMap>(emptyPermissions());

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = (await fetchStaff({ data: undefined } as never)) as StaffMember[];
      setStaff(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load staff accounts");
    } finally {
      setLoading(false);
    }
  }, [fetchStaff]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const togglePerm = (
    map: PermissionMap,
    setMap: (next: PermissionMap) => void,
    module: string,
    field: "canView" | "canEdit",
  ) => {
    const current = map[module] ?? { canView: false, canEdit: false };
    const next = { ...current, [field]: !current[field] };
    if (field === "canEdit" && next.canEdit) next.canView = true;
    if (field === "canView" && !next.canView) next.canEdit = false;
    setMap({ ...map, [module]: next });
  };

  const PermGrid = ({
    map,
    setMap,
  }: {
    map: PermissionMap;
    setMap: (next: PermissionMap) => void;
  }) => (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {MODULES.map((m) => {
        const p = map[m.id] ?? { canView: false, canEdit: false };
        return (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2"
          >
            <span className="text-[11px] font-bold text-slate-700">{m.label}</span>
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={p.canView}
                  onChange={() => togglePerm(map, setMap, m.id, "canView")}
                  className="accent-sky-500"
                />
                View
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={p.canEdit}
                  onChange={() => togglePerm(map, setMap, m.id, "canEdit")}
                  className="accent-sky-500"
                />
                Edit
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-2xs">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
            <ShieldCheck size={16} className="text-sky-500" />
            Staff Accounts & Permissions
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Only administrators can create accounts. Staff sign in with the credentials you set here.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600"
        >
          {showCreate ? <X size={14} /> : <Plus size={14} />}
          {showCreate ? "Cancel" : "New staff account"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
          {notice}
        </div>
      )}

      {showCreate && (
        <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Full name"
              className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="staff@company.com"
              className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Temporary password (min 8 chars)"
              className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs"
            />
          </div>
          <PermGrid map={newPerms} setMap={setNewPerms} />
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await addStaff({
                  data: {
                    email: newEmail.trim(),
                    password: newPassword,
                    fullName: newName.trim(),
                    permissions: MODULES.map((m) => ({
                      module: m.id,
                      canView: Boolean(newPerms[m.id]?.canView || newPerms[m.id]?.canEdit),
                      canEdit: Boolean(newPerms[m.id]?.canEdit),
                    })),
                  },
                });
                setShowCreate(false);
                setNewEmail("");
                setNewName("");
                setNewPassword("");
                setNewPerms(emptyPermissions());
              }, "Staff account created.")
            }
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create account
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-xs font-bold text-slate-500">
          <Loader2 size={15} className="animate-spin" /> Loading accounts…
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <div key={member.id} className="rounded-2xl border border-sky-200 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                    {member.fullName || member.email}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        member.role === "admin"
                          ? "bg-sky-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {member.role}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        member.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                      }`}
                    >
                      {member.isActive ? "active" : "disabled"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">{member.email}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {member.role !== "admin" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => {
                          setEditingId(editingId === member.id ? null : member.id);
                          setDraftPerms({ ...emptyPermissions(), ...member.permissions });
                        }}
                        className="rounded-xl border border-sky-200 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-50"
                      >
                        Permissions
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => toggleActive({ data: { userId: member.id, isActive: !member.isActive } }),
                            member.isActive ? "Account disabled." : "Account enabled.",
                          )
                        }
                        className="flex items-center gap-1 rounded-xl border border-sky-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-sky-50"
                      >
                        {member.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                        {member.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const pw = window.prompt(`New password for ${member.email} (min 8 chars)`);
                          if (!pw) return;
                          void run(
                            () => resetPassword({ data: { userId: member.id, password: pw } }),
                            "Password updated.",
                          );
                        }}
                        className="flex items-center gap-1 rounded-xl border border-sky-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-sky-50"
                      >
                        <KeyRound size={13} /> Password
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Remove ${member.email}? This cannot be undone.`)) return;
                          void run(() => removeStaff({ data: { userId: member.id } }), "Account removed.");
                        }}
                        className="flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editingId === member.id && (
                <div className="mt-3 space-y-3 border-t border-sky-100 pt-3">
                  <PermGrid map={draftPerms} setMap={setDraftPerms} />
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await savePerms({
                          data: {
                            userId: member.id,
                            permissions: MODULES.map((m) => ({
                              module: m.id,
                              canView: Boolean(draftPerms[m.id]?.canView || draftPerms[m.id]?.canEdit),
                              canEdit: Boolean(draftPerms[m.id]?.canEdit),
                            })),
                          },
                        });
                        setEditingId(null);
                      }, "Permissions saved.")
                    }
                    className="flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save permissions
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
