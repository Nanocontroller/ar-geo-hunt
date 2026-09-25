# AR Geo Anniversary Hunt

A mobile-first, install-free browser scavenger hunt for a DC anniversary route. Players walk a 6-stop route around Union Market; arriving at each stop automatically reveals an AR clue (a 3D model over the live camera feed) as the "punch line," then advances them to the next stop.

**Live:** https://nanocontroller.github.io/ar-geo-hunt/
**Repo:** [`Nanocontroller/ar-geo-hunt`](https://github.com/Nanocontroller/ar-geo-hunt)

## How it plays
1. Open the site on a phone and tap **Begin the adventure** (this also warms up camera permission).
2. Allow location access. The full-screen map shows your position, the target stop (labeled with its name), a geofence circle, and a live dashed **walking route** to it.
3. Walk toward the target. The status pill shows a direction arrow and the walking **ETA + distance**.
4. When you arrive inside the stop's radius, the **AR clue overlay opens automatically** — the stop's 3D model over your live camera feed, plus clue text.
5. Tap **Close & continue** to unlock the stop and advance to the next one. After the last stop, the victory screen appears.

## Tech stack
- **Static web app** — no build step, no framework. Plain HTML/CSS/JS served as files.
- **[Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) v3.30.0** — map, geofence circle, walking route (Directions API), building highlight, markers. Uses a custom Mapbox Studio style and a URL-restricted public token.
- **[`<model-viewer>`](https://modelviewer.dev/) 4.1.0 (module build) + `model-viewer-effects` 1.5.0 + `three` 0.172.0** (via import map) — renders the AR models with a metallic/chrome look (`environment-image="neutral"`, `tone-mapping="aces"`), a bloom glow (`<effect-composer><bloom-effect>`), and optional native AR handoff (iOS Quick Look). **Keep these versions pinned** — effects breaks on newer three/model-viewer.
- **Browser geolocation** (`watchPosition`) + **`getUserMedia`** (camera passthrough behind the AR model).

## Project structure
| File | Purpose |
|---|---|
| `index.html` | App shell — map, status pill, info drawer, overlays (intro / AR / victory), debug panel |
| `app.js` | Hunt logic — state machine, geolocation, geofence, map rendering, AR, persistence, debug helpers |
| `route.js` | Canonical 6-stop route config (source of truth) |
| `styles.css` | Mobile styling |
| `assets/models/*.glb` | 3D models used by the AR clues (`01.glb`–`06.glb`) |
| `docs/HAND_OFF.md` | Architecture / state-of-the-app hand-off notes |
| `docs/FIELD_TESTING.md` | How to test the whole flow on a real phone without traveling |

## The route
Defined in `route.js`. Current stops (5): Union Market → La Cosecha → La Cervecería → The Apartment → **Final Stop (Euonia)**. Each stop has coordinates, a geofence radius, a 3D model, per-stop bloom settings, and clue text. The last stop (`final: true`) is a wrap-up finale modal on a solid backdrop (a spinning globe + a proposal to keep exploring the world together).

`ROUTE_VERSION` in `app.js` (`noma-5stop-final-v1`) is bumped whenever stops are added/removed/reordered so stale saved progress is discarded and rebuilt from `route.js`.

## Map & wayfinding features
- **Auto-AR on arrival** — no per-stop taps; the clue opens when you enter the geofence.
- **Live walking route** — dashed path from your location to the target via the Mapbox Directions API, refreshed as you move.
- **Target label** — the stop name (e.g. "Union Market") floats above the target pin.
- **Direction arrow + ETA** — the status pill points toward the target and shows the walking time and distance.
- **Recenter button** — re-fits the map to show both you and the target after you've panned.
- **Building highlight** — the destination building's footprint is tinted so it's easy to spot.
- **GPS accuracy ring** — a translucent ring shows your fix's accuracy; geofence entry is debounced so a single bad fix can't false-trigger.

## Running locally
It's a static site, so any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Note: the Mapbox token is **URL-restricted** to `nanocontroller.github.io`. For full map/Directions functionality on `localhost`, add `localhost` to the token's URL allowlist in the Mapbox dashboard, or test against the live domain.

### Cache-busting (important)
GitHub Pages caches `app.js`, `styles.css`, and `route.js` for 10 minutes (`max-age=600`). They're loaded with `?v=N` query params in `index.html` — **bump `N` on every change to those files** or phones will run stale code. Current: `app.js?v=12`, `styles.css?v=10`, `route.js?v=7`.

## Debug / testing mode
Append `?debug=1` to the URL to show the debug panel. The fastest way to preview a stop:

- Type `stop 1` (or any number) in the **"type: stop 1"** box and tap **Play full stop** — it plays the entire arrival for that stop: map fly-in → walking route → auto AR clue.

Console API (`window.geoHuntDebug`):
- `geoHuntDebug.stop(3)` — play the full arrival for stop 3
- `geoHuntDebug.setLocation(lat, lng)` — apply a fake location
- `geoHuntDebug.jumpToCheckpoint(3)` — set active stop without arriving
- `geoHuntDebug.nextCheckpoint()` — solve + advance
- `geoHuntDebug.completeRoute()` — jump to victory
- `geoHuntDebug.reset()` — wipe saved progress

See `docs/FIELD_TESTING.md` for the full on-device walkthrough.

## Deployment
Push to `main` on `Nanocontroller/ar-geo-hunt`; GitHub Pages serves the site. Remember to bump the `?v=N` cache-busts for any changed static file. The Mapbox token is a URL-restricted public (`pk.`) token embedded in `app.js`; GitHub push protection flags token changes and requires a one-time unblock approval per new token value.

## Persistence
Progress is saved in `localStorage` under `geo-hunt-state-v3`. Loading validates the saved `routeVersion`; a mismatch discards stale progress and rebuilds from `route.js`.
