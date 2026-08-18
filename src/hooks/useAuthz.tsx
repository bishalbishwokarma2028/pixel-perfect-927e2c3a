import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MODULE_IDS, type PermissionMap } from "@/lib/permissions";

type Authz = {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  isActive: boolean;
  permissions: PermissionMap;
  canView: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  visibleModules: string[];
  refresh: () => Promise<void>;
};

const AuthzContext = createContext<Authz | null>(null);

export function useAuthz(): Authz {
  const ctx = useContext(AuthzContext);
  if (!ctx) throw new Error("useAuthz must be used inside <AuthzProvider>");
  return ctx;
}

export function AuthzProvider({
  session,
  children,
  onRevoked,
}: {
  session: Session | null;
  children: React.ReactNode;
  onRevoked: () => void;
}) {
  const userId = session?.user.id ?? null;
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [permissions, setPermissions] = useState<PermissionMap>({});

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const [{ data: profile }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("is_active").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("module_permissions").select("module, can_view, can_edit").eq("user_id", userId),
    ]);

    const active = Boolean((profile as { is_active?: boolean } | null)?.is_active);
    const admin = ((roles ?? []) as { role: string }[]).some((r) => r.role === "admin");
    setIsActive(active);
    setIsAdmin(admin);
    setPermissions(
      Object.fromEntries(
        ((perms ?? []) as { module: string; can_view: boolean; can_edit: boolean }[]).map((p) => [
          p.module,
          { canView: p.can_view, canEdit: p.can_edit },
        ]),
      ),
    );
    setLoading(false);
    if (!active) onRevoked();
  }, [userId, onRevoked]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live access revocation / permission changes.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`authz_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "module_permissions", filter: `user_id=eq.${userId}` },
        () => void refresh(),
      )
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const value = useMemo<Authz>(() => {
    const canView = (module: string) =>
      isActive && (isAdmin || Boolean(permissions[module]?.canView || permissions[module]?.canEdit));
    const canEdit = (module: string) => isActive && (isAdmin || Boolean(permissions[module]?.canEdit));
    return {
      loading,
      session,
      isAdmin,
      isActive,
      permissions,
      canView,
      canEdit,
      visibleModules: MODULE_IDS.filter((m) => canView(m)),
      refresh,
    };
  }, [loading, session, isAdmin, isActive, permissions, refresh]);

  return <AuthzContext.Provider value={value}>{children}</AuthzContext.Provider>;
}
