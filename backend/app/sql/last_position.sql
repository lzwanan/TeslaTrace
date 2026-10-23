-- Backwards scan of (car_id, date): instant on a 13M row table, no aggregate needed.
SELECT
    date,
    latitude::float8            AS latitude,
    longitude::float8           AS longitude,
    speed::float8               AS speed,
    power::float8               AS power,
    battery_level,
    est_battery_range_km::float8 AS est_battery_range_km,
    odometer::float8            AS odometer
FROM positions
WHERE car_id = %(car_id)s
ORDER BY date DESC
LIMIT 1;
