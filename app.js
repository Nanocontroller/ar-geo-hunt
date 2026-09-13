const STORAGE_KEY = 'geo-hunt-state-v3';
const ROUTE_VERSION = 'union-market-6stop-v1';
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
let watchId = null;
let arCameraStream = null;
const prefetchedModelUrls = new Set();

const elements = {
  checkpointTitle: document.getElementById('checkpointTitle'),
  checkpointHint: document.getElementById('checkpointHint'),
  distanceText: document.getElementById('distanceText'),
  startButton: document.getElementById('startButton'),
  resetButton: document.getElementById('resetButton'),
  statusPill: document.getElementById('statusPill'),
  infoDrawer: document.getElementById('infoDrawer'),
  arOverlay: document.getElementById('arOverlay'),
  arCameraVideo: document.getElementById('arCameraVideo'),
  modelViewer: document.getElementById('modelViewer'),
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

function geofenceCirclePolygon(checkpoint, points = 64) {
  const coords = [];
  const distanceX = checkpoint.radius / (111320 * Math.cos((checkpoint.lat * Math.PI) / 180));
  const distanceY = checkpoint.radius / 110540;

  for (let i = 0; i <= points; i += 1) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([checkpoint.lng + distanceX * Math.cos(theta), checkpoint.lat + distanceY * Math.sin(theta)]);
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] }
  };
}

function createMapMarker(className, lng, lat) {
  const el = document.createElement('div');
  el.className = `map-marker ${className}`;
  return new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
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
    }
  } catch (error) {
    console.warn('Could not fetch walking route:', error);
  } finally {
    routeFetchInFlight = false;
  }
}

function updateMapForCheckpoint(checkpoint) {
  targetMarker.setLngLat([checkpoint.lng, checkpoint.lat]);

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

      targetMarker = createMapMarker('marker-target', loadCheckpoint.lng, loadCheckpoint.lat);
      playerMarker = createMapMarker('marker-player', loadCheckpoint.lng, loadCheckpoint.lat);
      lastRenderedCheckpointId = loadCheckpoint.id;

      mapReady = true;
      updateMapForCheckpoint(loadCheckpoint);
    });

    return;
  }

  if (mapReady) updateMapForCheckpoint(checkpoint);
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

function renderDistance() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) {
    elements.distanceText.textContent = 'Distance: complete';
    return;
  }

  const location = appState.playerLocation;
  if (!location) {
    elements.distanceText.textContent = 'Distance: waiting for GPS…';
    return;
  }

  const distance = haversineMeters(location.lat, location.lng, checkpoint.lat, checkpoint.lng);
  elements.distanceText.textContent = `Distance: ${distance.toFixed(0)} m`;
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
    return;
  }

  elements.arOverlay.classList.remove('hidden');
  startArCamera();
  elements.modelViewer.setAttribute('src', checkpoint.clue.modelUrl);
  elements.clueTitle.textContent = checkpoint.clue.title;
  elements.clueText.textContent = checkpoint.clue.text;
  prefetchNextModel();
}

function renderVictoryState() {
  const completed = appState.checkpoints.filter((checkpoint) => checkpoint.solved).length;
  const total = appState.checkpoints.length;

  if (appState.phase === 'complete') {
    elements.victoryText.textContent = `You solved ${completed} of ${total} checkpoints and completed the Union Market route.`;
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

function evaluatePosition(position) {
  const { latitude, longitude } = position.coords;
  appState.playerLocation = { lat: latitude, lng: longitude };

  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  const distance = haversineMeters(latitude, longitude, checkpoint.lat, checkpoint.lng);

  if (distance <= checkpoint.radius && appState.phase === 'map') {
    elements.infoDrawer.classList.add('hidden');
    setPhase('ar_ready');
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
