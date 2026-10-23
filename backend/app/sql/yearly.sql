-- One row per calendar year, drives and charges joined on the year.
-- FULL OUTER JOIN so a year with charging but no logged drives still appears.
WITH d AS (
    SELECT
        extract(year FROM (start_date AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s)::int AS year,
        count(*)                                              AS drives,
        coalesce(sum(distance), 0)::float8                    AS km,
        round(avg(distance)::numeric, 1)::float8              AS avg_km,
        max(distance)::float8                                 AS longest_km
    FROM drives
    WHERE car_id = %(car_id)s
    GROUP BY 1
),
c AS (
    SELECT
        extract(year FROM (start_date AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s)::int AS year,
        count(*)                                              AS sessions,
        coalesce(sum(charge_energy_added), 0)::float8         AS kwh,
        sum(cost)::float8                                     AS cost,
        count(cost)                                           AS costed
    FROM charging_processes
    WHERE car_id = %(car_id)s
    GROUP BY 1
)
SELECT
    coalesce(d.year, c.year)      AS year,
    coalesce(d.drives, 0)         AS drives,
    coalesce(d.km, 0)             AS km,
    coalesce(d.avg_km, 0)         AS avg_km,
    coalesce(d.longest_km, 0)     AS longest_km,
    coalesce(c.sessions, 0)       AS sessions,
    coalesce(c.kwh, 0)            AS kwh,
    c.cost                        AS cost,
    coalesce(c.costed, 0)         AS costed
FROM d
FULL OUTER JOIN c ON c.year = d.year
ORDER BY 1;
