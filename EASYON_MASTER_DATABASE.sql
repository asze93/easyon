-- ==========================================
-- EASYON MASTER DATABASE (ULTIMATE HEROIC RESTORE)
-- ==========================================
-- Dette script er den DEFINITIVE version. Det fjerner alt gammelt lort og starter forfra.
-- ⚠️ ADVARSEL: Dette sletter dine data i Assets, Lager, Lokationer og Kategorier.

-- 1. DROP NAVIGATION (Slet i omvendt rækkefølge af afhængigheder)
DROP TABLE IF EXISTS public.opgaver CASCADE;
DROP TABLE IF EXISTS public.anmodninger CASCADE;
DROP TABLE IF EXISTS public.lager CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.lokationer CASCADE;
DROP TABLE IF EXISTS public.kategorier CASCADE;
DROP TABLE IF EXISTS public.procedurer CASCADE;
DROP TABLE IF EXISTS public.brugere CASCADE;
DROP TABLE IF EXISTS public.firmaer CASCADE;
DROP TABLE IF EXISTS public.kpi_konfiguration CASCADE;
DROP TABLE IF EXISTS public.firma_indstillinger CASCADE;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. CORE (Firmaer & Brugere)
CREATE TABLE public.firmaer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    adresse TEXT,
    telefon TEXT,
    cvr_nummer TEXT,
    branche TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.brugere (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    navn TEXT,
    rolle TEXT,
    arbejdsnummer TEXT,
    adgangskode TEXT,
    firma_id UUID REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. KATEGORIER & LOKATIONER
CREATE TABLE public.kategorier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    farve TEXT DEFAULT '3b82f6',
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT kategorier_unique_navn_firma UNIQUE (navn, firma_id)
);

CREATE TABLE public.lokationer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    beskrivelse TEXT,
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT lokationer_unique_navn_firma UNIQUE (navn, firma_id)
);

-- 5. ASSETS & PROCEDURER
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    lokation_id UUID REFERENCES public.lokationer(id) ON DELETE SET NULL,
    parent_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT assets_unique_navn_firma UNIQUE (navn, firma_id)
);

CREATE TABLE public.procedurer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titel TEXT NOT NULL,
    beskrivelse TEXT,
    trin JSONB DEFAULT '[]'::jsonb,
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT procedurer_unique_titel_firma UNIQUE (titel, firma_id)
);

-- 6. OPGAVER & ANMODNINGER
CREATE TABLE public.opgaver (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titel TEXT NOT NULL,
    beskrivelse TEXT,
    status TEXT DEFAULT 'Venter',
    prioritet INTEGER DEFAULT 1,
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    lokation_id UUID REFERENCES public.lokationer(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    sop_id UUID REFERENCES public.procedurer(id) ON DELETE SET NULL,
    medarbejder_id UUID REFERENCES public.brugere(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.anmodninger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titel TEXT NOT NULL,
    beskrivelse TEXT,
    asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Afventer',
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. LAGER
CREATE TABLE public.lager (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    antal_paa_lager INTEGER DEFAULT 0,
    minimums_beholdning INTEGER DEFAULT 5,
    lokation_tekst TEXT,
    stregkode TEXT,
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT lager_unique_navn_firma UNIQUE (navn, firma_id)
);

-- 8. KONFIGURATION
CREATE TABLE public.kpi_konfiguration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE UNIQUE,
    kpi_svartid BOOLEAN DEFAULT true,
    kpi_materiale BOOLEAN DEFAULT true,
    kpi_maskin BOOLEAN DEFAULT true,
    kpi_fordeling BOOLEAN DEFAULT true,
    opdateret_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.firma_indstillinger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE UNIQUE,
    app_tema_farve TEXT DEFAULT '3B82F6',
    kraever_anmodning_review BOOLEAN DEFAULT false,
    vis_lokationer BOOLEAN DEFAULT true,
    vis_sop BOOLEAN DEFAULT true,
    krav_billede BOOLEAN DEFAULT false,
    opdateret_at TIMESTAMPTZ DEFAULT now()
);

-- 9. SIKKERHED (RLS - Vi åbner helt op for All Access på alle tabeller)
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LOOP
        EXECUTE 'ALTER TABLE public.' || t || ' ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Full Access" ON public.' || t;
        EXECUTE 'CREATE POLICY "Full Access" ON public.' || t || ' FOR ALL USING (true) WITH CHECK (true);';
    END LOOP;
END $$;

-- ==========================================
-- SETUP FÆRDIG - KLAR TIL BRUG (Hero Mode)
-- ==========================================
