-- The state TeslaMate last recorded for this car.
--
-- Without a broker the dashboard used to render "unknown", which is the one thing
-- we can be sure is not true: TeslaMate writes every transition here, and
-- "offline since 13:41" is exactly what the status pill exists to say.
SELECT state, start_date
FROM states
WHERE car_id = %(car_id)s
ORDER BY start_date DESC
LIMIT 1;
