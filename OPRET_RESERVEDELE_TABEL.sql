-- OPRET RESERVEDELE TABEL 🛠️📦
-- Dette script opretter en koblingstabel mellem Assets og Lageret (Reservedele)

CREATE TABLE IF NOT EXISTS public.maskin_reservedele (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maskine_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    lager_id UUID NOT NULL REFERENCES public.lager(id) ON DELETE CASCADE,
    noter TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT maskin_lager_unique UNIQUE (maskine_id, lager_id)
);

-- RLS
ALTER TABLE public.maskin_reservedele ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full Access" ON public.maskin_reservedele;
CREATE POLICY "Full Access" ON public.maskin_reservedele FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.maskin_reservedele IS 'Koblingstabel mellem anlæg/assets og deres specifikke reservedele på lageret.';
