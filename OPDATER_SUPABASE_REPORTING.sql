-- KØR DETTE SCRIPT I SUPABASE SQL EDITOR --
-- Dette script tilføjer muligheden for at gemme rapporterings-præferencer --

CREATE TABLE IF NOT EXISTS public.kpi_konfiguration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firma_id UUID REFERENCES public.firmaer(id) ON DELETE CASCADE,
    vis_svartid BOOLEAN DEFAULT true,
    vis_materialeforbrug BOOLEAN DEFAULT true,
    vis_maskinstilstand BOOLEAN DEFAULT true,
    vis_opgave_fordeling BOOLEAN DEFAULT true,
    opdateret_at TIMESTAMPTZ DEFAULT now()
);

-- Aktiver RLS
ALTER TABLE public.kpi_konfiguration ENABLE ROW LEVEL SECURITY;

-- Admins kan læse og rette deres egne KPI indstillinger
DROP POLICY IF EXISTS "Admins can manage KPIs" ON public.kpi_konfiguration;
CREATE POLICY "Admins can manage KPIs" ON public.kpi_konfiguration 
FOR ALL USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

-- Seed standard-indstillinger hvis de ikke findes (kan også gøres i app-logikken)
