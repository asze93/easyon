-- EASYON DIAMOND: PROCUREMENT SYSTEM INITIALIZATION 🛒💎

-- 1. LEVERANDØRER (Suppliers)
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

-- 2. INDKØBSORDRER (Purchase Orders)
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

-- 3. INDKØBS_INDHOLD (PO Items)
CREATE TABLE IF NOT EXISTS public.indkoeb_indhold (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indkoeb_id UUID NOT NULL REFERENCES public.indkoeb_ordrer(id) ON DELETE CASCADE,
    lager_id UUID NOT NULL REFERENCES public.lager(id),
    antal INTEGER NOT NULL DEFAULT 1,
    stykpris DECIMAL(12,2),
    modtaget_antal INTEGER DEFAULT 0
);

-- 4. RLS POLICIES
ALTER TABLE public.leverandoerer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indkoeb_ordrer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indkoeb_indhold ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Users can see firm suppliers" ON public.leverandoerer;
CREATE POLICY "Users can see firm suppliers" ON public.leverandoerer FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can see firm orders" ON public.indkoeb_ordrer;
CREATE POLICY "Users can see firm orders" ON public.indkoeb_ordrer FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can see firm order content" ON public.indkoeb_indhold;
CREATE POLICY "Users can see firm order content" ON public.indkoeb_indhold FOR SELECT 
USING (indkoeb_id IN (SELECT id FROM public.indkoeb_ordrer WHERE firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid())));

-- Admin manage policies
DROP POLICY IF EXISTS "Admins can manage suppliers" ON public.leverandoerer;
CREATE POLICY "Admins can manage suppliers" ON public.leverandoerer FOR ALL 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

DROP POLICY IF EXISTS "Admins can manage orders" ON public.indkoeb_ordrer;
CREATE POLICY "Admins can manage orders" ON public.indkoeb_ordrer FOR ALL 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

DROP POLICY IF EXISTS "Admins can manage order content" ON public.indkoeb_indhold;
CREATE POLICY "Admins can manage order content" ON public.indkoeb_indhold FOR ALL 
USING (indkoeb_id IN (SELECT id FROM public.indkoeb_ordrer WHERE firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%'))));
