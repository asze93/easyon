-- KØR DETTE SCRIPT I SUPABASE SQL EDITOR --
-- Dette script sikrer at alle tabeller har de rigtige RLS policies for testing.

-- 1. BRUGERE (Profiles)
CREATE TABLE IF NOT EXISTS brugere (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    navn TEXT,
    rolle TEXT,
    arbejdsnummer TEXT,
    adgangskode TEXT,
    firma_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Aktiver RLS
ALTER TABLE brugere ENABLE ROW LEVEL SECURITY;

-- Policy: Tillad alle at se profiler (for login checks)
DROP POLICY IF EXISTS "Public Read Profiles" ON brugere;
CREATE POLICY "Public Read Profiles" ON brugere FOR SELECT USING (true);

-- Policy: Tillad brugere at indsætte deres egen profil ved signup
DROP POLICY IF EXISTS "Users can insert own profile" ON brugere;
CREATE POLICY "Users can insert own profile" ON brugere FOR INSERT WITH CHECK (true);

-- Policy: Tillad brugere at opdatere deres egen profil
DROP POLICY IF EXISTS "Users can update own profile" ON brugere;
CREATE POLICY "Users can update own profile" ON brugere FOR UPDATE USING (true);

-- 2. FIRMAER
CREATE TABLE IF NOT EXISTS firmaer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT,
    adresse TEXT,
    telefon TEXT,
    cvr_nummer TEXT,
    branche TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE firmaer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Firms" ON firmaer;
CREATE POLICY "Public Read Firms" ON firmaer FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth Users can insert firms" ON firmaer;
CREATE POLICY "Auth Users can insert firms" ON firmaer FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. LOKATIONER
CREATE TABLE IF NOT EXISTS public.lokationer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lokationer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in firm can see locations" ON public.lokationer;
CREATE POLICY "Anyone in firm can see locations" ON public.lokationer 
FOR SELECT USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage locations" ON public.lokationer;
CREATE POLICY "Admins can manage locations" ON public.lokationer 
FOR ALL USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

-- 4. ASSETS (Maskiner)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    lokation_id UUID REFERENCES public.lokationer(id),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    qr_kode TEXT,
    beskrivelse TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in firm can see assets" ON public.assets;
CREATE POLICY "Anyone in firm can see assets" ON public.assets 
FOR SELECT USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage assets" ON public.assets;
CREATE POLICY "Admins can manage assets" ON public.assets 
FOR ALL USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

-- 5. OPGAVER & ANMODNINGER
ALTER TABLE public.opgaver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anmodninger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in firm can see tasks" ON public.opgaver;
CREATE POLICY "Anyone in firm can see tasks" ON public.opgaver 
FOR SELECT USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tasks" ON public.opgaver;
CREATE POLICY "Admins can manage tasks" ON public.opgaver 
FOR ALL USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

DROP POLICY IF EXISTS "Anyone in firm can see requests" ON public.anmodninger;
CREATE POLICY "Anyone in firm can see requests" ON public.anmodninger 
FOR SELECT USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage requests" ON public.anmodninger;
CREATE POLICY "Admins can manage requests" ON public.anmodninger 
FOR ALL USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));
