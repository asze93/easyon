-- 💎 EASYON DIAMOND ELITE: ULTIMATE STRESS TEST (Asze Tech - VERSION 4) 💎
-- Dette script er tilpasset de specifikke kolonnenavne i MASTER_LOGISTICS_PROCUREMENT.

DO $$
DECLARE
    target_email TEXT := 'asze3@gmail.com';
    old_firma_id UUID;
    new_firma_id UUID := gen_random_uuid();
    new_user_id UUID := gen_random_uuid();
    loc1 UUID;
    cat1 UUID;
    asset1 UUID;
    item1 UUID; item2 UUID;
    sup1 UUID;
    sop1 UUID;
    ship1 UUID;
BEGIN
    -- 0. RYD OP (Slet i præcis rækkefølge pga. Foreign Keys)
    SELECT firma_id INTO old_firma_id FROM public.brugere WHERE email = target_email;
    
    IF old_firma_id IS NOT NULL THEN
        -- Vi bruger de præcise kolonnenavne her (indkoeb_id, forsendelse_id)
        DELETE FROM public.forsendelse_indhold WHERE forsendelse_id IN (SELECT id FROM public.forsendelser WHERE firma_id = old_firma_id);
        DELETE FROM public.forsendelser WHERE firma_id = old_firma_id;
        DELETE FROM public.indkoeb_indhold WHERE indkoeb_id IN (SELECT id FROM public.indkoeb_ordrer WHERE firma_id = old_firma_id);
        DELETE FROM public.indkoeb_ordrer WHERE firma_id = old_firma_id;
        DELETE FROM public.leverandoerer WHERE firma_id = old_firma_id;
        
        -- Nu slettes resten via Cascade
        DELETE FROM public.firmaer WHERE id = old_firma_id;
    END IF;
    
    DELETE FROM public.brugere WHERE email = target_email;

    -- 1. OPRET FIRMA
    INSERT INTO public.firmaer (id, navn, adresse, telefon, cvr_nummer, branche)
    VALUES (new_firma_id, 'Asze Tech Solutions 💎', 'Hitech Boulevard 101, 8000 Aarhus', '88 88 88 88', 'DK12345678', 'Industri 4.0');

    -- 2. OPRET ADMIN BRUGER
    INSERT INTO public.brugere (id, email, adgangskode, rolle, firma_id, navn, arbejdsnummer)
    VALUES (new_user_id, target_email, '1234', 'admin', new_firma_id, 'Asze Admin', 'CEO-01');

    -- 3. OPRET LOKATIONER
    INSERT INTO public.lokationer (firma_id, navn, beskrivelse) VALUES (new_firma_id, 'Produktionshal A', 'Primær produktion');
    INSERT INTO public.lokationer (firma_id, navn, beskrivelse) VALUES (new_firma_id, 'Lager Central', 'Hovedlager') RETURNING id INTO loc1;

    -- 4. OPRET KATEGORIER
    INSERT INTO public.kategorier (firma_id, navn, farve) VALUES (new_firma_id, 'Kritisk Stop', '#FF0000') RETURNING id INTO cat1;

    -- 5. OPRET 5 MEDARBEJDERE
    INSERT INTO public.brugere (email, adgangskode, rolle, firma_id, navn, arbejdsnummer) VALUES 
        ('mads@asze.dk', '1234', 'bruger', new_firma_id, 'Mads Mekaniker', 'T-01'),
        ('sofie@asze.dk', '1234', 'superbruger', new_firma_id, 'Sofie Strøm', 'T-02'),
        ('kevin@asze.dk', '1234', 'bruger', new_firma_id, 'Kevin Kvalitet', 'T-03'),
        ('lars@asze.dk', '1234', 'bruger', new_firma_id, 'Lars Lager', 'T-04'),
        ('dorthe@asze.dk', '1234', 'admin', new_firma_id, 'Dorthe Drift', 'T-05');

    -- 6. OPRET MASKINER (Assets)
    INSERT INTO public.assets (firma_id, navn, lokation_id) VALUES (new_firma_id, 'Hydraulisk Presse HP-500', loc1) RETURNING id INTO asset1;

    -- 7. OPRET LAGERVARER
    INSERT INTO public.lager (firma_id, navn, antal_paa_lager, minimums_beholdning, lokation_tekst, stregkode)
    VALUES (new_firma_id, 'Olie Filter Elite', 15, 5, 'Hylde A-12', '5712345678902') RETURNING id INTO item1;
    
    INSERT INTO public.lager (firma_id, navn, antal_paa_lager, minimums_beholdning, lokation_tekst, stregkode)
    VALUES (new_firma_id, 'Hydraulikolie 46', 100, 20, 'Olie-depot', '5712345678901') RETURNING id INTO item2;

    -- 8. OPRET LEVERANDØRER (kontakt_person)
    INSERT INTO public.leverandoerer (firma_id, navn, kontakt_person, email, telefon, note)
    VALUES (new_firma_id, 'Sanistål A/S', 'Bjarne Bagge', 'bjarne@sanistaal.dk', '12345678', 'Hovedleverandør') RETURNING id INTO sup1;

    INSERT INTO public.leverandoerer (firma_id, navn, kontakt_person, email, telefon, note)
    VALUES (new_firma_id, 'Carl Ras', 'Mette Murer', 'mette@carl-ras.dk', '87654321', 'Sikkerhedsudstyr');

    -- 9. OPRET EN PROCEDURE (procedurer)
    INSERT INTO public.procedurer (firma_id, titel, beskrivelse, trin)
    VALUES (new_firma_id, 'Akut Filterskift Procedure', 'Gennemgang af filterskift på HP-500 presse.', 
    '[
        {"trin": 1, "beskrivelse": "Lås maskinen (LOTO)."},
        {"trin": 2, "beskrivelse": "Hent Olie Filter Elite fra Hylde A-12.", "kraever_vare": true},
        {"trin": 3, "beskrivelse": "Udskift filter og tjek pakning."},
        {"trin": 4, "beskrivelse": "Genstart og test."}
    ]') RETURNING id INTO sop1;

    -- 10. OPRET OPGAVER
    INSERT INTO public.opgaver (firma_id, titel, beskrivelse, status, lokation_id, kategori_id, prioritet, sop_id, asset_id)
    VALUES (new_firma_id, 'Akut Filterskift på HP-500', 'Brug SOP for korrekt skift.', 'Venter', loc1, cat1, 1, sop1, asset1);
    
    -- 11. OPRET INDKØBSORDRE (total_pris, indkoeb_id, stykpris)
    INSERT INTO public.indkoeb_ordrer (firma_id, leverandoer_id, status, total_pris, valuta)
    VALUES (new_firma_id, sup1, 'bestilt', 4500.00, 'DKK')
    RETURNING id INTO ship1;

    INSERT INTO public.indkoeb_indhold (indkoeb_id, lager_id, antal, stykpris)
    VALUES (ship1, item1, 10, 450.00);

    -- 12. OPRET LOGISTIK (SSCC)
    INSERT INTO public.forsendelser (firma_id, sscc_kode, leverandoer, status)
    VALUES (new_firma_id, '005712345678901234', 'Sanistål A/S', 'afventer')
    RETURNING id INTO ship1;

    INSERT INTO public.forsendelse_indhold (forsendelse_id, lager_id, antal)
    VALUES (ship1, item2, 10);

END $$;
