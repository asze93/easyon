-- 1. Opret tabellen for firmaindstillinger / App Builder Motor
CREATE TABLE IF NOT EXISTS firma_indstillinger (
    firma_id TEXT PRIMARY KEY,
    aktiver_lokationer BOOLEAN DEFAULT TRUE,
    aktiver_sop BOOLEAN DEFAULT TRUE,
    krav_om_billede BOOLEAN DEFAULT FALSE,
    kraever_anmodning_review BOOLEAN DEFAULT FALSE, -- Ny indstilling
    app_tema_farve TEXT DEFAULT '1e88e5'
);

-- Tillad læsning (Så appen kan downloade indstillinger)
ALTER TABLE firma_indstillinger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan læse firma_indstillinger"
ON firma_indstillinger FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Admins kan opdatere indstillinger"
ON firma_indstillinger FOR ALL
TO authenticated, anon
USING (true);
