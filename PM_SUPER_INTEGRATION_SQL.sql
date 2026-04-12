-- ==========================================
-- EASYON DIAMOND: PM SUPER-INTEGRATION (v86.3)
-- SQL Script for advanced features
-- ==========================================

-- 1. Tilføj nye kolonner til pm_planer
ALTER TABLE public.pm_planer 
ADD COLUMN IF NOT EXISTS kategori_id UUID REFERENCES public.kategorier(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sop_id UUID REFERENCES public.procedurer(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billede_url TEXT,
ADD COLUMN IF NOT EXISTS lokation_id UUID REFERENCES public.lokationer(id) ON DELETE SET NULL;

-- 2. Optimer med index for hurtigere links
CREATE INDEX IF NOT EXISTS idx_pm_sop ON public.pm_planer(sop_id);
CREATE INDEX IF NOT EXISTS idx_pm_kategori ON public.pm_planer(kategori_id);

-- ==========================================
-- SCRIPT COMPLETE - RUN IN SUPABASE SQL EDITOR
-- ==========================================
