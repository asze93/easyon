-- ===========================================
-- DATABASE HARDENING: UNIQUE FIRMA NAMES 💎🚀
-- ===========================================

-- Vi sikrer at firmanavnet er unikt, så login-systemet altid finder den rigtige dør.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_firma_navn'
    ) THEN
        ALTER TABLE public.firmaer ADD CONSTRAINT unique_firma_navn UNIQUE (navn);
    END IF;
END $$;
