# Field Testing — Remote Debug Walkthrough (No Travel Required)

## Context
This checklist lets you validate the real app on a real iPhone without being in DC. It uses the app's built-in `?debug=1` mode to inject fake checkpoint coordinates directly into app state, bypassing real GPS — so it works from anywhere, including Chicago.

Accuracy/GPS-drift testing is out of scope here. That requires either walking the real DC route, or simulating continuous motion via Xcode + a GPX file (see "Later: simulating real walking" at the bottom) — hold off on that until this checklist passes.

## Prerequisites
- iPhone with Safari
- Mac with Xcode/Safari installed (only needed for the optional remote console in step 1)

## Cache note
`app.js`, `styles.css`, and `route.js` are loaded with a `?v=N` query param and GitHub Pages caches them for 10 minutes (`cache-control: max-age=600`). If you re-test after a new push and still see old behavior (e.g. errors referencing line numbers that don't match the current file), your phone likely has the previous version cached. Bump the `?v=N` suffix on those three `<script>`/`<link>` tags in `index.html` on each push that changes them, or test in a Private Browsing tab to bypass the cache immediately.

## Steps

1. **Enable Safari's remote console on the iPhone** (optional, but makes steps 7+ much easier):
   - On iPhone: Settings → Safari → Advanced → Web Inspector → on.
   - On Mac: Safari → Develop menu → select your iPhone → select the page once it's open.
   - This gives you `geoHuntDebug` console access from your Mac while looking at the phone screen.

2. On the iPhone, open Safari and go to:
   `https://nanocontroller.github.io/ar-geo-hunt/?debug=1`

3. Tap **Begin the adventure**.
   - Allow the location permission prompt (real GPS — it will report Chicago, that's expected and fine, we're not relying on it).
   - Allow the camera permission prompt if it appears (camera warm-up).

4. A debug panel should be visible near the bottom of the screen. Tap **Test REI geofence** — this injects checkpoint 1's exact coordinates directly into app state.

5. **Expected result:** the AR overlay pops open immediately and automatically, showing the first 3D model and clue text — no extra taps required. Confirm the model renders and is interactive (drag to orbit).

6. Tap **Close & continue**.
   - Expected: overlay closes, progress becomes `1 / 5`, the map re-centers, and the status pill now reflects checkpoint 2 (La Cosecha).

7. For checkpoints 2–5 (no dedicated buttons for these), use either:
   - The debug panel's lat/lng fields + **Apply fake location** button, or
   - The Mac console (from step 1): `geoHuntDebug.setLocation(lat, lng)`

   Coordinates (from `route.js`):
   | Checkpoint | Lat | Lng |
   |---|---|---|
   | La Cosecha | 38.9099 | -76.9961 |
   | Eunia | 38.9101 | -76.9958 |
   | Red Bear Brewing | 38.9103 | -76.9952 |
   | The Rigby | 38.9106 | -76.9948 |

   Each one should auto-pop its AR overlay the same way step 5 did.

8. On checkpoint 5's AR overlay, also tap **model-viewer's own built-in AR icon** (small icon in the corner of the 3D view — not the app's "Close & continue" button). This triggers real iOS Quick Look AR using the actual camera. Worth checking here since it's unrelated to GPS and is the one piece of native AR behavior that only real iOS hardware can validate.

9. After closing checkpoint 5's AR, confirm the victory overlay appears.

## What to flag
The two spots most likely to behave differently on real iOS vs. the headless browser test already run:
- Step 5/7 — AR overlay not auto-popping on arrival.
- Step 8 — Quick Look not launching from model-viewer's native AR button.

## Later: simulating real walking (Xcode + GPX)
Once this checklist passes and accuracy/movement testing becomes relevant:
1. Connect the iPhone to the Mac via cable.
2. Open Xcode → Window → Devices and Simulators → select the device.
3. Use the location simulation controls to load a custom GPX file containing waypoints at the 5 checkpoint coordinates above, with a walking pace.
4. This drives the real `navigator.geolocation` / `watchPosition` API on the phone as if walking the DC route, without leaving Chicago — testing GPS drift, permission flow, and radius tuning end-to-end.
