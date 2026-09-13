# Field Testing — Remote Debug Walkthrough (No Travel Required)

## Context
This checklist lets you validate the real app on a real iPhone (or a desktop browser) without being in DC. It uses the app's built-in `?debug=1` mode to inject fake checkpoint coordinates directly into app state, bypassing real GPS — so it works from anywhere, including Chicago.

Accuracy/GPS-drift testing is out of scope here. That requires either walking the real DC route, or simulating continuous motion via Xcode + a GPX file (see "Later: simulating real walking" at the bottom) — hold off on that until this checklist passes.

## Prerequisites
- iPhone with Safari (or any desktop browser for a quick preview)
- Mac with Xcode/Safari installed (only needed for the optional remote console)

## Cache note
`app.js`, `styles.css`, and `route.js` are loaded with a `?v=N` query param and GitHub Pages caches them for 10 minutes (`cache-control: max-age=600`). If you re-test after a new push and still see old behavior (e.g. errors referencing line numbers that don't match the current file), your phone likely has the previous version cached. Bump the `?v=N` suffix on those tags in `index.html` on each push that changes them, or test in a Private Browsing tab to bypass the cache immediately.

---

## Fastest way to test & preview: the "stop" player
The debug panel has a **`type: stop 1` box** at the top. Type a stop number (e.g. `stop 1`, `stop 3`, or just `3`) and tap **Play full stop** — or press Enter. It plays the *entire* arrival experience for that stop, in order:

1. The map flies to that stop.
2. You're dropped ~120 m away, so the **dashed walking route** from your position to the stop draws, the **geofence circle** appears, and the destination **building lights up** (teal).
3. After ~2.5 seconds you "arrive" inside the geofence and the **AR clue overlay opens automatically** — that stop's 3D model over the live camera feed, with its clue text.
4. Tap **Close & continue** to unlock the stop and advance to the next one (or reach the victory screen after stop 6).

This is the quickest loop for previewing any single stop or the whole route. You can jump straight to any stop in any order — `stop 5`, then `stop 2`, etc.

Same thing from the Mac console (see "Remote console" below): `geoHuntDebug.stop(3)`.

---

## Debug panel controls — what each one does
The panel only appears when the URL ends in `?debug=1`.

| Control | What it does |
|---|---|
| **`type: stop N` box + Play full stop** | The full arrival demo above — fly-in → walking route → auto AR clue. Start here. |
| **lat / lng + Apply fake location** | Teleports your simulated position to exact coordinates. If that lands inside the current stop's radius, the AR clue auto-opens; otherwise you just see the map/route update. Use for precise geofence-edge testing. |
| **Test REI geofence** | Shortcut that drops you exactly on stop 1 (REI) so its AR clue pops immediately. Equivalent to `stop 1` but with no approach animation. |
| **jump to checkpoint # + Jump** | Sets the *active* stop to that number and centers the map on it, without playing the arrival or opening AR. Use to reposition, then arrive manually with a lat/lng or the stop player. |
| **Skip to next** | Marks the current stop solved and advances to the next one (or the victory screen), same as tapping "Close & continue" on a clue. |
| **Complete route** | Marks every stop solved and jumps to the victory overlay. Use to test the end state. |

Console equivalents (all available at `window.geoHuntDebug`):
- `geoHuntDebug.stop(3)` — play the full arrival for stop 3
- `geoHuntDebug.setLocation(lat, lng)` — apply a fake location
- `geoHuntDebug.jumpToCheckpoint(3)` — set active stop without arriving
- `geoHuntDebug.nextCheckpoint()` — solve + advance
- `geoHuntDebug.completeRoute()` — jump to victory
- `geoHuntDebug.reset()` — wipe saved progress and start over

---

## Recommended run-through on a real iPhone

1. **(Optional) Enable Safari's remote console** so you can watch logs from your Mac:
   - iPhone: Settings → Safari → Advanced → Web Inspector → on.
   - Mac: Safari → Develop menu → select your iPhone → select the page once it's open. This gives you `geoHuntDebug` from the Mac.

2. On the iPhone, open Safari and go to:
   `https://nanocontroller.github.io/ar-geo-hunt/?debug=1`

3. Tap **Begin the adventure**.
   - Allow the location prompt (real GPS — it'll report Chicago; that's expected and fine, we're not relying on it).
   - Allow the camera prompt if it appears (camera warm-up for the AR feed).

4. In the debug panel, type **`stop 1`** and tap **Play full stop**.
   - **Expected:** map flies to REI, the dashed walking route + geofence + building highlight appear, then after ~2.5 s the AR overlay pops open automatically — live camera feed in the background, the first 3D model floating over it, plus the clue text, no extra taps. Confirm the model renders and is draggable, and the camera feed is genuinely live (not frozen/black).

5. Tap **Close & continue**.
   - **Expected:** overlay closes, progress becomes `1 / 6`, the map advances to stop 2 (Union Market).

6. Repeat for **`stop 2`** through **`stop 6`**, confirming each one flies in, draws its route, and auto-pops its own model + clue. (You can also just keep tapping Close & continue to walk the route in order.)

7. On **stop 6 (The Rigby)**, also tap **model-viewer's own built-in AR icon** (small icon in the corner of the 3D view — not the app's "Close & continue", and not the automatic camera feed). This is optional/secondary: it hands off to real iOS Quick Look for world-anchored placement. Worth checking because it's the one native-AR behavior only real iOS hardware can validate.

8. After closing stop 6's AR, confirm the **victory overlay** appears.

## Manual coordinates (if you want to place yourself precisely)
From `route.js`, for the lat/lng + Apply fake location fields:

| Stop | Name | Lat | Lng |
|---|---|---|---|
| 1 | REI Washington DC | 38.9053987 | -77.0028936 |
| 2 | Union Market | 38.908306 | -76.997250 |
| 3 | La Cosecha | 38.908778 | -76.999444 |
| 4 | Eunia | 38.907966 | -77.001971 |
| 5 | Red Bear Brewing | 38.905570 | -77.002481 |
| 6 | The Rigby | 38.906031 | -77.002184 |

## What to flag
The spots most likely to behave differently on real iOS vs. the headless browser tests:
- AR overlay not auto-popping on arrival, or the camera feed not appearing / staying frozen.
- The walking route not drawing (needs the Directions API + a working Mapbox token on the live domain).
- model-viewer's native AR (Quick Look) not launching from step 7.

## Later: simulating real walking (Xcode + GPX)
Once this checklist passes and accuracy/movement testing becomes relevant:
1. Connect the iPhone to the Mac via cable.
2. Open Xcode → Window → Devices and Simulators → select the device.
3. Use the location simulation controls to load a custom GPX file containing waypoints at the 6 stop coordinates above, with a walking pace.
4. This drives the real `navigator.geolocation` / `watchPosition` API on the phone as if walking the DC route, without leaving Chicago — testing GPS drift, permission flow, and radius tuning end-to-end.
