# VERDA Agri Tech

**Brand:** VERDHA
**Tagline:** *from roots too the future*

---

## Overview

VERDA Agri Tech is a hydroponics monitoring and control platform. An ESP32-based
device measures pH, TDS/EC, water temperature, and water level in a hydroponic
system, reports telemetry to a backend service, and exposes an on-device HTTP
API that lets an operator remotely trigger the water pump.

This README documents the **actual, verified current implementation** of the
repository. Where the eventual production architecture differs from what
exists today, that is called out explicitly as *planned* — nothing in the
"Current" sections should be read as aspirational.

---

## VERDHA Ecosystem

| Layer | Role | Status |
|---|---|---|
| ESP32 firmware | Sensor readout, pump/relay actuation, local HTTP server | Implemented (LAN-only) |
| FastAPI backend | Telemetry ingestion, device status, pump command proxy | Implemented (no auth) |
| PostgreSQL / Supabase | Persistent storage for sensor readings and device records | Implemented (no migrations) |
| React/Vite frontend | Dashboard, live charts, pump control UI | Implemented (LAN-only backend) |
| Cloud deployment (Vercel/Render) | Public hosting of frontend/backend | **Planned, not yet done** |
| MQTT / WebSockets | Real-time push communication | **Not implemented** — placeholder directories only |
| Authentication | User/session/API-key auth | **Not implemented** |

---

## Current Architecture

```
ESP32 (LAN)  --HTTP POST-->  FastAPI backend  --SQL-->  PostgreSQL (Supabase)
                                    ^
                                    | HTTP poll (React Query, 5s interval)
                                    |
                              React/Vite frontend

Frontend --HTTP--> FastAPI backend --HTTP (direct LAN IP)--> ESP32 --> relay/pump
```

- The backend and ESP32 currently must be reachable on the **same LAN**. The
  backend holds a static mapping of device ID → ESP32 IP address and makes a
  direct outbound HTTP call to that IP to control the pump.
- There is no message broker, no WebSocket layer, and no queueing — all
  communication is synchronous request/response HTTP.
- The frontend never talks to the ESP32 directly; all traffic passes through
  the backend.

---

## System Data Flow

### 1. Telemetry: ESP32 → Backend → Database
The ESP32 pushes a telemetry payload every 5 seconds via `HTTP POST` to a
hardcoded backend URL. The backend validates and inserts the reading into
PostgreSQL and marks the device online.

### 2. Backend → Frontend
The frontend does **not** subscribe to a live stream. It uses **React Query**
to poll REST endpoints (`/api/sensors/latest`, `/api/sensors/history`,
`/api/devices/{id}/status`) on a fixed interval.

### 3. Frontend → Backend
User actions (pump toggle, mode switch) call backend REST endpoints via an
Axios-based API service layer.

### 4. Frontend → Backend → ESP32 → Pump
Pump commands are proxied synchronously by the backend directly to the
ESP32's private LAN IP address, which then actuates the relay.

> **⚠️ This LAN-direct pump control path will NOT work once the backend is
> deployed to Render (or any cloud host).** A cloud-hosted backend cannot open
> an outbound connection to a device's private LAN IP. Production pump control
> requires the ESP32 to initiate communication outward (poll or long-lived
> connection) rather than the backend reaching in. See [Cloud Deployment Plan](#cloud-deployment-plan).

---

## Technology Stack

**Frontend**
- React + TypeScript + Vite
- TanStack React Query (polling-based data fetching)
- Axios (HTTP client)
- React Router (`BrowserRouter`)

**Backend**
- FastAPI
- SQLAlchemy 2.0 (synchronous)
- Pydantic
- `python-dotenv` for configuration loading

**Database**
- PostgreSQL, currently hosted on Supabase
- Schema created via `Base.metadata.create_all()` — **no Alembic/migrations**

**Firmware**
- ESP32 (Arduino framework)
- On-device `WebServer` (port 80) for command endpoints
- Sensors: pH, TDS/EC, DS18B20 water temperature, ultrasonic water level

**Not currently implemented anywhere in the stack**
- Authentication (any form)
- MQTT
- WebSockets
- Docker / docker-compose
- Database migrations

---

## Repository Structure

```
hydroponics_platform/
├── backend/
│   └── app/
│       ├── main.py               # FastAPI app entrypoint, CORS, router mounting
│       ├── routers/               # sensor.py, device.py — all HTTP routes
│       ├── services/              # sensor_service.py, device_service.py
│       ├── models/                # SQLAlchemy models (device, sensor_reading)
│       ├── database/               # connection.py, session.py, config.py, base.py
│       ├── mqtt/                  # empty — placeholder for future MQTT support
│       ├── websockets/            # empty — placeholder for future real-time push
│       ├── auth/                  # empty — placeholder for future authentication
│       ├── middleware/            # empty
│       ├── dependencies/          # empty
│       └── core/                  # empty
├── frontend/
│   └── src/
│       ├── pages/                 # Dashboard.tsx, Login.tsx (stub), etc.
│       ├── components/
│       │   └── controls/          # PumpControl.tsx
│       ├── services/               # api.ts, sensorService.ts
│       ├── hooks/                  # useSensors.ts (polling hooks)
│       └── store/                  # currently unused/empty
├── firmware/
│   └── (ESP32 Arduino sketch — see Hardware Freeze notice below)
├── supabase/
│   └── config.toml
└── README.md
```

Only directories/files confirmed present during the engineering audit are
listed. Empty backend subpackages are included because they indicate planned
but unbuilt functionality.

---

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Both services must be able to reach each other over the same network for
telemetry and pump control to function, since the current implementation is
LAN-dependent (see [Current Architecture](#current-architecture)).

---

## Environment Configuration

Environment variable **names** verified in the codebase are listed below.
Values shown are placeholders only — **do not commit real credentials.**

**Backend** (`backend/.env`, root `.env`)
```
DATABASE_HOST=<placeholder>
DATABASE_PORT=<placeholder>
DATABASE_NAME=<placeholder>
DATABASE_USER=<placeholder>
DATABASE_PASSWORD=<placeholder>
DEVICE_CONTROL_URLS=<JSON mapping of device id -> ESP32 base URL>
CORS_ALLOW_ORIGINS=<comma-separated allowed origins>
```

**Frontend** (`frontend/.env`)
```
VITE_API_URL=<backend base URL>
VITE_DEVICE_ID=<default device id>
```

> A duplicate `frontend/frontend.env` file exists in the repository but is
> not part of Vite's standard env-loading convention and should not be relied
> upon as a source of truth.

---

## Backend API

All routes are currently **unauthenticated**.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sensor-data` | Ingest telemetry from the ESP32 |
| `GET` | `/health` | Health check |
| `GET` | `/api/sensors/latest` | Latest sensor reading |
| `GET` | `/api/sensors/history` | Historical sensor readings |
| `GET` | `/` | Root/info endpoint |
| `GET` | `/api/devices/{device_id}/status` | Device online/pump status |
| `POST` | `/api/devices/{device_id}/pump` | Set pump ON/OFF |
| `POST` | `/api/devices/{device_id}/pump/mode` | Toggle manual/auto override |

Pump-control routes proxy the command synchronously to the ESP32's configured
LAN IP address.

---

## Database

- **Engine:** PostgreSQL (Supabase-hosted)
- **ORM:** SQLAlchemy 2.0, models in `backend/app/models/`
- **Tables:**
  - `devices` — device identity, location, WiFi SSID, online status
  - `sensor_readings` — pH, TDS, EC, water temperature, water level, pump
    status, buzzer status, timestamp (FK to device)
- **Schema management:** created via `Base.metadata.create_all()` at startup.
  There is **no migration tooling (Alembic or otherwise)** — schema changes
  currently require manual intervention or a fresh create.

---

## ESP32 / Hardware

> ## ⚠️ HARDWARE FREEZE
> **Do not modify, flash, or refactor the ESP32 firmware until the frontend,
> backend, database, cloud deployment, and simulated-device workflow are
> stable.** Firmware changes made against a moving backend/API surface risk
> wasted flash cycles and untraceable regressions. Coordinate any firmware
> change with the current project maintainer first.

Current firmware behavior (as implemented today):
- Connects to a configured WiFi network and pushes telemetry via `HTTP POST`
  to a fixed backend URL every 5 seconds.
- Runs its own local HTTP server exposing `POST /pump`, `POST /pump/mode`,
  and `GET /status`.
- Includes a hardware safety interlock that prevents the pump from running
  when the tank is already full.
- Sensor readout: pH, TDS/EC (with on-device calibration polynomial), DS18B20
  water temperature, ultrasonic water level.
- Device identification is a hardcoded numeric ID, not derived from MAC
  address or any provisioning process.

---

## Current Features

- Telemetry ingestion from ESP32 into PostgreSQL, on a 5-second cadence
- Dashboard with live sensor values and historical charts, refreshed via
  polling
- Manual pump ON/OFF control and manual/auto mode switching, fully wired
  from the UI through the backend to the physical relay
- On-device auto-dosing (TDS-based) and auto water-level pump logic,
  independent of backend connectivity

---

## Known Limitations

- Pump control depends on the backend and ESP32 sharing a LAN — this breaks
  under cloud deployment as-is.
- No real-time push; all data is polled on a fixed interval, so UI updates
  lag by up to the poll interval.
- No database migrations; schema evolution is manual.
- No authentication on any layer (frontend routes, backend API, or the
  ESP32's own HTTP server).
- Several backend subpackages (`mqtt/`, `websockets/`, `auth/`, `middleware/`,
  `dependencies/`, `core/`) exist as empty placeholders with no functionality.
- Login page is a non-functional UI stub; no route guarding exists in the
  frontend.

---

## Security Status

- **No authentication currently exists** anywhere in the stack — API routes,
  pump control, and the ESP32's own HTTP endpoints are all open to any
  client that can reach them.
- **ESP32 WiFi is currently insecure**, using a hardcoded, unauthenticated
  network configuration in firmware.
- **LAN HTTP communication is plaintext** — no TLS between the ESP32 and the
  backend, or between the backend and the ESP32.
- A previously exposed database credential must be rotated before production
  deployment.
- **Never commit secrets, credentials, WiFi passwords, or API keys** to this
  repository. This README intentionally contains no real values — only
  variable names and placeholders.

---

## Cloud Deployment Plan

*(Planned — not yet implemented.)*

| Component | Planned Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Supabase |

The current backend-initiates-connection-to-ESP32 pump control model is
incompatible with a cloud-hosted backend reaching into a private LAN. The
planned direction is **ESP32-initiated HTTPS communication** — the device
polls or checks in with the cloud backend for pending commands, rather than
the backend calling out to the device's LAN IP. This requires backend and
protocol changes before physical hardware is pointed at a cloud endpoint.

Before any physical ESP32 is connected to a cloud-hosted backend, the new
communication pattern should be validated against a **mock/simulated
device** to avoid risking hardware against an unstable or incorrect API
contract.

---

## Development Workflow

1. Run backend and frontend locally on the same network as any test ESP32
   hardware.
2. Use the existing polling-based dashboard and pump control to validate
   changes against real or simulated telemetry.
3. Treat backend and frontend as the active development surface; firmware is
   frozen (see [Hardware Freeze](#esp32--hardware)) until the stack below it
   stabilizes.
4. Keep all credentials in local, gitignored `.env` files — never in source
   or in this README.

---

## Roadmap

1. **Repository & security hygiene** — rotate exposed credentials, resolve
   duplicate/dead files, confirm `.gitignore` coverage.
2. **Backend productionization** — introduce authentication, migrations, and
   a cloud-compatible device communication model.
3. **Frontend productionization** — implement real authentication/route
   guarding, remove hardcoded LAN IP fallbacks.
4. **Cloud deployment** — deploy frontend to Vercel, backend to Render,
   database on Supabase.
5. **Mock/simulated device testing** — validate the new ESP32-initiated
   communication pattern against a simulated device before touching real
   hardware.
6. **Final ESP32 cloud communication** — implement and verify
   ESP32-initiated HTTPS polling/check-in against the deployed backend.
7. **Physical hardware integration** — lift the hardware freeze and update
   firmware to the validated cloud communication pattern.
8. **End-to-end validation** — full system test from physical sensor through
   cloud backend to production frontend.
