-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Profiles (staff directory)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Per-module permissions
CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, module)
);
GRANT SELECT ON public.module_permissions TO authenticated;
GRANT ALL ON public.module_permissions TO service_role;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active);
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user(_user_id) AND public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_view_any(_user_id uuid, _modules text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_admin(_user_id) OR (
    public.is_active_user(_user_id) AND EXISTS (
      SELECT 1 FROM public.module_permissions
      WHERE user_id = _user_id AND module = ANY(_modules) AND can_view
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_any(_user_id uuid, _modules text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_admin(_user_id) OR (
    public.is_active_user(_user_id) AND EXISTS (
      SELECT 1 FROM public.module_permissions
      WHERE user_id = _user_id AND module = ANY(_modules) AND can_edit
    )
  );
$$;

-- Policies: profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
CREATE POLICY "Admins insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_active_admin(auth.uid()));
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));
CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_active_admin(auth.uid()));

-- Policies: user_roles (read-only from client; writes via service role)
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

-- Policies: module_permissions
CREATE POLICY "Users read own permissions" ON public.module_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all permissions" ON public.module_permissions
  FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

-- Replace permissive data policies with permission-aware ones
DROP POLICY IF EXISTS "Signed-in team can read consignments" ON public.consignments;
DROP POLICY IF EXISTS "Signed-in team can add consignments" ON public.consignments;
DROP POLICY IF EXISTS "Signed-in team can update consignments" ON public.consignments;
DROP POLICY IF EXISTS "Signed-in team can delete consignments" ON public.consignments;

CREATE POLICY "Permitted staff read consignments" ON public.consignments
  FOR SELECT TO authenticated USING (
    public.can_view_any(auth.uid(), ARRAY['dashboard','inventory','guangzhou','yiwu','lots','clients','analytics','ai'])
  );
CREATE POLICY "Permitted staff add consignments" ON public.consignments
  FOR INSERT TO authenticated WITH CHECK (
    public.can_edit_any(auth.uid(), ARRAY['inventory','guangzhou','yiwu','lots','clients'])
  );
CREATE POLICY "Permitted staff update consignments" ON public.consignments
  FOR UPDATE TO authenticated USING (
    public.can_edit_any(auth.uid(), ARRAY['dashboard','inventory','guangzhou','yiwu','lots','clients'])
  ) WITH CHECK (
    public.can_edit_any(auth.uid(), ARRAY['dashboard','inventory','guangzhou','yiwu','lots','clients'])
  );
CREATE POLICY "Permitted staff delete consignments" ON public.consignments
  FOR DELETE TO authenticated USING (
    public.can_edit_any(auth.uid(), ARRAY['inventory','guangzhou','yiwu','lots','clients'])
  );

DROP POLICY IF EXISTS "Signed-in team can read notes" ON public.notes;
DROP POLICY IF EXISTS "Signed-in team can add notes" ON public.notes;
DROP POLICY IF EXISTS "Signed-in team can update notes" ON public.notes;
DROP POLICY IF EXISTS "Signed-in team can delete notes" ON public.notes;

CREATE POLICY "Permitted staff read notes" ON public.notes
  FOR SELECT TO authenticated USING (public.can_view_any(auth.uid(), ARRAY['notes']));
CREATE POLICY "Permitted staff add notes" ON public.notes
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_any(auth.uid(), ARRAY['notes']));
CREATE POLICY "Permitted staff update notes" ON public.notes
  FOR UPDATE TO authenticated USING (public.can_edit_any(auth.uid(), ARRAY['notes']))
  WITH CHECK (public.can_edit_any(auth.uid(), ARRAY['notes']));
CREATE POLICY "Permitted staff delete notes" ON public.notes
  FOR DELETE TO authenticated USING (public.can_edit_any(auth.uid(), ARRAY['notes']));

-- Realtime
ALTER TABLE public.consignments REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.module_permissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.module_permissions;

-- Seed: existing account becomes the active Admin
INSERT INTO public.profiles (id, email, full_name, is_active)
SELECT id, coalesce(email, ''), 'Administrator', true FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;