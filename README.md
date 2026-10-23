<div align="center">

# TeslaTrace

**Your car. Your data. One glance.**

A self-hosted, mobile-first dashboard for [TeslaMate](https://github.com/teslamate-org/teslamate) data.

[![Status](https://img.shields.io/badge/status-design%20preview-orange)](#roadmap)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688)](#architecture)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb)](#architecture)

<img src="docs/screenshots/desktop.png" width="860" alt="TeslaTrace on desktop">

<img src="docs/screenshots/mobile.png" width="250" alt="TeslaTrace on mobile">

</div>

> ### Status: design preview
> The screenshots above are a **working interactive prototype** — open [`demo/index.html`](demo/index.html) in any browser, no build step, no dependencies.
> The FastAPI backend and the React app are in progress. **Nothing here is production-ready yet.**

---

## Why another dashboard

TeslaMate already stores everything: every GPS sample, every drive, every charge session, with sane indexes. What it does not give you is a **glanceable** view. Grafana is an excellent analysis tool; it is not something you open on a phone while walking to the car.

TeslaTrace is the other half:

- **One screen, three answers** — where is the car, how much charge is left, is it charging.
- **Numbers before charts** — a big number with a unit and one line of context. Charts live one screen down, explaining the number.
- **State must be explainable** — when your car sleeps, TeslaMate stops polling. Every value shows how stale it is, so a frozen number never looks like a bug.

## What it will do

| Area | Highlights |
|---|---|
| Live | State pill (charging / driving / online / asleep *for 42 min*), SOC ring, range, charger power, time to full, live position |
| Drives | Trip list with route map, per-trip consumption and cost, replay (planned) |
| Charging | Session list, SOC curve, cost with time-of-use tariffs, home vs Supercharger split |
| Insights | Daily / monthly consumption, battery health trend, vampire drain while parked, savings vs petrol |
| Platform | Responsive from 390 px to 1440 px, installable PWA, dark and light themes |

Deliberately **not** included: raw current/voltage traces, per-sample GPS dumps, vehicle option flags. Those belong in Grafana.

## Architecture

```
TeslaMate ──► PostgreSQL 17 ─┐
    │                        ├──► FastAPI (read-only) ──► Nginx ──► phone / tablet / desktop
    └──► Mosquitto ──────────┘        │
                                      └── SSE ──► live state
```

- **Read-only database access.** A dedicated `teslamate_ro` role with `SELECT` only. TeslaTrace never writes to your TeslaMate data.
- **Anti-corruption views.** All queries go through a self-owned `app` schema (views + materialized views) instead of binding to TeslaMate's tables. When TeslaMate ships a schema migration, one line of SQL fixes it — not a rewrite.
- **MQTT for live state, PostgreSQL for history.** No polling of the car, no waking it up.
- **Server-side downsampling.** A 13M-row `positions` table is never shipped to the browser; tracks are reduced to ~1500 points before serialization.
- **SSE, not WebSocket.** The data only flows one way. One less protocol to debug through a reverse proxy.

## Requirements

- TeslaMate **v4.x** with its PostgreSQL and Mosquitto
- PostgreSQL **16 or 17**
- Any Docker host — developed and tested on a Synology DS920+ (x86_64, 4 GB RAM)
- ~150 MB RAM for the TeslaTrace container

## Quick start

Not available yet — the backend is being written. The intended shape is:

```bash
git clone https://github.com/lzwanan/teslatrace
cd teslatrace
cp deploy/.env.example deploy/.env      # DB password, MQTT URL, auth token
docker compose -f deploy/docker-compose.example.yml up -d
```

Then reverse-proxy it with HTTPS and put an auth layer in front. **Do not expose it to the internet without authentication** — it shows your car's real-time location.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| P0 | Design system, card registry, layout breakpoints | ✅ prototype |
| P1 | FastAPI skeleton: read-only DB, MQTT → SSE, `/api/v1/summary` | 🚧 in progress |
| P2 | React app: overview + drives + charging | ⬜ |
| P3 | Insights: materialized views, battery health, vampire drain | ⬜ |
| P4 | Auth, PWA, Docker image, Synology docs | ⬜ |
| P5 | Trip replay, multi-car | ⬜ |

## Design decisions

The prototype in [`demo/`](demo/) is the design baseline, and [`demo/README.md`](demo/README.md) explains it. Two choices worth knowing up front:

- **Container queries, not media queries.** A card only knows how wide its own container is, so the same card works in a sidebar, a widget, or full screen without changes.
- **A card registry, not hardcoded pages.** Each card declares `span` per breakpoint, a `priority`, and a `visibleWhen` predicate. The same card set produces three different home screens: charging, driving, or parked.

## Disclaimer

TeslaTrace is an independent community project. It is **not affiliated with, endorsed by, or sponsored by Tesla, Inc.** "Tesla" and "TeslaMate" are used only to describe compatibility. No Tesla logos or brand assets are used.

## License

[MIT](LICENSE)
