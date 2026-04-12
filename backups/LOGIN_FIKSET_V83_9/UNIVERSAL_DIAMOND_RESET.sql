-- =============================================
-- UNIVERSAL DIAMOND LOGIN RESET (v83.9) 💎🚀
-- =============================================

-- 1. FJERN GAMLE FUNKTIONER (Fuld oprydning)
DROP FUNCTION IF EXISTS public.check_technician_login(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.universal_diamond_login(TEXT, TEXT, TEXT);

-- 2. INFØR DEN NYE UNIVERSAL FUNKTION
CREATE OR REPLACE FUNCTION public.universal_diamond_login(
    f_name TEXT, 
    login_id TEXT, 
    pin_code TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    firma_record RECORD;
    user_record RECORD;
    found_firma_id UUID;
BEGIN
    -- LOGIK: Hvis firmanavn er tomt, leder vi efter en MASTER ADMIN
    IF f_name IS NULL OR f_name = '' THEN
        SELECT * INTO user_record 
        FROM public.brugere 
        WHERE email ILIKE login_id 
        AND adgangskode = pin_code
        ORDER BY created_at DESC LIMIT 1;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Ugyldig Master Login. Tjek e-mail og kode.');
        END IF;

    -- LOGIK: Hvis firmanavn ER udfyldt, leder vi efter en MEDARBEJDER i det firma
    ELSE
        SELECT id INTO found_firma_id FROM public.firmaer WHERE navn ILIKE f_name LIMIT 1;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Firmaet "' || f_name || '" blev ikke fundet.');
        END IF;

        SELECT * INTO user_record 
        FROM public.brugere 
        WHERE firma_id = found_firma_id 
        AND (arbejdsnummer = login_id OR email ILIKE login_id)
        AND adgangskode = pin_code
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'Ugyldigt ID eller PIN for firmaet ' || f_name);
        END IF;
    END IF;

    -- SUCCESS: Returner alt hvad dashboardet skal bruge
    RETURN jsonb_build_object(
        'status', 'success',
        'id', user_record.id,
        'navn', user_record.navn,
        'fornavn', COALESCE(user_record.fornavn, user_record.navn),
        'efternavn', user_record.efternavn,
        'email', user_record.email,
        'rolle', user_record.rolle,
        'firma_id', user_record.firma_id,
        'arbejdsnummer', user_record.arbejdsnummer
    );
END $$;

-- 3. GIV RETTIGHEDER
GRANT EXECUTE ON FUNCTION public.universal_diamond_login(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.universal_diamond_login(TEXT, TEXT, TEXT) TO authenticated;

-- 4. TVING SYNKRONISERING (For at vi ved 1234 koden virker)
DO $$ 
DECLARE
    v_asze_id UUID;
BEGIN
    -- Sørg for asze firmaet findes
    INSERT INTO public.firmaer (navn, branche)
    VALUES ('asze', 'Service & Vedligehold')
    ON CONFLICT (navn) DO UPDATE SET navn = EXCLUDED.navn
    RETURNING id INTO v_asze_id;

    -- Master asze@gmail.com
    INSERT INTO public.brugere (email, navn, rolle, adgangskode, firma_id, arbejdsnummer, fornavn)
    VALUES ('asze@gmail.com', 'Asze Admin', 'admin.super', '1234', v_asze_id, 'admin', 'Asze')
    ON CONFLICT (email) DO UPDATE SET adgangskode = '1234', firma_id = v_asze_id;

    -- Tekniker martin
    INSERT INTO public.brugere (email, navn, rolle, adgangskode, firma_id, arbejdsnummer, fornavn)
    VALUES ('martin@asze.dk', 'Martin Tekniker', 'tekniker', '1234', v_asze_id, 'martin', 'Martin')
    ON CONFLICT (email) DO UPDATE SET adgangskode = '1234', firma_id = v_asze_id, arbejdsnummer = 'martin';

END $$;
