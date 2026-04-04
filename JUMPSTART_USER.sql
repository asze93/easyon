-- ==========================================
-- EASYON JUMPSTART (GENOPRET PROFIL & FIRMA)
-- ==========================================
-- Kør dette script i Supabase SQL Editoen for at få adgang til dit dashboard MED DET SAMME.

-- 1. OPRET FIRMA
INSERT INTO public.firmaer (id, navn, branche)
VALUES ('60da1446-7a13-4363-b9d9-dacb88ac8198', 'EasyON Hovedkvarter', 'Service & Vedligehold')
ON CONFLICT (id) DO NOTHING;

-- 2. OPRET MASTER BRUGER (Opdater e-mailen hvis du logger ind med en anden)
INSERT INTO public.brugere (email, navn, rolle, arbejdsnummer, adgangskode, firma_id)
VALUES ('peter@easyon.dk', 'Peter EasyON', 'admin.super', 'master', '1234', '60da1446-7a13-4363-b9d9-dacb88ac8198')
ON CONFLICT (email) DO UPDATE 
SET firma_id = '60da1446-7a13-4363-b9d9-dacb88ac8198', rolle = 'admin.super';

-- 2b. FALLBACK (System Admin)
INSERT INTO public.brugere (email, navn, rolle, arbejdsnummer, adgangskode, firma_id)
VALUES ('asze@gmail.com', 'System Admin', 'admin.super', 'admin', '1234', '60da1446-7a13-4363-b9d9-dacb88ac8198')
ON CONFLICT (email) DO UPDATE 
SET firma_id = '60da1446-7a13-4363-b9d9-dacb88ac8198', rolle = 'admin.super';

-- 3. OPRET KPI & INDSTILLINGER (Sikrer dashboard-stabilitet)
INSERT INTO public.kpi_konfiguration (firma_id) 
VALUES ('60da1446-7a13-4363-b9d9-dacb88ac8198')
ON CONFLICT (firma_id) DO NOTHING;

INSERT INTO public.firma_indstillinger (firma_id) 
VALUES ('60da1446-7a13-4363-b9d9-dacb88ac8198')
ON CONFLICT (firma_id) DO NOTHING;

-- 4. STANDARD KATEGORIER
INSERT INTO public.kategorier (navn, farve, firma_id)
VALUES 
('⚙️ Mekanisk', '#3B82F6', '60da1446-7a13-4363-b9d9-dacb88ac8198'),
('⚡ El-teknisk', '#EAB308', '60da1446-7a13-4363-b9d9-dacb88ac8198'),
('🧹 Hygiejne', '#22C55E', '60da1446-7a13-4363-b9d9-dacb88ac8198')
ON CONFLICT DO NOTHING;

-- ==========================================
-- DU ER NU KLAR! OPDATÉR DIT DASHBOARD.
-- ==========================================
