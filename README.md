<div align="center">

# TeslaTrace

**Your car. Your data. One glance.**

A self-hosted, mobile-first dashboard for [TeslaMate](https://github.com/teslamate-org/teslamate) data.

![Status](https://img.shields.io/badge/status-design%20preview-orange)

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

![Backend](https://img.shields.io/badge/backend-FastAPI-009688)



![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)

![TeslaTrace on desktop](docs/screenshots/desktop.png)

![TeslaTrace on mobile](docs/screenshots/mobile.png)

</div>

> ### Status: design preview
>
> The screenshots above are a **working interactive prototype** — open [`demo/index.html`](demo/index.html) in any browser, no build step, no dependencies.  
> The FastAPI backend and the React app are in progress. **Nothing here is production-ready yet.**

---

## Why another dashboard

TeslaMate already stores everything: every GPS sample, every drive, every charge session, with sane indexes. What it does not give you is a **glanceable** view. Grafana is an excellent analysis tool; it is not something you open on a phone while walking to the car.

TeslaTrace is the other half:

- **One screen, three answers** — where is the car, how much charge is left, is it charging.
- **Numbers before charts** — a big number with a unit and one line of context. Charts live one screen down, explaining the number.
- **State must be explainable** — when your car sleeps, TeslaMate stops polling. Every value shows how stale it is, so a frozen number never looks like a bug.

## Features

| Area     | Highlights                                                                                                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Live     | State pill (charging / driving / online / asleep *for 42 min*), SOC ring, range, charger power, time to full, live position |
| Drives   | Trip list with route map, per-trip consumption and cost, replay (planned)                                                   |
| Charging | Session list, SOC curve, cost with time-of-use tariffs, home vs Supercharger split                                          |
| Insights | Daily / monthly consumption, battery health trend, vampire drain while parked, savings vs petrol                            |
| Platform | Responsive from 390 px to 1440 px, installable PWA, dark and light themes                                                   |

Deliberately **not** included: raw current/voltage traces, per-sample GPS dumps, vehicle option flags. Those belong in Grafana.

## Architecture

```
TeslaMate ──► PostgreSQL 17 ─┐
    │                        ├──► FastAPI (read-only) ──► Nginx ──► phone / tablet / desktop
    └──► Mosquitto ──────────┘        │
                                      └── SSE ──► live state
```

- **Read-only database access.** A dedicated `teslamate_ro` role with `SELECT` only. TeslaTrace never writes to your TeslaMate data.
- **Schema knowledge lives in one place.** Every column name TeslaMate exposes is in `backend/app/sql/*.sql`. When TeslaMate ships a migration, the fix is one file — not a hunt through route handlers. No views, no DDL, no migration step: the service runs on `SELECT` alone.
- **MQTT for live state, PostgreSQL for history.** No polling of the car, no waking it up.
- **Naive UTC handled once.** TeslaMate writes UTC into `timestamp without time zone` columns; reading them without attaching a zone shifts the whole dashboard by the UTC offset. That conversion lives in `app/timeutil.py` and is covered by tests.
- **SSE, not WebSocket.** The data only flows one way. One less protocol to debug through a reverse proxy.

## Requirements

- TeslaMate **v4.x** with its PostgreSQL and Mosquitto
- PostgreSQL **16 or 17**
- Any Docker host — developed and tested on a Synology DS920+ (x86_64, 4 GB RAM)
- ~150 MB RAM for the TeslaTrace container

## Quick start

The backend runs today. Four values, all of them already in your TeslaMate compose file.

```bash
git clone https://github.com/lzwanan/TeslaTrace && cd TeslaTrace/deploy
cp .env.example .env                                    # paste DATABASE_PASS
docker compose -f docker-compose.example.yml up -d --build
```

It joins TeslaMate's existing Docker network, so neither PostgreSQL nor Mosquitto needs a port published. Then:

```bash
curl localhost:8000/api/v1/summary     # your car, right now
open http://localhost:8000/api/docs    # interactive API docs
```

Running without Docker:

```bash
cd backend
pip install -e ".[dev]"
DATABASE_HOST=localhost DATABASE_PASS=... MQTT_HOST=localhost python -m app
```

Finally, reverse-proxy it with HTTPS and put an auth layer in front. **Do not expose it to the internet without authentication** — it shows your car's real-time location.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_PASS` | — | **The only required value.** Copy it from your TeslaMate compose |
| `DATABASE_HOST` | `database` | TeslaMate's service name |
| `DATABASE_PORT` / `DATABASE_NAME` / `DATABASE_USER` | `5432` / `teslamate` / `teslamate` | Rarely changed |
| `MQTT_HOST` | `mosquitto` | TeslaMate's service name |
| `MQTT_PORT` / `MQTT_USERNAME` / `MQTT_PASSWORD` | `1883` / — / — | Only if your broker needs auth |
| `TZ` | `Asia/Shanghai` | Decides where "today" starts |
| `AUTH_TOKEN` | empty | Empty means the API is open — fine on a LAN, never on the internet |

That is the whole surface. There is no per-car setting (cars are discovered from the database) and no coordinate setting (the API returns what TeslaMate stored).

## API

```
GET /healthz                  database + broker status, for the container healthcheck
GET /api/v1/cars              every car in this TeslaMate database
GET /api/v1/live              current state (MQTT first, newest position as fallback)
GET /api/v1/summary           the whole home screen in one request
GET /api/v1/drives?limit=20   trip list, keyset paginated
GET /api/v1/stats?months=6    monthly distance, cost and battery estimate
GET /api/v1/stream            SSE: one snapshot, then a frame per change
```

## Roadmap

| Phase | Scope                                                                        | Status      |
|-------|------------------------------------------------------------------------------|-------------|
| P0    | Design system, card registry, layout breakpoints                             | ✅ done      |
| P1    | FastAPI: read-only DB, MQTT → SSE, `/api/v1/summary`, `/drives`, healthcheck | ✅ done      |
| P2    | React app: overview, drives, card registry, zh/en, dark and light            | ✅ done      |
| P3    | Insights: monthly distance and cost, battery capacity from charge sessions   | ✅ done      |
| P4    | Auth hardening, PWA, published image, Synology docs                          | 🚧 next      |
| P5    | Trip replay, multi-car                                                       | ⬜           |


## Development

Two processes, no configuration between them — Vite proxies `/api` to the backend:

```bash
# terminal 1
cd backend && pip install -e ".[dev]"
DATABASE_PASS=... python -m app          # http://localhost:8000

# terminal 2
cd frontend && npm install && npm run dev  # http://localhost:5173
```

`npm run build` type-checks and emits `frontend/dist`; the Docker image copies that into the Python package and FastAPI serves it from `/`.

The interface is Chinese by default and switches to English with one click in the header (the choice is remembered). Strings live in `frontend/src/lib/i18n.tsx` — adding a language there is a matter of one more dictionary.

## Design decisions

The prototype in [`demo/`](demo/) is the design baseline, and [`demo/README.md`](demo/README.md) explains it. Two choices worth knowing up front:

- **Container queries, not media queries.** A card only knows how wide its own container is, so the same card works in a sidebar, a widget, or full screen without changes.
- **A card registry, not hardcoded pages.** Each card declares `span` per breakpoint, a `priority`, and a `visibleWhen` predicate. The same card set produces three different home screens: charging, driving, or parked.

## Disclaimer

TeslaTrace is an independent community project. It is **not affiliated with, endorsed by, or sponsored by Tesla, Inc.** "Tesla" and "TeslaMate" are used only to describe compatibility. No Tesla logos or brand assets are used.

## License

[MIT](LICENSE)

---

## Support

TeslaTrace is free, and it will stay free. If it saved you a subscription elsewhere — or just a weekend of yak-shaving — you can buy me a coffee. Never required, always appreciated.

<table>
  <tr>
    <td align="center" width="33%">
      <a href="docs/sponsor/wechat-pay.jpg"><img src="docs/sponsor/wechat-pay.jpg" height="320" alt="WeChat Pay"></a><br>
      <sub><b>WeChat Pay</b></sub>
    </td>
    <td align="center" width="33%">
      <a href="docs/sponsor/alipay.jpg"><img src="docs/sponsor/alipay.jpg" height="320" alt="Alipay"></a><br>
      <sub><b>Alipay</b></sub>
    </td>
    <td align="center" width="33%">
      <a href="docs/sponsor/wechat-reward.jpg"><img src="docs/sponsor/wechat-reward.jpg" height="320" alt="WeChat Reward"></a><br>
      <sub><b>WeChat Reward</b></sub>
    </td>
  </tr>
</table>

<sub>Scan with WeChat or Alipay. Click a code to open it full size.</sub>
