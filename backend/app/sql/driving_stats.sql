-- One query for the home screen's "today" and "this month" numbers.
-- Filtering on car_id first keeps this index-only even when a car has years of drives.
SELECT
    count(*) FILTER (WHERE start_date >= %(today)s) AS today_drives,
    coalesce(sum(distance) FILTER (WHERE start_date >= %(today)s), 0)::float8 AS today_km,
    count(*) FILTER (WHERE start_date >= %(month)s) AS month_drives,
    coalesce(sum(distance) FILTER (WHERE start_date >= %(month)s), 0)::float8 AS month_km
FROM drives
WHERE car_id = %(car_id)s
  AND start_date >= %(month)s;
