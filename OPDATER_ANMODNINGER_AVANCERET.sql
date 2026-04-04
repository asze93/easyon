-- ==========================================
-- OPDATER ANMODNINGS-FUNKTIONER (Mobil-Paritet)
-- ==========================================

-- 1. TILFØJ NYE KOLONNER TIL ANMODNINGER
ALTER TABLE public.anmodninger
ADD COLUMN IF NOT EXISTS prioritet INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS lokation_id UUID REFERENCES public.lokationer(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS kategori_id UUID REFERENCES public.kategorier(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billed_url TEXT;

-- 2. KOMMENTARER TIL PRIORITET
COMMENT ON COLUMN public.anmodninger.prioritet IS '1=Lav, 2=Medium, 3=Høj, 4=Kritisk';
