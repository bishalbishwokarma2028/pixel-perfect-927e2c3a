CREATE TABLE public.column_settings (
  key text PRIMARY KEY,
  label text,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.column_settings TO authenticated;
GRANT ALL ON public.column_settings TO service_role;
ALTER TABLE public.column_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read column settings" ON public.column_settings FOR SELECT TO authenticated USING (is_active_user(auth.uid()));
CREATE POLICY "Permitted staff add column settings" ON public.column_settings FOR INSERT TO authenticated WITH CHECK (can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
CREATE POLICY "Permitted staff update column settings" ON public.column_settings FOR UPDATE TO authenticated USING (can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu'])) WITH CHECK (can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
CREATE POLICY "Permitted staff delete column settings" ON public.column_settings FOR DELETE TO authenticated USING (can_edit_any(auth.uid(), ARRAY['guangzhou','yiwu']));
ALTER PUBLICATION supabase_realtime ADD TABLE public.column_settings;