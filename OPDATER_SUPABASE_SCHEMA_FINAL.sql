-- 1. TILFØJ MANGLENDE KOLONNER TIL ALLE TABELLER
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.anmodninger ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.lokationer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.lager ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.kategorier ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.brugere ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.firmaer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
-- Sikr at firmanavne er unikke (Indpakket i sikkerheds-tjek mod 'already exists' fejl)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'firmaer_navn_key') THEN
        ALTER TABLE public.firmaer ADD CONSTRAINT firmaer_navn_key UNIQUE (navn);
    END IF;
END $$;

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
ALTER TABLE public.lager ADD COLUMN IF NOT EXISTS stregkode_sscc TEXT;
DROP INDEX IF EXISTS lager_stregkode_idx;
CREATE UNIQUE INDEX IF NOT EXISTS lager_stregkode_idx ON public.lager (stregkode_sscc) WHERE (stregkode_sscc IS NOT NULL);

-- 6. UDVIDELSE AF OPGAVER FOR STRESS TEST & RELATIONER
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES public.assets(id);
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS lokation_id UUID REFERENCES public.lokationer(id);
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS sop_id UUID; -- REFERENCES public.procedurer(id) tilføjes efter tabel-oprettelse
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS medarbejder_id UUID REFERENCES public.brugere(id);

-- LEGACY SUPPORT FOR FLUTTER APP
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS maskine_navn TEXT;
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS placering TEXT;
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS er_arkiveret BOOLEAN DEFAULT false;
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS er_faerdig BOOLEAN DEFAULT false;
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS billed_url TEXT; 

-- 7. PROCEDURER/SOP TABEL
CREATE TABLE IF NOT EXISTS public.procedurer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titel TEXT NOT NULL,
    beskrivelse TEXT,
    trin JSONB DEFAULT '[]'::jsonb,
    firma_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. FIX BRUGERE TABEL (FIRMA_ID CONSTRAINT)
-- Sikr at firma_id er UUID og har en korrekt Foreign Key
DO $$ 
BEGIN
    -- Konverter firma_id til UUID hvis den er tekst og ryd op i constraints
    ALTER TABLE public.brugere ALTER COLUMN firma_id TYPE UUID USING firma_id::uuid;
    ALTER TABLE public.brugere DROP CONSTRAINT IF EXISTS brugere_firma_id_fkey;
    ALTER TABLE public.brugere ADD CONSTRAINT brugere_firma_id_fkey FOREIGN KEY (firma_id) REFERENCES public.firmaer(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Kunne ikke opdatere firma_id constraint på brugere tabellen. Den er måske allerede korrekt.';
END $$;

-- Tilføj foreign key til opgaver nu da tabellen findes
ALTER TABLE public.opgaver DROP CONSTRAINT IF EXISTS opgaver_sop_id_fkey;
ALTER TABLE public.opgaver ADD CONSTRAINT opgaver_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.procedurer(id);

-- RLS FOR PROCEDURER
ALTER TABLE public.procedurer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in firm can see procedures" ON public.procedurer;
CREATE POLICY "Anyone in firm can see procedures" ON public.procedurer FOR SELECT 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage procedures" ON public.procedurer;
CREATE POLICY "Admins can manage procedures" ON public.procedurer FOR ALL 
USING (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id::uuid IN (SELECT firma_id::uuid FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));
-- 9. UNIKKE CONSTRAINTS FOR STRESS TEST (Tillader 'upsert' på navn/id pr. firma)
ALTER TABLE public.brugere DROP CONSTRAINT IF EXISTS brugere_arbejdsnummer_firma_id_key;
ALTER TABLE public.brugere ADD CONSTRAINT brugere_arbejdsnummer_firma_id_key UNIQUE (arbejdsnummer, firma_id);

ALTER TABLE public.lokationer DROP CONSTRAINT IF EXISTS lokationer_navn_firma_id_key;
ALTER TABLE public.lokationer ADD CONSTRAINT lokationer_navn_firma_id_key UNIQUE (navn, firma_id);

ALTER TABLE public.kategorier DROP CONSTRAINT IF EXISTS kategorier_navn_firma_id_key;
ALTER TABLE public.kategorier ADD CONSTRAINT kategorier_navn_firma_id_key UNIQUE (navn, firma_id);

ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_navn_firma_id_key;
ALTER TABLE public.assets ADD CONSTRAINT assets_navn_firma_id_key UNIQUE (navn, firma_id);

ALTER TABLE public.procedurer DROP CONSTRAINT IF EXISTS procedurer_titel_firma_id_key;
ALTER TABLE public.procedurer ADD CONSTRAINT procedurer_titel_firma_id_key UNIQUE (titel, firma_id);
