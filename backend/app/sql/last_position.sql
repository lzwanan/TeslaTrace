-- Backwards scan of (car_id, date): instant on a 13M row table, no aggregate needed.
--
-- This is the fallback when MQTT is not reachable, which is the normal case when
-- TeslaMate runs on another host: mosquitto is not published outside its compose
-- network. Everything a parked car can still tell us belongs here, otherwise the
-- dashboard shows "—" for numbers the database already has.
--
-- Tesla stopped filling est_battery_range_km years ago, and the frontend prefers
-- the rated figure anyway, so coalesce instead of picking one.
SELECT
    date,
    latitude::float8            AS latitude,
    longitude::float8           AS longitude,
    speed::float8               AS speed,
    power::float8               AS power,
    battery_level,
    coalesce(est_battery_range_km, rated_battery_range_km, ideal_battery_range_km)::float8
                                AS rated_battery_range_km,
    odometer::float8            AS odometer,
    elevation::int              AS elevation,
    inside_temp::float8         AS inside_temp,
    outside_temp::float8        AS outside_temp,
    is_climate_on
FROM positions
WHERE car_id = %(car_id)s
ORDER BY date DESC
LIMIT 1;
