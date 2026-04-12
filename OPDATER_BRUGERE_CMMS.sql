-- =============================================
-- OPDATER BRUGERE TABEL med nye CMMS-felter
-- Kør i Supabase SQL Editor
-- =============================================

ALTER TABLE public.brugere 
    ADD COLUMN IF NOT EXISTS stilling TEXT,
    ADD COLUMN IF NOT EXISTS afdeling TEXT,
    ADD COLUMN IF NOT EXISTS startdato DATE,
    ADD COLUMN IF NOT EXISTS kompetencer JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS nodkontakt_navn TEXT,
    ADD COLUMN IF NOT EXISTS nodkontakt_tlf TEXT;

-- Opdater rolle-værdier: omdøb 'tekniker' til 'bruger' for eksisterende brugere
-- (valgfrit - kør kun hvis du vil standardisere)
-- UPDATE public.brugere SET rolle = 'bruger' WHERE rolle = 'tekniker';

-- Index for hurtig søgning på afdeling
CREATE INDEX IF NOT EXISTS idx_brugere_afdeling ON public.brugere (afdeling);

-- Færdig! ✅
