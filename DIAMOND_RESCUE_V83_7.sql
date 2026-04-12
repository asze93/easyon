-- =============================================
-- DIAMOND RESCUE & SYNC (v83.8 - FINAL FIX)
-- =============================================

DO $$ 
DECLARE
    v_firma_id UUID;
BEGIN
    -- 1. OPGRADER BRUGERE TABEL (Sikr kolonner)
    ALTER TABLE public.brugere ADD COLUMN IF NOT EXISTS fornavn TEXT;
    ALTER TABLE public.brugere ADD COLUMN IF NOT EXISTS efternavn TEXT;
    ALTER TABLE public.brugere ADD COLUMN IF NOT EXISTS telefon TEXT;

    -- 2. FIND ELLER OPRET FIRMAET "asze"
    -- Vi gør dette dynamisk så vi ikke får Foreign Key fejl hvis ID'et er anderledes.
    INSERT INTO public.firmaer (navn, branche)
    VALUES ('asze', 'Service & Vedligehold')
    ON CONFLICT (navn) DO UPDATE SET navn = EXCLUDED.navn
    RETURNING id INTO v_firma_id;

    -- 3. SYNKRONISER MASTER ADMIN (asze@gmail.com)
    INSERT INTO public.brugere (email, navn, fornavn, efternavn, rolle, arbejdsnummer, adgangskode, firma_id)
    VALUES (
        'asze@gmail.com', 
        'System Admin', 
        'System', 
        'Admin', 
        'admin.super', 
        'admin', 
        '1234', 
        v_firma_id
    )
    ON CONFLICT (email) DO UPDATE 
    SET firma_id = v_firma_id, 
        rolle = 'admin.super',
        adgangskode = '1234';

    -- 4. OPRET MARTIN
    INSERT INTO public.brugere (email, navn, fornavn, efternavn, rolle, arbejdsnummer, adgangskode, firma_id)
    VALUES (
        'martin@asze.dk', 
        'Martin Jensen', 
        'Martin', 
        'Jensen', 
        'tekniker', 
        'martin',
        '1234', 
        v_firma_id
    )
    ON CONFLICT (email) DO UPDATE
    SET firma_id = v_firma_id, adgangskode = '1234', arbejdsnummer = 'martin';

    -- 5. OPRET TEST-BRUGER "123"
    INSERT INTO public.brugere (navn, fornavn, efternavn, rolle, arbejdsnummer, adgangskode, firma_id)
    VALUES (
        'Test Bruger', 
        'Test', 
        'Bruger', 
        'tekniker', 
        '123', 
        '1234', 
        v_firma_id
    )
    ON CONFLICT (arbejdsnummer, firma_id) DO UPDATE
    SET adgangskode = '1234';

    -- 6. SIKR KONFIGURATIONER
    INSERT INTO public.kpi_konfiguration (firma_id) 
    VALUES (v_firma_id)
    ON CONFLICT (firma_id) DO NOTHING;

    INSERT INTO public.firma_indstillinger (firma_id) 
    VALUES (v_firma_id)
    ON CONFLICT (firma_id) DO NOTHING;

    RAISE NOTICE 'Synkronisering færdig for Firma ID: %', v_firma_id;
END $$;

-- 7. GIV TILLADELSER (Køres udenfor DO-blok)
GRANT EXECUTE ON FUNCTION public.check_technician_login(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_technician_login(TEXT, TEXT, TEXT) TO authenticated;
