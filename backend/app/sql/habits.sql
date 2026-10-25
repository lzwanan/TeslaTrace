-- How the car is actually used: pace, trip length, daily use, night driving.
WITH scoped AS (
    SELECT
        distance,
        duration_min,
        ((start_date AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s) AS local_start
    FROM drives
    WHERE car_id = %(car_id)s
),
per_day AS (
    SELECT local_start::date AS day, sum(distance) AS km
    FROM scoped
    GROUP BY 1
)
SELECT
    count(*)                                                        AS drives,
    round((sum(distance) / nullif(sum(duration_min), 0) * 60)::numeric, 1) AS avg_kmh,
    round(avg(duration_min)::numeric, 0)                            AS avg_minutes,
    round(avg(distance)::numeric, 1)                                AS avg_km,
    max(distance)::float8                                           AS longest_km,
    count(DISTINCT local_start::date)                               AS days_used,
    count(*) FILTER (WHERE extract(hour FROM local_start) < 6
                        OR extract(hour FROM local_start) >= 22)    AS night_drives,
    count(*) FILTER (WHERE distance < 5)                            AS short_drives,
    -- The shape of a typical trip, not just its average: a mean of 17 km can be
    -- one long drive and twenty school runs, and only the second one is expensive.
    count(*) FILTER (WHERE distance >= 5 AND distance < 15)         AS km5_15,
    count(*) FILTER (WHERE distance >= 15 AND distance < 30)        AS km15_30,
    count(*) FILTER (WHERE distance >= 30 AND distance < 60)        AS km30_60,
    count(*) FILTER (WHERE distance >= 60)                          AS km60_plus,
    (SELECT max(km)::float8 FROM per_day)                           AS busiest_day_km
FROM scoped;
