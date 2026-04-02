-- 1. TILFØJ MANGLENDE KOLONNER TIL ALLE TABELLER
-- Vi sikrer at alle tabeller har 'created_at' så dashboardet kan sortere rigtigt
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.anmodninger ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.lokationer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.lager ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.kategorier ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.brugere ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.firmaer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2. SIKR UUID TYPE PÅ FIRMA_ID (hvor det muligt/nødvendigt)
-- Vi lader dog RLS håndtere dette med ::uuid cast for at være mest kompatible.

-- 3. OPDATER RLS FOR LAGER (UUID Cast)
ALTER TABLE public.lager ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see parts from their own company" ON public.lager;
CREATE POLICY "Users can see parts from their own company" ON public.lager 
FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage parts" ON public.lager;
CREATE POLICY "Admins can manage parts" ON public.lager 
FOR ALL USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

-- 4. OPDATER RLS FOR OPGAVER (UUID Cast)
ALTER TABLE public.opgaver ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone in firm can see tasks" ON public.opgaver;
CREATE POLICY "Anyone in firm can see tasks" ON public.opgaver 
FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tasks" ON public.opgaver;
CREATE POLICY "Admins can manage tasks" ON public.opgaver 
FOR ALL USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

-- 5. OPDATER RLS FOR LOKATIONER & ASSETS
ALTER TABLE public.lokationer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in firm can see locations" ON public.lokationer;
CREATE POLICY "Anyone in firm can see locations" ON public.lokationer 
FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Anyone in firm can see assets" ON public.assets;
CREATE POLICY "Anyone in firm can see assets" ON public.assets 
FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));
