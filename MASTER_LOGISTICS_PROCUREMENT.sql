-- EASYON DIAMOND: MASTER LOGISTICS & PROCUREMENT INITIALIZATION 🏆🚢🛒

-- 1. FORSENDELSER (Logistics / SSCC)
CREATE TABLE IF NOT EXISTS public.forsendelser (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    sscc_kode TEXT UNIQUE NOT NULL,
    leverandoer TEXT,
    status TEXT DEFAULT 'afventer', -- afventer, modtaget
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forsendelse_indhold (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forsendelse_id UUID NOT NULL REFERENCES public.forsendelser(id) ON DELETE CASCADE,
    lager_id UUID NOT NULL REFERENCES public.lager(id),
    antal INTEGER NOT NULL DEFAULT 1
);

-- 2. LEVERANDØRER (Suppliers)
CREATE TABLE IF NOT EXISTS public.leverandoerer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    navn TEXT NOT NULL,
    kontakt_person TEXT,
    email TEXT,
    telefon TEXT,
    adresse TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. INDKØBSORDRER (Purchase Orders)
CREATE TABLE IF NOT EXISTS public.indkoeb_ordrer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    leverandoer_id UUID REFERENCES public.leverandoerer(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft', -- draft, sent, shipped, received, cancelled
    total_pris DECIMAL(12,2) DEFAULT 0,
    valuta TEXT DEFAULT 'DKK',
    leverings_dato DATE,
    sscc_id UUID REFERENCES public.forsendelser(id), -- Link til SSCC forsendelsen
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. INDKØBS_INDHOLD (PO Items)
CREATE TABLE IF NOT EXISTS public.indkoeb_indhold (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indkoeb_id UUID NOT NULL REFERENCES public.indkoeb_ordrer(id) ON DELETE CASCADE,
    lager_id UUID NOT NULL REFERENCES public.lager(id),
    antal INTEGER NOT NULL DEFAULT 1,
    stykpris DECIMAL(12,2),
    modtaget_antal INTEGER DEFAULT 0
);

-- 5. RLS POLICIES (Sikkerhed)
ALTER TABLE public.forsendelser ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forsendelse_indhold ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leverandoerer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indkoeb_ordrer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indkoeb_indhold ENABLE ROW LEVEL SECURITY;

-- Ryd op i gamle policies før vi opretter nye
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('forsendelser', 'forsendelse_indhold', 'leverandoerer', 'indkoeb_ordrer', 'indkoeb_indhold'))
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Opret nye policies
CREATE POLICY "Users can see firm data" ON public.forsendelser FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));
CREATE POLICY "Users can see firm data" ON public.forsendelse_indhold FOR SELECT USING (forsendelse_id IN (SELECT id FROM public.forsendelser WHERE firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid())));
CREATE POLICY "Users can see firm data" ON public.leverandoerer FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));
CREATE POLICY "Users can see firm data" ON public.indkoeb_ordrer FOR SELECT USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));
CREATE POLICY "Users can see firm data" ON public.indkoeb_indhold FOR SELECT USING (indkoeb_id IN (SELECT id FROM public.indkoeb_ordrer WHERE firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid())));

-- Admin adgang til alt
CREATE POLICY "Admins can manage logic" ON public.forsendelser FOR ALL USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND rolle ILIKE '%admin%'));
CREATE POLICY "Admins can manage logic" ON public.forsendelse_indhold FOR ALL USING (forsendelse_id IN (SELECT id FROM public.forsendelser WHERE firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND rolle ILIKE '%admin%')));
CREATE POLICY "Admins can manage logic" ON public.leverandoerer FOR ALL USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND rolle ILIKE '%admin%'));
CREATE POLICY "Admins can manage logic" ON public.indkoeb_ordrer FOR ALL USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND rolle ILIKE '%admin%'));
CREATE POLICY "Admins can manage logic" ON public.indkoeb_indhold FOR ALL USING (indkoeb_id IN (SELECT id FROM public.indkoeb_ordrer WHERE firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND rolle ILIKE '%admin%')));
