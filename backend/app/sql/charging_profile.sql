-- Charging habits in one pass over a 500-row table. Sessions shorter than five
-- minutes are dropped: they are usually a plug-in that immediately stopped and
-- would drag the average power towards nonsense.
SELECT
    count(*)                                                            AS sessions,
    round(avg(charge_energy_added / nullif(duration_min, 0) * 60)::numeric, 1) AS avg_kw,
    round(avg(duration_min)::numeric, 0)                                AS avg_minutes,
    round(max(charge_energy_added)::numeric, 1)                         AS max_kwh,
    count(*) FILTER (WHERE end_battery_level >= 100)                    AS full,
    count(*) FILTER (WHERE end_battery_level >= 90 AND end_battery_level < 100) AS to90,
    count(*) FILTER (WHERE end_battery_level >= 80 AND end_battery_level < 90)  AS to80,
    count(*) FILTER (WHERE end_battery_level < 80)                      AS below80,
    count(*) FILTER (WHERE hour BETWEEN 0 AND 7)                        AS night,
    count(*) FILTER (WHERE hour BETWEEN 8 AND 17)                       AS day,
    count(*) FILTER (WHERE hour >= 18)                                  AS evening
FROM (
    SELECT
        charge_energy_added,
        duration_min,
        end_battery_level,
        extract(hour FROM (start_date AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s)::int AS hour
    FROM charging_processes
    WHERE car_id = %(car_id)s
      AND duration_min > 5
) s;
