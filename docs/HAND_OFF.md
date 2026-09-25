# AR Geo Anniversary Hunt — Hand Off

## Current status
This project is a mobile-first browser scavenger hunt prototype for a DC anniversary route. It is built as a static web app and designed to run without install on a phone.

The active approach is a simplified scavenger-hunt state machine:
- boot
- map
- ar_ready
- complete

The app tracks route progression, geofence distance checks, AR clue gating, localStorage persistence, and a debug path for simulating route progression without walking. The first GPS fix is evaluated immediately, so a player already inside the geofence does not need to wait for a second location update. AR models are served from the local `assets/models/` directory.

Camera permission is warmed up once, right when the player taps "Begin the adventure" (a user gesture, required for `getUserMedia` on iOS Safari), and the temporary stream is stopped immediately. That warm-up is best-effort only — it does not gate whether the AR clue is shown.

The map is rendered with Mapbox GL JS (v3.30.0, loaded from Mapbox's CDN) using a custom style (`mapbox://styles/nanocontroller/cmfywcwmu004c01qtfpkpbgqd`, named "Faded-copy" — intentionally label-free, so no street names render; that is a style choice, not a bug), replacing the earlier Leaflet + OpenStreetMap tile setup. The Mapbox access token (URL-restricted to `nanocontroller.github.io`) and style URL are both constants near the top of `app.js`. The geofence radius is drawn as a GeoJSON circle polygon (haversine-based, ~64 points) since Mapbox GL has no built-in meters-radius circle primitive. The map does not auto-follow the player on every GPS update (to avoid fighting manual pan/zoom); it only flies to the new checkpoint when the active checkpoint changes.

On-map wayfinding aids: a live dashed **walking route** from the player to the active stop (Mapbox Directions API `walking` profile, refreshed when the player moves >15 m or the stop changes, cleared when the AR overlay opens); a **building highlight** tinting the destination footprint (queried from an invisible `buildings-lookup` layer sourced from `mapbox.mapbox-streets-v8`); a **target pin labeled with the stop name**; a **direction arrow + walking ETA/distance** in the status pill; a **recenter button** that re-fits the map to include both the player and the target; and a translucent **GPS accuracy ring** around the player. Geofence entry is debounced — a fix that is confidently inside (distance + accuracy ≤ radius) triggers instantly, otherwise two consecutive in-radius fixes are required so a single bad GPS reading can't false-trigger; this never blocks arrival regardless of accuracy.

The project is currently in a working prototype state and is already pushed to GitHub.

## Project files
- index.html — main game shell, overlays, HUD, debug panel, AR modal
- styles.css — mobile styling, viewport sizing, debug UI
- app.js — hunt logic, state management, debug helpers, persistence
- route.js — canonical checkpoint route config
- assets/models/ — local GLB files used by the AR clues

## Current route (5 stops, `noma-5stop-final-v1`)
1. Union Market (38.908306, -76.997250, 20 m radius) — `union-market.glb`
2. La Cosecha (38.908778, -76.999444, 18 m radius) — `la_cosecha.glb`
3. Red Bear Brewing (38.905570, -77.002481, 18 m radius) — `red_bear_brewing.glb`
4. The Rigby (38.906031, -77.002184, 20 m radius) — `the_rigby.glb`
5. **Final** (38.9053987, -77.0028936, 50 m radius) — `the_globe.glb` — `final: true`

Route source is defined in `route.js`. On 2026-09-25 the route was cut to these 5 stops (REI and Eunia removed) and the copy rewritten per `docs/CONTENT.md`. Stop 5 ("Final") is a wrap-up finale: it's geofenced at REI's coordinates **as a placeholder** until the real brunch location is chosen, and its arrival shows a solid-backdrop finale modal (globe model + "the adventure continues" message, close button reads "Finish") instead of the live-camera reveal. Each stop also carries a `bloom: { strength, threshold, radius }` for its glow. **`the_globe.glb` does not exist yet** — the finale model 404s until it's added to `assets/models/`.

## 3D models & AR rendering (effects pipeline)
Models render with `<model-viewer>` **4.1.0** (the module build), `@google/model-viewer-effects` **1.5.0**, and `three` **0.172.0** loaded once via an import map in `index.html` — keep these versions pinned (effects breaks on three 0.182+/model-viewer 4.2+). The model-viewer has `environment-image="neutral"` + `tone-mapping="aces"`, and is wrapped in `<effect-composer render-mode="quality"><bloom-effect>` for the glow halo. On each model `load`, `app.js` forces **metalness = 1, roughness = 0** on every material (mirror chrome) and loops the clip (`play({repetitions: Infinity})`); per-stop bloom is applied from `route.js`. Bloom can't run in an AR session, so on `ar-status` the app boosts emissive strength ×1.8 while presenting and restores it after. iPhone Quick Look still auto-generates a **static** USDZ; add per-stop `.usdz` files for animated AR later.

## Behavior summary
- Start screen appears first, then the user begins the hunt (this tap also warms up camera permission).
- App checks geolocation and watches the player position.
- The map fills the entire screen at all times. A small floating status pill (status + live distance) sits on top; tapping it opens/closes an info drawer with the checkpoint title, clue text, progress list, and Reset Progress — the map is never blocked by a permanent panel.
- The first checkpoint is REI Washington DC and triggers within 50 meters.
- While tracking, the status pill shows a direction arrow toward the target plus the walking ETA and distance, and a dashed walking route is drawn on the map to the target. A recenter button re-fits the view to include the player and the target.
- When the player enters a checkpoint's radius (see the debounce rule above), the AR clue overlay opens automatically (full-screen 3D model + clue text), with a brief pin "arrival" animation — no manual "View AR Clue" tap and no per-checkpoint permission prompt.
- Tapping "Close & continue" on the AR overlay unlocks the checkpoint, persists progress, and immediately advances to the next checkpoint (or to the victory overlay after the last checkpoint's AR clue is closed).
- The current app also includes a Safari geolocation recovery banner if permission is denied.
- Saved state includes a route version. If an older route configuration is found, the app rebuilds checkpoint metadata from `route.js` while preserving matching progress.

## Debug features added
The app includes a debug mode for testing without physically walking around town.

Open with:
- http://localhost:8000/?debug=1
- https://nanocontroller.github.io/ar-geo-hunt/?debug=1

Phone debug sequence:
1. Open the HTTPS debug URL.
2. Tap Begin the adventure.
3. Tap Test REI geofence. This simulates a GPS position at REI and should show `Distance: 0 m` and the AR clue overlay opening automatically.
4. Tap Close & continue to unlock the checkpoint and advance to the next one.

Debug helpers available:
- **`type: stop N` box + Play full stop** — plays a stop's entire arrival (fly-in → walking route → auto AR clue). Fastest way to preview any stop; see `FIELD_TESTING.md`.
- fake lat/lng input + Apply fake location
- Test REI geofence button
- Skip to next
- Jump to checkpoint number
- Complete route
- browser console helpers at `window.geoHuntDebug` (includes `geoHuntDebug.stop(N)`)

Console examples:
- `geoHuntDebug.stop(3)`
- `geoHuntDebug.setLocation(38.9053987, -77.0028936)`
- `geoHuntDebug.setLocation(38.9056057, -77.0028936)` (approximately 23 m from REI; should trigger)
- `geoHuntDebug.jumpToCheckpoint(3)`
- `geoHuntDebug.nextCheckpoint()`
- `geoHuntDebug.completeRoute()`
- `geoHuntDebug.reset()`

## Browser-specific notes
- Chrome/Safari viewport mismatch was addressed by using a viewport-aware height approach instead of a rigid `100vh` assumption. This is important for mobile browsers where the visible viewport height changes with browser UI chrome.
- Safari location permission problems were addressed by using a clearly user-triggered geolocation flow and a recovery banner telling users to go to Settings → Safari → Websites → Location.
- If permission is denied in Safari, the app now explains the fix instead of only failing silently.
- For field testing, use the normal HTTPS URL without `?debug=1`, tap Start Hunt, and allow location access. The displayed GPS distance can differ from actual distance when the phone reports a low-accuracy fix.

## Verification status
Fresh validation succeeded for the current version:
- `node --check app.js` passed
- `node --check route.js` passed
- Browser debug test passed at 0 m and approximately 23 m, both showing `Checkpoint nearby`.
- local static serve succeeded with HTTP 200 for the app page

## Current working assumptions
- Browser-only geolocation + AR is the intended prototype path.
- Marker fallback remains optional and intentionally deferred unless needed.
- The app is a mobile test prototype, not a production geospatial app.
- GitHub Pages / static hosting is still the deployment path for real-device testing.

## Recommended next steps
1. Test the route on a real phone in Chrome and Safari.
2. Confirm geofence accuracy and checkpoint progression in the field.
3. If field testing is too noisy, use debug mode to validate state transitions.
4. Re-test Safari permission flow on a real iPhone and confirm the Settings path is accurate for the device/browser version.
5. Optionally polish UX copy and visuals after the game loop is stable.
6. Once mobile testing is stable, consider GitHub Pages deployment for easy sharing.

## Notes for the next session
- The route config is the source of truth in `route.js`.
- Local persistence is enabled through `localStorage` and uses the key `geo-hunt-state-v3`. The route content version (`ROUTE_VERSION` in `app.js`, currently `union-market-6stop-v1`) must be bumped whenever checkpoints are added/removed/reordered — a mismatch causes saved progress to be discarded and rebuilt from `route.js`, which is what keeps stale progress from an old 5-stop save from misapplying to the new 6-stop route.
- The debug mode is triggered via the query string `?debug=1`.
- The debug console API is available at `window.geoHuntDebug`.
- If you need to reset the route in dev, use `geoHuntDebug.reset()` or the reset button.
- If Safari still fails to request permission, check the actual device Settings for that site and use the banner guidance as a fallback.

## Last known local URL for testing
- http://localhost:8000/?debug=1

## Last known published URL for phone testing
- https://nanocontroller.github.io/ar-geo-hunt/?debug=1

## Git repo status
The repo is already pushed and the app is in a working prototype state.
Current remote:
- https://github.com/Nanocontroller/ar-geo-hunt.git
