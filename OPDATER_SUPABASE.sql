-- KØR DETTE SCRIPT I SUPABASE SQL EDITOR --

-- Tilføj kolonnen 'ekstra_info' ("+ Tilføj nummer" array til 'brugere')
ALTER TABLE brugere ADD COLUMN IF NOT EXISTS ekstra_info JSONB DEFAULT '[]'::jsonb;

-- Tilføj kolonnen 'tildelt_titel' til 'opgaver', så web og app forstår hvem opgaven er til!
ALTER TABLE opgaver ADD COLUMN IF NOT EXISTS tildelt_titel TEXT;
