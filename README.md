# Plomari Wildfire Tracker

A public, mobile-friendly situational-awareness map for the 29 July 2026
Plomari wildfire on Lesvos, Greece. It combines source-labeled official
instructions, satellite thermal detections, local field reporting, detailed
modeled wind, a measured airport observation, a smoke transport proxy, and a
clearly marked spread-scenario tool.

[Open the live map](https://plomari-fire-map.xlzuv.chatgpt.site)

> **Safety notice**
>
> This is an independent information aid, not an emergency service, official
> fire perimeter, evacuation routing system, or substitute for instructions
> from 112, the Hellenic Fire Service, police, or Civil Protection. Satellite
> detections are approximate thermal pixels. Modeled smoke and spread layers
> are scenarios, not observations or predictions. In an emergency, call 112
> and follow authorities.

## What the map shows

- The latest sourced 112 instruction and Fire Service response update.
- Near-real-time NASA FIRMS VIIRS/MODIS thermal pixels for the whole of
  Lesvos, pulled server-side and refreshed every 5 minutes while the page is
  open. Each pixel shows its acquisition time in Greece local time. These are
  approximate thermal pixels, **not** a mapped fire edge. If the live feed is
  unavailable, a clearly labeled 29 July snapshot is shown instead.
- Source-labeled local reports, with official, observed, reported, and modeled
  information visually distinguished.
- Open-Meteo wind at 10 m, 80 m, 120 m, and 180 m above ground for the incident
  area, plus gusts, humidity, pressure, and boundary-layer height.
- The latest available measured METAR from Mytilene Airport (LGMT), shown with
  its own observation time.
- A wind-driven smoke exposure envelope and selectable time horizon. It is
  **not** measured PM2.5, an air-quality forecast, or safe-route guidance.
- An optional spread scenario controlled by wind force, direction, and time.
  It is intentionally labeled as a scenario rather than a forecast.

There is no personal location tracking, GPS prompt, user marker, account data,
or user-specific status in this repository.

## Data freshness and limitations

| Layer | Application check | Underlying data cadence | Important limitation |
| --- | --- | --- | --- |
| Detailed wind | Every 5 minutes while the page is open | Open-Meteo model cycles update less often | Point forecast/model, not an on-site anemometer |
| LGMT METAR | Every 5 minutes through the server route | Usually observed about every 30 minutes; provider cache updates about once a minute | Airport is not the fireground; terrain can produce very different local wind |
| Smoke envelope | Recomputed whenever wind data or the selected horizon changes | Derived from the current 10 m model wind | Not observed smoke, PM2.5, or a dispersion model |
| NASA FIRMS points | Every 5 minutes while the page is open (server cache ≈2 min) | FIRMS services update roughly every 15 minutes after satellite processing | New points require a new satellite overpass and can arrive roughly 1–3 hours after the pass; requires `FIRMS_MAP_KEY` (falls back to a labeled 29 July snapshot without it) |
| Official/local incident timeline | Manually curated in this release | Depends on the source publisher | Always check 112 and local authorities directly |

Every live data panel exposes its model/observation time. If live wind retrieval
fails, the interface marks the data stale and retains a timestamped fallback so
the failure is visible rather than silently presenting it as current.

## Sources

- [112 Greece — official alert](https://x.com/112Greece/status/2082468150189167080)
- [Greek Civil Protection guidance](https://civilprotection.gov.gr/112/odigies-prostasias)
- [Hellenic Fire Service](https://x.com/pyrosvestiki/status/2082459852350066823)
- [NASA FIRMS thermal-data description](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html)
- [NASA FIRMS area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [NASA FIRMS WMS documentation](https://firms.modaps.eosdis.nasa.gov/mapserver/wms-info/)
- [Open-Meteo forecast API](https://open-meteo.com/en/docs)
- [AviationWeather API](https://aviationweather.gov/data/api/)
- [StoNisi local fire reporting](https://www.stonisi.gr/post/114624/stamathsan-oi-ripseis-apo-aeros-sthn-fwtia-toy-plwmarioy)
- [StoNisi satellite-smoke report](https://www.stonisi.gr/post/115334/kapnos-apo-thn-toyrkia-skepazei-lesvo-kai-xio)

Basemaps use OpenStreetMap/CARTO, Esri World Imagery, and OpenTopoMap, with
provider attribution displayed on the map.

## Run locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then paste your FIRMS map key
npm run dev
```

Then open <http://localhost:3000>.

Production validation:

```bash
npm run lint
npm run build
npm start
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIRMS_MAP_KEY` | Recommended | Server-side key for the NASA FIRMS area API used by `/api/firms`. Without it the app still runs, but the thermal layer shows a labeled static snapshot instead of live detections. Request a free key at <https://firms.modaps.eosdis.nasa.gov/api/map_key/>. |

The key is read only inside the server route. Never expose it with a
`NEXT_PUBLIC_` prefix, and never commit `.env.local` (the `.gitignore`
already excludes it).

## Deploy to Vercel

1. Import this GitHub repository in Vercel.
2. Keep the detected framework as **Next.js**.
3. Use the default build command (`npm run build`) and output settings.
4. Add the `FIRMS_MAP_KEY` environment variable (Settings → Environment
   Variables) for Production, Preview, and Development.
5. Deploy.

The `/api/wind` and `/api/firms` routes fetch Open-Meteo, AviationWeather,
and NASA FIRMS data server-side, so the browser does not need cross-origin
access to the upstream services and the FIRMS key never reaches the client.
Vercel may cache a successful wind response for up to five minutes and a
FIRMS response for about two minutes.

## Project structure

```text
app/
  api/firms/route.ts  # live NASA FIRMS VIIRS/MODIS detections for Lesvos
  api/wind/route.ts   # normalized model wind and LGMT METAR
  globals.css         # responsive tactical interface
  layout.tsx          # metadata and document shell
  page.tsx            # Leaflet map, layers, timeline, and scenarios
public/
  favicon.svg
.env.example          # documents FIRMS_MAP_KEY for new developers
```

## Notes for developers taking this over

- All timestamps shown in the interface are Greece local time
  (`Europe/Athens`), formatted client-side from ISO/UTC values returned by
  the API routes.
- Client polling cadence is 5 minutes for both `/api/wind` and `/api/firms`;
  the header clock ticks every second.
- Live-data panels display their model/observation time and degrade
  visibly (stale/snapshot labels) instead of failing silently.
- The incident timeline (`intel` in `app/page.tsx`) and the static
  fallback detections are manually curated and dated 29 July 2026; update or
  retire them as the situation evolves.
- The confidence taxonomy (official / observed / reported / modeled) is
  load-bearing across the UI — keep new layers labeled with a source and a
  freshness time.

## Design attribution

The command-center visual language and operational-layer organization were
inspired by [Vrushank Patel's Godseye project](https://github.com/VrushankPatel/godseye).
This repository is an independent implementation and does not copy Godseye
source code or claim affiliation with Palantir.

## License

[Apache License 2.0](LICENSE)
