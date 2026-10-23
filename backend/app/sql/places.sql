-- Geofences the car leaves from most often. Trips without a geofence are skipped
-- rather than lumped into "unknown", which would always win and say nothing.
SELECT g.name, count(*) AS visits
FROM drives d
JOIN geofences g ON g.id = d.start_geofence_id
WHERE d.car_id = %(car_id)s
GROUP BY 1
ORDER BY 2 DESC
LIMIT 5;
