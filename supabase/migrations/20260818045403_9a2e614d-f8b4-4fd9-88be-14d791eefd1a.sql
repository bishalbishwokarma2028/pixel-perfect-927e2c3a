CREATE TABLE public.consignments (
  id text PRIMARY KEY,
  origin text NOT NULL DEFAULT 'Guangzhou',
  date text NOT NULL DEFAULT '',
  consignment_no text NOT NULL DEFAULT '',
  lot_no text,
  marka text NOT NULL DEFAULT '',
  total_ctn numeric NOT NULL DEFAULT 0,
  cbm numeric NOT NULL DEFAULT 0,
  gw numeric NOT NULL DEFAULT 0,
  destination text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Pending in Guangzhou',
  client_name text NOT NULL DEFAULT '',
  remarks text NOT NULL DEFAULT '',
  transit_points jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignments TO authenticated;
GRANT ALL ON public.consignments TO service_role;
ALTER TABLE public.consignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in team can read consignments" ON public.consignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in team can add consignments" ON public.consignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in team can update consignments" ON public.consignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in team can delete consignments" ON public.consignments FOR DELETE TO authenticated USING (true);

CREATE INDEX consignments_origin_idx ON public.consignments (origin);
CREATE INDEX consignments_client_idx ON public.consignments (client_name);

CREATE TABLE public.notes (
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT 'Untitled Note',
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  image_url text,
  audio_transcription text,
  audio_data_url text,
  audio_duration numeric,
  is_pinned boolean NOT NULL DEFAULT false,
  color_theme text NOT NULL DEFAULT 'amber',
  linked_consignment_no text,
  linked_marka text,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in team can read notes" ON public.notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in team can add notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in team can update notes" ON public.notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Signed-in team can delete notes" ON public.notes FOR DELETE TO authenticated USING (true);

ALTER TABLE public.consignments
  ADD COLUMN IF NOT EXISTS container text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dispatched_date text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS loaded_ctn numeric;

INSERT INTO public.consignments (id, origin, date, consignment_no, marka, total_ctn, cbm, gw, destination, status, client_name, remarks, transit_points, created_at, updated_at) VALUES
('c1', 'Guangzhou', '2023-10-01', 'GZ-1001', 'ABC-1', 50, 5.2, 500, 'Kathmandu', 'At Lhasa', 'Everest Traders', 'Urgent', '{"LHASA": {"containerNo": "CONT-123", "loadingDate": "2023-10-05"}}'::jsonb, 1696118400000, 1696118400000),
('c2', 'Yiwu', '2023-10-02', 'YW-2001', 'XYZ-2', 30, 3.1, 320, 'Pokhara', 'On the way to Lhasa', 'Himalaya Imports', '', '{}'::jsonb, 1696204800000, 1696204800000);