ALTER TABLE public.consignments ADD COLUMN IF NOT EXISTS custom_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'both',
  parent_id uuid REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  field_key text NOT NULL UNIQUE,
  label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read custom fields" ON public.custom_fields FOR SELECT TO authenticated
USING (public.is_active_user(auth.uid()));
CREATE POLICY "Permitted staff add custom fields" ON public.custom_fields FOR INSERT TO authenticated
WITH CHECK (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
CREATE POLICY "Permitted staff update custom fields" ON public.custom_fields FOR UPDATE TO authenticated
USING (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']))
WITH CHECK (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
CREATE POLICY "Permitted staff delete custom fields" ON public.custom_fields FOR DELETE TO authenticated
USING (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));

CREATE TABLE public.status_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_options TO authenticated;
GRANT ALL ON public.status_options TO service_role;
ALTER TABLE public.status_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read status options" ON public.status_options FOR SELECT TO authenticated
USING (public.is_active_user(auth.uid()));
CREATE POLICY "Permitted staff add status options" ON public.status_options FOR INSERT TO authenticated
WITH CHECK (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
CREATE POLICY "Permitted staff update status options" ON public.status_options FOR UPDATE TO authenticated
USING (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']))
WITH CHECK (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
CREATE POLICY "Permitted staff delete status options" ON public.status_options FOR DELETE TO authenticated
USING (public.can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));

INSERT INTO public.status_options (label, sort_order) VALUES
 ('Pending in Guangzhou', 1),
 ('Pending in Yiwu', 2),
 ('On the way to Lhasa', 3),
 ('At Lhasa', 4),
 ('On the way to Nyalam', 5),
 ('At Nyalam', 6),
 ('On the way to Kerung', 7),
 ('At Kerung', 8),
 ('On the way to Tatopani', 9),
 ('At Tatopani', 10),
 ('On the way to Rasuwa', 11),
 ('At Rasuwa', 12),
 ('Nyalam Deliver', 13),
 ('Kerung Deliver', 14),
 ('Tatopani Deliver', 15),
 ('Rasuwa Deliver', 16)
ON CONFLICT (label) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_fields;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_options;