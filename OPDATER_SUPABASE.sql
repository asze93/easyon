-- KØR DETTE SCRIPT I SUPABASE SQL EDITOR --

-- 1. KATEGORIER (Fundament)
CREATE TABLE IF NOT EXISTS kategorier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    navn TEXT NOT NULL,
    farve TEXT DEFAULT '3b82f6',
    firma_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ANMODNINGER (Operations)
CREATE TABLE IF NOT EXISTS anmodninger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titel TEXT NOT NULL,
    beskrivelse TEXT,
    asset_navn TEXT,
    lokation_navn TEXT,
    kategori_navn TEXT,
    status TEXT DEFAULT 'Afventer', -- 'Afventer', 'Godkendt', 'Afvist'
    prioritet INTEGER DEFAULT 1,
    opretter_navn TEXT,
    firma_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. OPDATER OPGAVER (Work Orders)
ALTER TABLE opgaver ADD COLUMN IF NOT EXISTS kategori_navn TEXT;
ALTER TABLE opgaver ADD COLUMN IF NOT EXISTS anmodning_id UUID REFERENCES anmodninger(id);

-- TILFØJ EKSTRA INFO TIL BRUGERE
ALTER TABLE brugere ADD COLUMN IF NOT EXISTS ekstra_info JSONB DEFAULT '[]'::jsonb;
ALTER TABLE opgaver ADD COLUMN IF NOT EXISTS tildelt_titel TEXT;
