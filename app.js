const STORAGE_KEY = 'geo-hunt-state-v3';
const ROUTE_VERSION = 'noma-5stop-final-v1';
const ROUTE = window.unionMarketRoute || [];
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibmFub2NvbnRyb2xsZXIiLCJhIjoiY211MDhnMnUzMHpudjJ3cG1pZGdmc3NrZSJ9.92dLSVjzLs9lR8UFr2GKbQ';
const MAPBOX_STYLE = 'mapbox://styles/nanocontroller/cmfywcwmu004c01qtfpkpbgqd';
const BUILDING_HIGHLIGHT_COLOR = '#2dd4ee';
const WALKING_ROUTE_COLOR = '#4ec7ff';
const ROUTE_REFRESH_DISTANCE_METERS = 15;

const unionMarketCheckpoints = ROUTE.length
  ? ROUTE.map((checkpoint) => ({ ...checkpoint, solved: false, solvedAt: null }))
  : [];

const appState = loadState();
let map;
let mapReady = false;
let playerMarker;
let targetMarker;
let lastRenderedCheckpointId = null;
let lastHighlightedCheckpointId = null;
let lastRouteFetchLocation = null;
let lastRouteFetchCheckpointId = null;
let routeFetchInFlight = false;
let lastRouteSummary = null;
let lastAccuracy = null;
let inRadiusStreak = 0;
let watchId = null;
let playStopTimer = null;
let arCameraStream = null;

const STOP_PREVIEW_APPROACH_METERS = 120;
const STOP_PREVIEW_ARRIVAL_DELAY_MS = 2600;
const prefetchedModelUrls = new Set();

const elements = {
  checkpointTitle: document.getElementById('checkpointTitle'),
  checkpointHint: document.getElementById('checkpointHint'),
  distanceText: document.getElementById('distanceText'),
  dirArrow: document.getElementById('dirArrow'),
  recenterButton: document.getElementById('recenterButton'),
  startButton: document.getElementById('startButton'),
  resetButton: document.getElementById('resetButton'),
  statusPill: document.getElementById('statusPill'),
  infoDrawer: document.getElementById('infoDrawer'),
  arOverlay: document.getElementById('arOverlay'),
  arCameraVideo: document.getElementById('arCameraVideo'),
  modelViewer: document.getElementById('modelViewer'),
  bloomEffect: document.getElementById('bloomEffect'),
  arLabel: document.getElementById('arLabel'),
  clueTitle: document.getElementById('clueTitle'),
  clueText: document.getElementById('clueText'),
  closeArButton: document.getElementById('closeArButton'),
  statusBadge: document.getElementById('statusBadge'),
  locationHelpBanner: document.getElementById('locationHelpBanner'),
  progressList: document.getElementById('progressList'),
  progressCount: document.getElementById('progressCount'),
  introOverlay: document.getElementById('introOverlay'),
  beginAdventureButton: document.getElementById('beginAdventureButton'),
  victoryOverlay: document.getElementById('victoryOverlay'),
  victoryText: document.getElementById('victoryText'),
  playAgainButton: document.getElementById('playAgainButton'),
  debugPanel: document.getElementById('debugPanel'),
  debugLat: document.getElementById('debugLat'),
  debugLng: document.getElementById('debugLng'),
  debugCheckpointInput: document.getElementById('debugCheckpointInput'),
  debugStopInput: document.getElementById('debugStopInput'),
  debugStopButton: document.getElementById('debugStopButton'),
  debugApplyButton: document.getElementById('debugApplyButton'),
  debugTestReiButton: document.getElementById('debugTestReiButton'),
  debugNextButton: document.getElementById('debugNextButton'),
  debugJumpButton: document.getElementById('debugJumpButton'),
  debugCompleteButton: document.getElementById('debugCompleteButton')
};

function syncViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', syncViewportHeight);
window.addEventListener('orientationchange', syncViewportHeight);
syncViewportHeight();

function createInitialState() {
  return {
    currentCheckpointIndex: 0,
    phase: 'boot',
    playerLocation: null,
    progress: [],
    routeVersion: ROUTE_VERSION,
    checkpoints: unionMarketCheckpoints.map((checkpoint) => ({ ...checkpoint }))
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createInitialState();

  try {
    const parsed = JSON.parse(saved);
    if (!parsed || parsed.routeVersion !== ROUTE_VERSION) return createInitialState();

    const currentCheckpoints = unionMarketCheckpoints.map((checkpoint) => {
      const savedCheckpoint = parsed.checkpoints.find((item) => item.id === checkpoint.id);
      return {
        ...checkpoint,
        solved: Boolean(savedCheckpoint && savedCheckpoint.solved),
        solvedAt: savedCheckpoint ? savedCheckpoint.solvedAt || null : null
      };
    });

    return {
      ...createInitialState(),
      ...parsed,
      checkpoints: currentCheckpoints,
      routeVersion: ROUTE_VERSION
    };
  } catch (error) {
    console.warn('Failed to load saved state:', error);
    return createInitialState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function getCurrentCheckpoint() {
  return appState.checkpoints[appState.currentCheckpointIndex];
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isWithinRadius(location, checkpoint) {
  if (!location || !checkpoint) return false;
  return haversineMeters(location.lat, location.lng, checkpoint.lat, checkpoint.lng) <= checkpoint.radius;
}

function setPhase(nextPhase) {
  appState.phase = nextPhase;
  render();
}

function circlePolygon(lat, lng, radiusMeters, points = 64) {
  const coords = [];
  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;

  for (let i = 0; i <= points; i += 1) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] }
  };
}

function geofenceCirclePolygon(checkpoint, points = 64) {
  return circlePolygon(checkpoint.lat, checkpoint.lng, checkpoint.radius, points);
}

const EMPTY_FEATURE = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } };

function updatePlayerAccuracy() {
  if (!mapReady) return;
  const accuracySource = map.getSource('player-accuracy');
  if (!accuracySource) return;

  const location = appState.playerLocation;
  if (location && lastAccuracy && lastAccuracy > 0) {
    accuracySource.setData(circlePolygon(location.lat, location.lng, lastAccuracy));
  } else {
    accuracySource.setData(EMPTY_FEATURE);
  }
}

function createMapMarker(className, lng, lat, anchor = 'center') {
  const el = document.createElement('div');
  el.className = `map-marker ${className}`;
  return new mapboxgl.Marker({ element: el, anchor }).setLngLat([lng, lat]).addTo(map);
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

// Bearing from point A to point B in degrees clockwise from north.
function bearingDegrees(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function highlightCheckpointBuilding(checkpoint) {
  if (!mapReady || !checkpoint || checkpoint.id === lastHighlightedCheckpointId) return;

  const buildingSource = map.getSource('checkpoint-building');
  if (!buildingSource) return;

  const point = map.project([checkpoint.lng, checkpoint.lat]);
  const features = map.queryRenderedFeatures(point, { layers: ['buildings-lookup'] });
  if (!features.length) return;

  lastHighlightedCheckpointId = checkpoint.id;
  buildingSource.setData({ type: 'FeatureCollection', features: [features[0]] });
}

function clearWalkingRoute() {
  const routeSource = map.getSource('walking-route');
  if (routeSource) routeSource.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
  lastRouteFetchLocation = null;
  lastRouteFetchCheckpointId = null;
  lastRouteSummary = null;
}

async function updateWalkingRoute(checkpoint, playerLocation) {
  if (!mapReady || !checkpoint || !playerLocation || routeFetchInFlight) return;

  const movedFar = !lastRouteFetchLocation ||
    haversineMeters(lastRouteFetchLocation.lat, lastRouteFetchLocation.lng, playerLocation.lat, playerLocation.lng) > ROUTE_REFRESH_DISTANCE_METERS;
  const checkpointChanged = checkpoint.id !== lastRouteFetchCheckpointId;
  if (!movedFar && !checkpointChanged) return;

  routeFetchInFlight = true;
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${playerLocation.lng},${playerLocation.lat};${checkpoint.lng},${checkpoint.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();
    const route = data.routes && data.routes[0];
    const routeSource = map.getSource('walking-route');
    if (route && routeSource) {
      routeSource.setData({ type: 'Feature', geometry: route.geometry });
      lastRouteFetchLocation = playerLocation;
      lastRouteFetchCheckpointId = checkpoint.id;
      lastRouteSummary = { distance: route.distance, duration: route.duration };
      renderDistance();
    }
  } catch (error) {
    console.warn('Could not fetch walking route:', error);
  } finally {
    routeFetchInFlight = false;
  }
}

function setTargetLabel(name) {
  const label = targetMarker.getElement().querySelector('.marker-label');
  if (label) label.textContent = name;
}

function updateMapForCheckpoint(checkpoint) {
  targetMarker.setLngLat([checkpoint.lng, checkpoint.lat]);
  setTargetLabel(checkpoint.name);

  const geofenceSource = map.getSource('geofence');
  if (geofenceSource) geofenceSource.setData(geofenceCirclePolygon(checkpoint));

  if (checkpoint.id !== lastRenderedCheckpointId) {
    lastRenderedCheckpointId = checkpoint.id;
    lastHighlightedCheckpointId = null;
    clearWalkingRoute();
    map.flyTo({ center: [checkpoint.lng, checkpoint.lat], zoom: 17, duration: 1200 });
  }

  if (appState.playerLocation) {
    playerMarker.setLngLat([appState.playerLocation.lng, appState.playerLocation.lat]);
  }
  updatePlayerAccuracy();

  if (appState.phase === 'map' && appState.playerLocation) {
    updateWalkingRoute(checkpoint, appState.playerLocation);
  } else {
    clearWalkingRoute();
  }
}

function renderMap() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  if (!map) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    map = new mapboxgl.Map({
      container: 'map',
      style: MAPBOX_STYLE,
      center: [checkpoint.lng, checkpoint.lat],
      zoom: 17
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    window.__debugMap = map;

    map.on('load', () => {
      const loadCheckpoint = getCurrentCheckpoint();
      if (!loadCheckpoint) return;

      map.addSource('geofence', { type: 'geojson', data: geofenceCirclePolygon(loadCheckpoint) });
      map.addLayer({
        id: 'geofence-fill',
        type: 'fill',
        source: 'geofence',
        paint: { 'fill-color': '#39d98a', 'fill-opacity': 0.14 }
      });
      map.addLayer({
        id: 'geofence-line',
        type: 'line',
        source: 'geofence',
        paint: { 'line-color': '#39d98a', 'line-width': 2 }
      });

      map.addSource('mapbox-buildings-lookup', { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' });
      map.addLayer({
        id: 'buildings-lookup',
        type: 'fill',
        source: 'mapbox-buildings-lookup',
        'source-layer': 'building',
        paint: { 'fill-opacity': 0 }
      });

      map.addSource('checkpoint-building', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'checkpoint-building-fill',
        type: 'fill',
        source: 'checkpoint-building',
        paint: { 'fill-color': BUILDING_HIGHLIGHT_COLOR, 'fill-opacity': 0.45 }
      });
      map.addLayer({
        id: 'checkpoint-building-outline',
        type: 'line',
        source: 'checkpoint-building',
        paint: { 'line-color': BUILDING_HIGHLIGHT_COLOR, 'line-width': 2 }
      });

      map.addSource('player-accuracy', { type: 'geojson', data: EMPTY_FEATURE });
      map.addLayer({
        id: 'player-accuracy-fill',
        type: 'fill',
        source: 'player-accuracy',
        paint: { 'fill-color': '#4ec7ff', 'fill-opacity': 0.1 }
      });
      map.addLayer({
        id: 'player-accuracy-line',
        type: 'line',
        source: 'player-accuracy',
        paint: { 'line-color': '#4ec7ff', 'line-width': 1, 'line-opacity': 0.35 }
      });

      map.addSource('walking-route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });
      map.addLayer({
        id: 'walking-route-line',
        type: 'line',
        source: 'walking-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': WALKING_ROUTE_COLOR,
          'line-width': 4,
          'line-dasharray': [0.2, 1.5]
        }
      });

      map.on('idle', () => highlightCheckpointBuilding(getCurrentCheckpoint()));
      map.on('rotate', renderDistance);

      targetMarker = createMapMarker('marker-target', loadCheckpoint.lng, loadCheckpoint.lat, 'bottom');
      const targetPin = document.createElement('span');
      targetPin.className = 'marker-pin';
      targetMarker.getElement().appendChild(targetPin);
      const targetLabel = document.createElement('span');
      targetLabel.className = 'marker-label';
      targetLabel.textContent = loadCheckpoint.name;
      targetMarker.getElement().appendChild(targetLabel);

      playerMarker = createMapMarker('marker-player', loadCheckpoint.lng, loadCheckpoint.lat);
      lastRenderedCheckpointId = loadCheckpoint.id;

      mapReady = true;
      updateMapForCheckpoint(loadCheckpoint);
    });

    return;
  }

  if (mapReady) updateMapForCheckpoint(checkpoint);
}

function recenterMap() {
  if (!map || !mapReady) return;
  const checkpoint = getCurrentCheckpoint();
  const location = appState.playerLocation;

  if (checkpoint && location) {
    const bounds = new mapboxgl.LngLatBounds([location.lng, location.lat], [location.lng, location.lat]);
    bounds.extend([checkpoint.lng, checkpoint.lat]);
    map.fitBounds(bounds, { padding: { top: 110, bottom: 90, left: 60, right: 60 }, maxZoom: 17, duration: 800 });
  } else if (checkpoint) {
    map.flyTo({ center: [checkpoint.lng, checkpoint.lat], zoom: 17, duration: 800 });
  }
}

function renderStatusBadge() {
  const phaseLabels = {
    boot: 'Waiting for GPS',
    map: 'Tracking checkpoint',
    ar_ready: 'AR clue ready',
    complete: 'Hunt complete'
  };

  elements.statusBadge.textContent = phaseLabels[appState.phase] || 'Tracking';
  elements.statusPill.classList.toggle('loading', !appState.playerLocation);
}

function setLocationHelp(message) {
  if (!message) {
    elements.locationHelpBanner.classList.add('hidden');
    elements.locationHelpBanner.textContent = '';
    return;
  }

  elements.locationHelpBanner.textContent = message;
  elements.locationHelpBanner.classList.remove('hidden');
}

function updateDirectionArrow(straightLine, location, checkpoint) {
  const arrow = elements.dirArrow;
  if (!arrow) return;

  if (!location || !checkpoint || straightLine < 8) {
    arrow.classList.add('hidden');
    return;
  }

  arrow.classList.remove('hidden');
  const bearing = bearingDegrees(location.lat, location.lng, checkpoint.lat, checkpoint.lng);
  const mapBearing = map && mapReady ? map.getBearing() : 0;
  arrow.style.transform = `rotate(${bearing - mapBearing}deg)`;
}

function renderDistance() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) {
    elements.distanceText.textContent = 'Arrived — hunt complete';
    updateDirectionArrow(0, null, null);
    return;
  }

  const location = appState.playerLocation;
  if (!location) {
    elements.distanceText.textContent = 'Locating you…';
    updateDirectionArrow(0, null, null);
    return;
  }

  const straightLine = haversineMeters(location.lat, location.lng, checkpoint.lat, checkpoint.lng);

  if (lastRouteSummary && appState.phase === 'map') {
    elements.distanceText.textContent = `${formatDuration(lastRouteSummary.duration)} · ${formatDistance(lastRouteSummary.distance)} walk`;
  } else {
    elements.distanceText.textContent = formatDistance(straightLine);
  }

  updateDirectionArrow(straightLine, location, checkpoint);
}

function renderCheckpointInfo() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) {
    elements.checkpointTitle.textContent = 'Hunt complete';
    elements.checkpointHint.textContent = 'You solved every checkpoint in the Union Market route.';
    return;
  }

  elements.checkpointTitle.textContent = checkpoint.name;
  elements.checkpointHint.textContent = checkpoint.clue.text;
}

function renderProgressList() {
  const solvedCount = appState.checkpoints.filter((checkpoint) => checkpoint.solved).length;
  elements.progressCount.textContent = `${solvedCount} / ${appState.checkpoints.length}`;
  elements.progressList.innerHTML = appState.checkpoints
    .map((checkpoint) => {
      const completeClass = checkpoint.solved ? 'complete' : '';
      const label = checkpoint.solved ? 'Solved' : 'Locked';
      return `
        <li class="${completeClass}">
          <span>${checkpoint.name}</span>
          <span>${label}</span>
        </li>
      `;
    })
    .join('');
}

function renderButtons() {
  elements.startButton.classList.toggle('hidden', appState.phase !== 'boot');
  elements.startButton.disabled = appState.phase !== 'boot';
}

async function startArCamera() {
  if (arCameraStream || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  try {
    arCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    elements.arCameraVideo.srcObject = arCameraStream;
  } catch (error) {
    console.warn('Camera feed unavailable for AR overlay; showing model without camera passthrough.', error);
  }
}

function stopArCamera() {
  if (!arCameraStream) return;
  arCameraStream.getTracks().forEach((track) => track.stop());
  arCameraStream = null;
  elements.arCameraVideo.srcObject = null;
}

const AR_EMISSIVE_BOOST = 1.8;

// Force a mirror-chrome look (metalness 1, roughness 0) on every material, and loop the clip.
// Fires on each model-viewer 'load', i.e. every time a stop's model finishes loading.
function onModelLoaded() {
  const mv = elements.modelViewer;
  const model = mv && mv.model;
  if (model && model.materials) {
    model.materials.forEach((material) => {
      try {
        material.pbrMetallicRoughness.setMetallicFactor(1);
        material.pbrMetallicRoughness.setRoughnessFactor(0);
      } catch (error) {
        console.warn('Could not set metallic/roughness on a material:', error);
      }
    });
  }
  if (mv && typeof mv.play === 'function' && mv.availableAnimations && mv.availableAnimations.length) {
    mv.play({ repetitions: Infinity });
  }
}

function applyBloomForCheckpoint(checkpoint) {
  const bloom = elements.bloomEffect;
  if (!bloom || !checkpoint || !checkpoint.bloom) return;
  bloom.strength = checkpoint.bloom.strength;
  bloom.threshold = checkpoint.bloom.threshold;
  bloom.radius = checkpoint.bloom.radius;
}

// Bloom can't run inside an AR session, so boost emissive strength while presenting to compensate.
function setArEmissiveBoost(active) {
  const model = elements.modelViewer && elements.modelViewer.model;
  if (!model || !model.materials) return;
  model.materials.forEach((material) => {
    try {
      if (typeof material.setEmissiveStrength === 'function') {
        material.setEmissiveStrength(active ? AR_EMISSIVE_BOOST : 1);
      }
    } catch (error) {
      /* emissive strength unsupported on this material — ignore */
    }
  });
}

function prefetchNextModel() {
  const nextCheckpoint = appState.checkpoints[appState.currentCheckpointIndex + 1];
  if (!nextCheckpoint || prefetchedModelUrls.has(nextCheckpoint.clue.modelUrl)) return;

  prefetchedModelUrls.add(nextCheckpoint.clue.modelUrl);
  fetch(nextCheckpoint.clue.modelUrl).catch(() => {});
}

function renderAR() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint || appState.phase !== 'ar_ready') {
    stopArCamera();
    elements.arOverlay.classList.add('hidden');
    elements.arOverlay.classList.remove('finale');
    return;
  }

  const isFinal = Boolean(checkpoint.final);
  elements.arOverlay.classList.toggle('finale', isFinal);
  elements.arOverlay.classList.remove('hidden');

  // The finale is a wrap-up modal on a solid backdrop, not a live-camera reveal.
  if (isFinal) {
    stopArCamera();
  } else {
    startArCamera();
  }

  elements.arLabel.textContent = isFinal ? 'Final surprise' : 'AR Clue';
  elements.closeArButton.textContent = isFinal ? 'Finish' : 'Close & continue';

  if (elements.modelViewer.getAttribute('src') !== checkpoint.clue.modelUrl) {
    elements.modelViewer.setAttribute('src', checkpoint.clue.modelUrl);
  }
  applyBloomForCheckpoint(checkpoint);
  elements.clueTitle.textContent = checkpoint.clue.title;
  elements.clueText.textContent = checkpoint.clue.text;
  prefetchNextModel();
}

function renderVictoryState() {
  const total = appState.checkpoints.length;

  if (appState.phase === 'complete') {
    elements.victoryText.textContent = `You made it through all ${total} stops. The adventure continues — I love you.`;
    elements.victoryOverlay.classList.remove('hidden');
  } else {
    elements.victoryOverlay.classList.add('hidden');
  }
}

function render() {
  renderStatusBadge();
  renderCheckpointInfo();
  renderMap();
  renderDistance();
  if (appState.phase === 'boot' && !appState.playerLocation) {
    setLocationHelp('Safari may be blocking location. Open Settings → Safari → Websites → Location, then retry.');
  } else {
    setLocationHelp('');
  }
  renderProgressList();
  renderButtons();
  renderAR();
  renderVictoryState();
}

function persistProgress() {
  saveState();
}

function unlockCurrentCheckpoint() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  if (!checkpoint.solved) {
    checkpoint.solved = true;
    checkpoint.solvedAt = new Date().toISOString();
    appState.progress.push(checkpoint.id);
    persistProgress();
  }

  moveToNextCheckpoint();
}

function moveToNextCheckpoint() {
  if (appState.currentCheckpointIndex < appState.checkpoints.length - 1) {
    appState.currentCheckpointIndex += 1;
    appState.phase = 'map';
    persistProgress();
    render();
    return;
  }

  appState.phase = 'complete';
  persistProgress();
  render();
}

function resetProgress() {
  const nextState = createInitialState();
  Object.assign(appState, nextState);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  saveState();
  setPhase('boot');
  render();
}

function playArrivalMoment() {
  if (navigator.vibrate) navigator.vibrate(60);
  if (!targetMarker) return;
  const el = targetMarker.getElement();
  el.classList.remove('arrived');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('arrived');
  setTimeout(() => el.classList.remove('arrived'), 1000);
}

function triggerArrival() {
  inRadiusStreak = 0;
  elements.infoDrawer.classList.add('hidden');
  playArrivalMoment();
  setPhase('ar_ready');
}

function evaluatePosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  appState.playerLocation = { lat: latitude, lng: longitude };

  // Debug teleports have no accuracy; treat them as fully trusted so testing stays instant.
  const isDebugFix = accuracy == null;
  lastAccuracy = isDebugFix ? null : accuracy;

  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  const distance = haversineMeters(latitude, longitude, checkpoint.lat, checkpoint.lng);
  const withinRadius = distance <= checkpoint.radius;
  // Fire instantly when even the error margin sits inside the radius; otherwise require two
  // consecutive in-radius fixes so a single wild GPS blip can't false-trigger. This debounces
  // without ever blocking arrival, however poor the accuracy is.
  const confidentlyInside = isDebugFix || distance + accuracy <= checkpoint.radius;

  if (appState.phase === 'map' && withinRadius) {
    inRadiusStreak += 1;
    if (confidentlyInside || inRadiusStreak >= 2) {
      triggerArrival();
    }
  } else {
    inRadiusStreak = 0;
  }

  persistProgress();
  render();
}

function watchLocation() {
  if (!navigator.geolocation) {
    console.error('Geolocation is not supported by this browser.');
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    evaluatePosition,
    (error) => {
      console.error('Location permission error:', error);
      elements.checkpointHint.textContent = 'Location access is required to continue the hunt.';
      appState.phase = 'boot';
      render();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000
    }
  );
}

async function warmUpCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    cameraStream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    console.warn('Camera permission not granted up front; AR clue will still display without device camera passthrough.', error);
  }
}

function startHunt() {
  if (!navigator.geolocation) {
    elements.checkpointHint.textContent = 'This browser does not support geolocation.';
    return;
  }

  const requestLocation = () => {
    setPhase('map');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        evaluatePosition(position);
        watchLocation();
      },
      (error) => {
        console.error('Location request denied:', error);
        elements.checkpointHint.textContent = 'Location access is required to continue the Union Market hunt.';
        setLocationHelp('Location was blocked. Open Settings → Safari → Websites → Location and allow access, then tap Start Hunt again.');
        setPhase('boot');
      },
      {
        enableHighAccuracy: true,
        timeout: 20000
      }
    );
  };

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' })
      .then((permissionStatus) => {
        if (permissionStatus.state === 'denied') {
          elements.checkpointHint.textContent = 'Location access was previously denied. Please enable it in Safari settings, then tap Start Hunt again.';
          setLocationHelp('Location is denied in Safari. Open Settings → Safari → Websites → Location, allow access, then retry.');
          setPhase('boot');
          return;
        }
        requestLocation();
      })
      .catch(() => {
        requestLocation();
      });
    return;
  }

  requestLocation();
}

function resetProgress() {
  const nextState = createInitialState();
  Object.assign(appState, nextState);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  saveState();
  setPhase('boot');
  render();
}

function applyDebugLocation(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.warn('Debug location must be valid numbers.');
    return;
  }

  evaluatePosition({
    coords: {
      latitude,
      longitude
    }
  });
}

function completeDebugRoute() {
  appState.checkpoints = appState.checkpoints.map((checkpoint) => ({
    ...checkpoint,
    solved: true,
    solvedAt: checkpoint.solvedAt || new Date().toISOString()
  }));
  appState.phase = 'complete';
  appState.currentCheckpointIndex = appState.checkpoints.length - 1;
  persistProgress();
  render();
}

function jumpToCheckpoint(index) {
  const targetIndex = Number(index) - 1;
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= appState.checkpoints.length) {
    console.warn('Checkpoint index must be between 1 and', appState.checkpoints.length);
    return;
  }

  appState.currentCheckpointIndex = targetIndex;
  const checkpoint = getCurrentCheckpoint();
  if (checkpoint) {
    appState.playerLocation = { lat: checkpoint.lat, lng: checkpoint.lng };
  }
  appState.phase = 'map';
  persistProgress();
  render();
}

function playStop(input) {
  const match = String(input).match(/\d+/);
  const stopNumber = match ? Number(match[0]) : NaN;
  if (!Number.isInteger(stopNumber) || stopNumber < 1 || stopNumber > appState.checkpoints.length) {
    console.warn(`Enter a stop number between 1 and ${appState.checkpoints.length}, e.g. "stop 3".`);
    return;
  }

  clearTimeout(playStopTimer);

  appState.currentCheckpointIndex = stopNumber - 1;
  appState.phase = 'map';
  elements.arOverlay.classList.add('hidden');
  elements.victoryOverlay.classList.add('hidden');
  elements.infoDrawer.classList.add('hidden');
  persistProgress();

  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  // Step 1: stand ~120 m north of the stop so the fly-in, walking route, geofence,
  // and building highlight are all visible before arrival (approach is outside every radius).
  const approachLat = checkpoint.lat + STOP_PREVIEW_APPROACH_METERS / 110540;
  applyDebugLocation(approachLat, checkpoint.lng);

  // Step 2: arrive inside the geofence, which auto-opens this stop's AR clue.
  playStopTimer = setTimeout(() => {
    applyDebugLocation(checkpoint.lat, checkpoint.lng);
  }, STOP_PREVIEW_ARRIVAL_DELAY_MS);
}

function bindEvents() {
  if (DEBUG_MODE) {
    elements.debugPanel.classList.remove('hidden');
  }

  elements.beginAdventureButton.addEventListener('click', () => {
    elements.introOverlay.classList.add('hidden');
    warmUpCameraPermission();
    startHunt();
  });

  elements.startButton.addEventListener('click', startHunt);
  elements.recenterButton.addEventListener('click', recenterMap);

  elements.modelViewer.addEventListener('load', onModelLoaded);
  elements.modelViewer.addEventListener('ar-status', (event) => {
    const status = event.detail && event.detail.status;
    if (status === 'session-started') setArEmissiveBoost(true);
    else if (status === 'not-presenting') setArEmissiveBoost(false);
  });
  elements.statusPill.addEventListener('click', () => {
    elements.infoDrawer.classList.toggle('hidden');
  });
  elements.closeArButton.addEventListener('click', unlockCurrentCheckpoint);
  elements.playAgainButton.addEventListener('click', () => {
    resetProgress();
    elements.introOverlay.classList.remove('hidden');
  });
  elements.resetButton.addEventListener('click', resetProgress);

  elements.debugApplyButton.addEventListener('click', () => {
    const lat = elements.debugLat.value;
    const lng = elements.debugLng.value;
    if (!lat || !lng) {
      console.warn('Enter both latitude and longitude in the debug panel.');
      return;
    }
    applyDebugLocation(lat, lng);
  });

  const submitStop = () => playStop(elements.debugStopInput.value);
  elements.debugStopButton.addEventListener('click', submitStop);
  elements.debugStopInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitStop();
  });

  elements.debugTestReiButton.addEventListener('click', () => {
    const checkpoint = unionMarketCheckpoints[0];
    applyDebugLocation(checkpoint.lat, checkpoint.lng);
  });

  elements.debugNextButton.addEventListener('click', () => {
    if (!getCurrentCheckpoint()) return;
    if (!getCurrentCheckpoint().solved) {
      unlockCurrentCheckpoint();
      return;
    }
    moveToNextCheckpoint();
  });

  elements.debugJumpButton.addEventListener('click', () => {
    const requestedCheckpoint = elements.debugCheckpointInput.value;
    if (!requestedCheckpoint) {
      console.warn('Enter a checkpoint number to jump.');
      return;
    }
    jumpToCheckpoint(requestedCheckpoint);
  });

  elements.debugCompleteButton.addEventListener('click', completeDebugRoute);
}

function init() {
  bindEvents();
  render();
}

window.geoHuntDebug = {
  setLocation: applyDebugLocation,
  stop: playStop,
  jumpToCheckpoint,
  nextCheckpoint: () => {
    if (!getCurrentCheckpoint()) return;
    if (!getCurrentCheckpoint().solved) {
      unlockCurrentCheckpoint();
      return;
    }
    moveToNextCheckpoint();
  },
  completeRoute: completeDebugRoute,
  reset: resetProgress
};

init();
