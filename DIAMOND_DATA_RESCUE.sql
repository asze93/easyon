-- =============================================
-- DIAMOND DATA RESCUE: CLEAN SWEEP (v83.11) 💎🚀
-- =============================================

DO $$ 
DECLARE
    v_new_asze_id UUID;
BEGIN
    -- 1. Find det nuværende asze firma-ID
    SELECT id INTO v_new_asze_id FROM public.firmaer WHERE navn ILIKE 'asze' LIMIT 1;

    IF v_new_asze_id IS NULL THEN
        RAISE NOTICE 'FEJL: Kan ikke finde firmaet "asze".';
        RETURN;
    END IF;

    -- 2. "CLEAN SWEEP": Slet de nye test-data i asze (for at gøre plads uden fejl)
    -- Vi rører IKKE 'brugere' eller 'firmaer' tabellerne!
    DELETE FROM public.opgaver WHERE firma_id = v_new_asze_id;
    DELETE FROM public.anmodninger WHERE firma_id = v_new_asze_id;
    DELETE FROM public.assets WHERE firma_id = v_new_asze_id;
    DELETE FROM public.lokationer WHERE firma_id = v_new_asze_id;
    DELETE FROM public.kategorier WHERE firma_id = v_new_asze_id;
    DELETE FROM public.lager WHERE firma_id = v_new_asze_id;
    DELETE FROM public.procedurer WHERE firma_id = v_new_asze_id;

    RAISE NOTICE 'Bordet er tørret af... Starter indflytning af alle dine data.';

    -- 3. FLYT ALT GAMMELT DATA TIL DET NYE ASZE ID
    -- Vi tager alt fra andre firma_ids og giver det til asze
    UPDATE public.lokationer SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;
    UPDATE public.kategorier SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;
    UPDATE public.assets SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;
    UPDATE public.opgaver SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;
    UPDATE public.anmodninger SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;
    UPDATE public.lager SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;
    UPDATE public.procedurer SET firma_id = v_new_asze_id WHERE firma_id IS DISTINCT FROM v_new_asze_id;

    RAISE NOTICE 'DATA REDDET! Alt dit gamle data er nu på plads under asze-firmaet.';
END $$;
