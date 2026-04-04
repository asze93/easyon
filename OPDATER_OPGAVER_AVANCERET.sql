-- ==========================================
-- OPDATER OPGAVE-FUNKTIONER (Mobil-Paritet)
-- ==========================================

-- 1. TILFØJ NYE KOLONNER TIL OPGAVER
ALTER TABLE public.opgaver 
ADD COLUMN IF NOT EXISTS frist DATE,
ADD COLUMN IF NOT EXISTS kategori_id UUID REFERENCES public.kategorier(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billed_url TEXT;

-- 2. KONVERTER PRIORITET FRA INT TIL TEXT (Hvis nødvendigt for bedre læsbarhed)
-- Vi beholder INTEGER (1=Lav, 2=Mellem, 3=Høj), men tilføjer en kommentar
COMMENT ON COLUMN public.opgaver.prioritet IS '1=Lav, 2=Medium, 3=Høj, 4=Kritisk';

-- 3. OPRET STORAGE-BUCKET TIL BILLEDER (Valgfrit, men godt for fremtiden)
-- Bemærk: Dette skal ofte gøres via Supabase UI, men her er SQL til referencer.
-- INSERT INTO storage.buckets (id, name) VALUES ('opgaver', 'opgaver');
