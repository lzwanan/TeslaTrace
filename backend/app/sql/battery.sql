-- Usable capacity, inferred from sessions that moved the state of charge by at
-- least 20 points: kWh added over the fraction of the pack that was filled.
-- The median resists the occasional session where the car reported a rounded SoC.
WITH samples AS (
    SELECT
        charge_energy_added::float8 / (end_battery_level - start_battery_level) * 100 AS capacity_kwh,
        start_date
    FROM charging_processes
    WHERE car_id = %(car_id)s
      AND end_battery_level - start_battery_level >= 20
      AND charge_energy_added > 0
    ORDER BY start_date DESC
    LIMIT 40
),
range AS (
    SELECT end_rated_range_km::float8 AS rated_range_km, start_date
    FROM charging_processes
    WHERE car_id = %(car_id)s
      AND end_battery_level >= 95
      AND end_rated_range_km IS NOT NULL
    ORDER BY start_date DESC
    LIMIT 1
)
SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY capacity_kwh)::float8 AS capacity_kwh,
    count(*)                                                          AS samples,
    min(start_date)                                                   AS oldest,
    (SELECT rated_range_km FROM range)                                AS rated_range_km
FROM samples;
