-- Buckets are local months: TeslaMate stores naive UTC, so the value is tagged as
-- UTC and then converted, which keeps month edges correct across DST.
SELECT
    to_char(date_trunc('month', (start_date AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s), 'YYYY-MM') AS month,
    count(*)                                                          AS drives,
    coalesce(sum(distance), 0)::float8                                AS km
FROM drives
WHERE car_id = %(car_id)s
  AND start_date >= %(since)s
GROUP BY 1
ORDER BY 1;
