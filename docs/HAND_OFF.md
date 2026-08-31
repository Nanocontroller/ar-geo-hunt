# AR Geo Anniversary Hunt — Hand Off

## Current status
This project is a mobile-first browser scavenger hunt prototype for a DC anniversary route. It is built as a static web app and designed to run without install on a phone.

The active approach is the full scavenger-hunt state machine (option 3):
- boot
- map
- geofence_triggered
- ar_permission
- ar_ready
- clue_reveal
- complete

The app tracks route progression, geofence distance checks, AR clue gating, localStorage persistence, and a debug path for simulating route progression without walking.

The project is currently in a working prototype state and is already pushed to GitHub.

## Project files
- index.html — main game shell, overlays, HUD, debug panel, AR modal
- styles.css — mobile styling, viewport sizing, debug UI
- app.js — hunt logic, state management, debug helpers, persistence
- route.js — canonical checkpoint route config

## Current route
1. Union Market
2. La Cosecha
3. Eunia
4. Red Bear Brewing
5. The Rigby

Route source is defined in `route.js` and used by app logic.

## Behavior summary
- Start screen appears first, then the user begins the hunt.
- App checks geolocation and watches the player position.
- When the user nears the active checkpoint radius, the app enters the geofence-triggered state.
- AR clue screen is gated behind permissions and only becomes available if the device supports the camera flow.
- Unlocking a checkpoint advances the route and persists progress in localStorage.
- Final completion triggers a victory overlay.
- The current app also includes a Safari geolocation recovery banner if permission is denied.

## Debug features added
The app includes a debug mode for testing without physically walking around town.

Open with:
- http://localhost:8000/?debug=1

Debug helpers available:
- fake lat/lng input + Apply fake location
- Skip to next
- Jump to checkpoint number
- Complete route
- browser console helpers at `window.geoHuntDebug`

Console examples:
- `geoHuntDebug.setLocation(38.9096, -76.9969)`
- `geoHuntDebug.jumpToCheckpoint(3)`
- `geoHuntDebug.nextCheckpoint()`
- `geoHuntDebug.completeRoute()`
- `geoHuntDebug.reset()`

## Browser-specific notes
- Chrome/Safari viewport mismatch was addressed by using a viewport-aware height approach instead of a rigid `100vh` assumption. This is important for mobile browsers where the visible viewport height changes with browser UI chrome.
- Safari location permission problems were addressed by using a clearly user-triggered geolocation flow and a recovery banner telling users to go to Settings → Safari → Websites → Location.
- If permission is denied in Safari, the app now explains the fix instead of only failing silently.

## Verification status
Fresh validation succeeded for the current version:
- `node --check app.js` passed
- `node --check route.js` passed
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
- Local persistence is enabled through `localStorage` and uses the key `geo-hunt-state-v1`.
- The debug mode is triggered via the query string `?debug=1`.
- The debug console API is available at `window.geoHuntDebug`.
- If you need to reset the route in dev, use `geoHuntDebug.reset()` or the reset button.
- If Safari still fails to request permission, check the actual device Settings for that site and use the banner guidance as a fallback.

## Last known local URL for testing
- http://localhost:8000/?debug=1

## Git repo status
The repo is already pushed and the app is in a working prototype state.
Current remote:
- https://github.com/Nanocontroller/ar-geo-hunt.git
