import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PermissionSchema = z.object({
  module: z.string().min(1).max(40),
  canView: z.boolean(),
  canEdit: z.boolean(),
});

const CreateStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  fullName: z.string().max(120).default(""),
  permissions: z.array(PermissionSchema).max(50).default([]),
});

const SetPermissionsSchema = z.object({
  userId: z.string().uuid(),
  permissions: z.array(PermissionSchema).max(50),
});

const SetActiveSchema = z.object({ userId: z.string().uuid(), isActive: z.boolean() });
const DeleteStaffSchema = z.object({ userId: z.string().uuid() });
const ResetPasswordSchema = z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) });

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_active_admin", { _user_id: context.userId });
  if (error || data !== true) throw new Error("Forbidden: admin access required");
}

export const listStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, is_active")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const { data: perms } = await context.supabase
      .from("module_permissions")
      .select("user_id, module, can_view, can_edit");

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      isActive: p.is_active,
      role: ((roles ?? []).find((r) => r.user_id === p.id)?.role ?? "staff") as "admin" | "staff",
      permissions: Object.fromEntries(
        (perms ?? [])
          .filter((r) => r.user_id === p.id)
          .map((r) => [r.module, { canView: r.can_view, canEdit: r.can_edit }]),
      ),
    }));
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the staff account");

    const userId = created.user.id;
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
      is_active: true,
      created_by: context.userId,
    } as never);
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "staff" } as never);

    if (data.permissions.length > 0) {
      await supabaseAdmin.from("module_permissions").insert(
        data.permissions.map((p) => ({
          user_id: userId,
          module: p.module,
          can_view: p.canView,
          can_edit: p.canEdit,
        })) as never,
      );
    }
    return { id: userId };
  });

export const setStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetPermissionsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isTargetAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (isTargetAdmin) throw new Error("Admin accounts always have full access");

    for (const p of data.permissions) {
      const { error } = await supabaseAdmin.from("module_permissions").upsert(
        {
          user_id: data.userId,
          module: p.module,
          can_view: p.canView || p.canEdit,
          can_edit: p.canEdit,
        } as never,
        { onConflict: "user_id,module" },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetActiveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === context.userId) throw new Error("You cannot disable your own admin account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.isActive, updated_at: new Date().toISOString() } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    // Revoke live sessions immediately when disabling.
    if (!data.isActive) {
      await supabaseAdmin.auth.admin.signOut(data.userId, "global").catch(() => undefined);
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "876000h" });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: "none" });
    }
    return { ok: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.userId === context.userId) throw new Error("You cannot remove your own admin account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
