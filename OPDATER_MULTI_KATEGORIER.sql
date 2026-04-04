-- ==========================================
-- OPDATER MULTI-KATEGORIER (Tag-System)
-- ==========================================

-- 1. OPDATER OPGAVER
-- Vi omdøber ikke nødvendigvis, men tilføjer den nye kolonne som ARRAY
ALTER TABLE public.opgaver ADD COLUMN IF NOT EXISTS kategori_ids UUID[] DEFAULT '{}';
-- Migration: Flyt eksisterende enkelt-ID over i arrayet (hvis det findes)
UPDATE public.opgaver SET kategori_ids = ARRAY[kategori_id] WHERE kategori_id IS NOT NULL;

-- 2. OPDATER ANMODNINGER
ALTER TABLE public.anmodninger ADD COLUMN IF NOT EXISTS kategori_ids UUID[] DEFAULT '{}';
-- Migration: Flyt over
UPDATE public.anmodninger SET kategori_ids = ARRAY[kategori_id] WHERE kategori_id IS NOT NULL;

-- 3. (VALGFRIT) RYD OP HVIS DU VIL FJERNE DE GAMLE KOLONNER SENERE
-- ALTER TABLE public.opgaver DROP COLUMN kategori_id;
-- ALTER TABLE public.anmodninger DROP COLUMN kategori_id;
