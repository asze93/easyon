-- =============================================
-- DIAMOND LOGIN SYSTEM - SUPABASE RPC (v83.5)
-- =============================================
-- Kør dette script i Supabase SQL Editor for at aktivere Tekniker-login.
-- Dette script opretter en sikker funktion til at validere firma + ID + PIN.

-- 1. OPRET LOGIN-FUNKTIONEN
CREATE OR REPLACE FUNCTION public.check_technician_login(
    f_name TEXT, 
    a_nr TEXT, 
    a_kode TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Kører med forhøjede rettigheder for at tjekke credentials sikkert
AS $$
DECLARE
    firma_record RECORD;
    user_record RECORD;
BEGIN
    -- Log forsøg (valgfrit til debugging)
    RAISE NOTICE 'Login forsøg for Firma: %, ID: %', f_name, a_nr;

    -- A. Find firma (Case-insensitive match)
    SELECT id, navn INTO firma_record FROM public.firmaer 
    WHERE navn ILIKE f_name 
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Firmaet "' || f_name || '" blev ikke fundet.');
    END IF;

    -- B. Find bruger i firmaet (Tjekker både firma_id, arbejdsnummer og adgangskode)
    SELECT * INTO user_record FROM public.brugere 
    WHERE firma_id = firma_record.id 
    AND (arbejdsnummer = a_nr OR email = a_nr) -- Tillad både email og medarbejder-nr som login
    AND adgangskode = a_kode
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Ugyldigt ID eller adgangskode for ' || f_name);
    END IF;

    -- C. Returner succes-profil (Diamond Rescue Logic)
    RETURN jsonb_build_object(
        'id', user_record.id,
        'navn', user_record.navn,
        'rolle', user_record.rolle,
        'firma_id', user_record.firma_id,
        'arbejdsnummer', user_record.arbejdsnummer,
        'email', user_record.email,
        'firma_navn', firma_record.navn,
        'status', 'success'
    );
END;
$$;

-- 2. GIV RETTIGHEDER (VIGTIGT FOR AT UNDGÅ TIMEOUT)
-- Vi giver 'anon' adgang til at køre denne funktion, så man kan logge ind før man har en session.
GRANT EXECUTE ON FUNCTION public.check_technician_login(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_technician_login(TEXT, TEXT, TEXT) TO authenticated;

-- 3. SIKR AT BRUGERE-TABELLEN ER LÆSBAR FOR LOGIN-CHECKS
-- Hvis brugere-tabellen har RLS aktiveret, skal 'check_technician_login' kunne læse den.
-- Da vi bruger SECURITY DEFINER ovenfor, er dette allerede dækket, men vi sikrer at RLS er korrekt.
ALTER TABLE public.brugere ENABLE ROW LEVEL SECURITY;

-- 4. OPRET INDEX FOR HURTIG OPESLAG (Performance)
CREATE INDEX IF NOT EXISTS idx_brugere_login_lookup ON public.brugere (firma_id, arbejdsnummer, adgangskode);
CREATE INDEX IF NOT EXISTS idx_firmaer_navn_lookup ON public.firmaer (navn);

-- Færdig!
