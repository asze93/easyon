-- 1. TILFØJ MANGLENDE KOLONNER TIL ALLE TABELLER
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.anmodninger ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.lokationer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.lager ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.kategorier ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.brugere ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.firmaer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2. SIKR AT RLS ER AKTIVERET
ALTER TABLE public.opgaver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anmodninger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lokationer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lager ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategorier ENABLE ROW LEVEL SECURITY;

-- 3. UNIVERSELLE ADGANGS-POLICIES (SELECT FOR ALLE I SAMME FIRMA)
-- Vi bruger subqueries til at tjekke firma_id via brugere-tabellen

-- OPGAVER
DROP POLICY IF EXISTS "Anyone in firm can see tasks" ON public.opgaver;
CREATE POLICY "Anyone in firm can see tasks" ON public.opgaver FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

-- ANMODNINGER
DROP POLICY IF EXISTS "Anyone in firm can see requests" ON public.anmodninger;
CREATE POLICY "Anyone in firm can see requests" ON public.anmodninger FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

-- ASSETS
DROP POLICY IF EXISTS "Anyone in firm can see assets" ON public.assets;
CREATE POLICY "Anyone in firm can see assets" ON public.assets FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

-- LOKATIONER
DROP POLICY IF EXISTS "Anyone in firm can see locations" ON public.lokationer;
CREATE POLICY "Anyone in firm can see locations" ON public.lokationer FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

-- LAGER
DROP POLICY IF EXISTS "Users can see parts from their own company" ON public.lager;
CREATE POLICY "Users can see parts from their own company" ON public.lager FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

-- KATEGORIER
DROP POLICY IF EXISTS "Anyone in firm can see categories" ON public.kategorier;
CREATE POLICY "Anyone in firm can see categories" ON public.kategorier FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));


-- 4. ADMIN MANAGEMENT POLICIES (INSERT/UPDATE/DELETE FOR ADMINS)
-- ADMINS KAN ALT PÅ FIRMAETS DATA
DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    AND table_name IN ('opgaver', 'anmodninger', 'assets', 'lokationer', 'lager', 'kategorier')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Admins can manage %I" ON public.%I FOR ALL 
      USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE ''%%admin%%'' OR rolle ILIKE ''%%superbruger%%'')))
      WITH CHECK (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE ''%%admin%%'' OR rolle ILIKE ''%%superbruger%%'')))', t, t);
  END LOOP;
END $$;

-- 5. EKSTRA FIXES (Stregkode unik, men tillad flere NULLs)
DROP INDEX IF EXISTS lager_stregkode_idx;
CREATE UNIQUE INDEX IF NOT EXISTS lager_stregkode_idx ON public.lager (stregkode_sscc) WHERE (stregkode_sscc IS NOT NULL);
