-- ==========================================
-- EASYON DIAMOND: PREVENTIVE MAINTENANCE (PM)
-- SQL Script for Supabase Evolution (v86.2 - ASCII Refactor)
-- ==========================================

-- 1. Slet den gamle tabel hvis den findes
DROP TABLE IF EXISTS public.pm_planer CASCADE;

-- 2. Opret den nye tabel med database-sikre navne (AE og VAERDI)
CREATE TABLE public.pm_planer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID NOT NULL REFERENCES public.firmaer(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    titel TEXT NOT NULL,
    beskrivelse TEXT,
    interval_type TEXT NOT NULL DEFAULT 'days', -- 'days', 'weeks', 'months', 'years'
    interval_vaerdi INTEGER NOT NULL DEFAULT 90,
    sidste_service_dato DATE,
    naeste_service_dato DATE NOT NULL,
    prioritet INTEGER DEFAULT 1,
    aktiv BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS (Full Access as established in Diamond Stable v86)
ALTER TABLE public.pm_planer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full Access" ON public.pm_planer;
CREATE POLICY "Full Access" ON public.pm_planer FOR ALL USING (true) WITH CHECK (true);

-- 4. Optimization: Add Index for automation performance
CREATE INDEX IF NOT EXISTS idx_pm_naeste_dato ON public.pm_planer(naeste_service_dato);
CREATE INDEX IF NOT EXISTS idx_pm_firma ON public.pm_planer(firma_id);

-- ==========================================
-- SCRIPT COMPLETE - RUN IN SUPABASE SQL EDITOR
-- ==========================================
