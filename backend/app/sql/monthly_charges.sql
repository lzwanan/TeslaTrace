-- Cost is optional: TeslaMate only stores it when a tariff or a manual entry
-- exists, so `costed` tells the UI how many sessions actually carry a price.
SELECT
    to_char(date_trunc('month', (start_date AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s), 'YYYY-MM') AS month,
    count(*)                                                          AS sessions,
    coalesce(sum(charge_energy_added), 0)::float8                     AS kwh,
    sum(cost)::float8                                                 AS cost,
    count(cost)                                                       AS costed
FROM charging_processes
WHERE car_id = %(car_id)s
  AND start_date >= %(since)s
GROUP BY 1
ORDER BY 1;
