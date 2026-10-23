-- `name` is the nickname the owner set in TeslaMate; it is null for a car that
-- was never named, so the API falls back to model + marketing name.
SELECT id, model, name, marketing_name, trim_badging, vin
FROM cars
ORDER BY id;
