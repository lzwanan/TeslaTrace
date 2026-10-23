## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- The decision this improves. If it only adds a chart, say which decision that chart supports. -->

## Checklist

- [ ] `ruff check` and `mypy` pass (backend)
- [ ] `eslint` and `tsc --noEmit` pass (frontend)
- [ ] Checked at **390 px**, **820 px** and **1440 px** widths
- [ ] No new query scans `positions` without `car_id` and a date range
- [ ] No credentials, VINs, home addresses or screenshots with location in the diff
- [ ] Updated `README` / `demo` if the design changed

## Screenshots

<!-- Before / after, if this is a UI change. Crop out anything that reveals where the car is. -->
