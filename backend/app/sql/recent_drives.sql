-- Keyset pagination: pass the last start_date you received as `before`, and the
-- month lower bound as `since`. Both are always bound, so the month filter and the
-- unfiltered list share one query shape and one plan.
-- Place names come from the geocoder (addresses) and are frequently null when
-- Nominatim is not configured, so a geofence name is the next best label.
SELECT
    d.id,
    d.start_date,
    d.end_date,
    d.duration_min,
    d.distance,
    coalesce(sa.display_name, sf.name) AS from_place,
    coalesce(ea.display_name, ef.name) AS to_place,
    st.latitude::float8                AS from_lat,
    st.longitude::float8               AS from_lng,
    en.latitude::float8                AS to_lat,
    en.longitude::float8               AS to_lng
FROM drives d
LEFT JOIN addresses sa ON sa.id = d.start_address_id
LEFT JOIN addresses ea ON ea.id = d.end_address_id
LEFT JOIN geofences sf ON sf.id = d.start_geofence_id
LEFT JOIN geofences ef ON ef.id = d.end_geofence_id
LEFT JOIN positions st ON st.id = d.start_position_id
LEFT JOIN positions en ON en.id = d.end_position_id
WHERE d.car_id = %(car_id)s
  AND d.start_date < %(before)s
  AND d.start_date >= %(since)s
ORDER BY d.start_date DESC
LIMIT %(limit)s;
