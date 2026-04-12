-- DEBUG LOGIN: HVORFOR FEJLER ASZE? 💎🚀
-- Kør dette for at se hvad der er i databasen for asze@gmail.com

SELECT id, email, navn, rolle, adgangskode, firma_id 
FROM public.brugere 
WHERE email ILIKE 'asze@gmail.com';

-- Hvis ingen resultater, så tjek alle master admins
SELECT id, email, navn, rolle, adgangskode, firma_id 
FROM public.brugere 
WHERE rolle LIKE '%admin%';
