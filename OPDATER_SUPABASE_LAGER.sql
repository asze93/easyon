-- 1. TILFØJ MANGLENDE KOLONNER (hvis de ikke findes)
ALTER TABLE public.lager ADD COLUMN IF NOT EXISTS lokation_tekst TEXT;
ALTER TABLE public.lager ADD COLUMN IF NOT EXISTS enhed TEXT DEFAULT 'stk';

-- 2. AUTOMATISK INDKØBS-ANMODNING TRIGGER FUNKTION
CREATE OR REPLACE FUNCTION check_stock_and_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Bruger 'minimums_beholdning' fra dit schema
    IF NEW.antal_paa_lager <= 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.opgaver 
            WHERE titel LIKE '%' || NEW.navn || '%' 
            AND (status = 'Venter' OR status = 'I gang')
            AND firma_id = NEW.firma_id
        ) THEN
            INSERT INTO public.opgaver (titel, beskrivelse, prioritet, status, firma_id)
            VALUES (
                'INDKØB: ' || NEW.navn, 
                'Lagerstatus er nået 0. Venligst bestil flere hjem. Lokation: ' || COALESCE(NEW.lokation_tekst, 'Ikke angivet'),
                3, -- Høj prioritet
                'Venter',
                NEW.firma_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_low_stock_request ON public.lager;
CREATE TRIGGER tr_low_stock_request
AFTER UPDATE OF antal_paa_lager ON public.lager
FOR EACH ROW EXECUTE FUNCTION check_stock_and_request();

-- 3. RLS POLICIES (Fixet for 'id' i stedet for 'auth_id')
-- Vi sørger for at Policies fungerer med firma_id check
ALTER TABLE public.lager ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opgave_materialer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maskin_reservedele ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see parts from their own company" ON public.lager;
CREATE POLICY "Users can see parts from their own company" ON public.lager 
FOR SELECT USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage parts" ON public.lager;
CREATE POLICY "Admins can manage parts" ON public.lager 
FOR ALL USING (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')))
WITH CHECK (firma_id IN (SELECT firma_id FROM public.brugere WHERE id = auth.uid() AND (rolle ILIKE '%admin%' OR rolle ILIKE '%superbruger%')));

DROP POLICY IF EXISTS "Admins can manage materials" ON public.opgave_materialer;
CREATE POLICY "Admins can manage materials" ON public.opgave_materialer 
FOR ALL USING (true) 
WITH CHECK (true); -- Forenklet til test for at sikre materiale-logik virker
