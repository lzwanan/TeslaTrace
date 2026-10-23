-- Time the climate ran today, integrated from `is_climate_on` samples.
-- Deliberately scoped to one day: the same query over a week costs ~290ms, which
-- is fine for a nightly job and not fine for a page that opens with SSE.
WITH samples AS (
    SELECT
        is_climate_on,
        extract(epoch FROM lead(date) OVER (ORDER BY date) - date) AS dt
    FROM positions
    WHERE car_id = %(car_id)s
      AND date >= %(since)s
)
SELECT
    coalesce(sum(least(dt, 300)) FILTER (WHERE is_climate_on), 0)::float8 / 3600.0 AS hours
FROM samples
WHERE dt IS NOT NULL AND dt > 0;
