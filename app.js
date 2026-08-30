const STORAGE_KEY = 'geo-hunt-state-v1';
const GEO_FENCE_RADIUS = 18;

const defaultCheckpoints = [
  {
    id: 'cp-1',
    name: 'Fountain Gate',
    lat: 40.7128,
    lng: -74.006,
    radius: 18,
    clue: {
      title: 'First clue',
      text: 'The hidden note is near the fountain. Look for the glowing symbol on the stone edge.',
      modelUrl: 'https://modelviewer.dev/shared-assets/models/ShopifyModels/Chair.glb'
    },
    solved: false,
    solvedAt: null
  },
  {
    id: 'cp-2',
    name: 'Old Steps',
    lat: 40.7132,
    lng: -74.0055,
    radius: 20,
    clue: {
      title: 'Second clue',
      text: 'The next symbol is under the arch and waiting for your camera to reveal it.',
      modelUrl: 'https://modelviewer.dev/shared-assets/models/ShopifyModels/RobotExpressive.glb'
    },
    solved: false,
    solvedAt: null
  },
  {
    id: 'cp-3',
    name: 'Cocoa Courtyard',
    lat: 40.7123,
    lng: -74.0048,
    radius: 16,
    clue: {
      title: 'Final clue',
      text: 'The hidden vault has opened. Scan the final marker and claim your prize.',
      modelUrl: 'https://modelviewer.dev/shared-assets/models/ShopifyModels/Avocado.glb'
    },
    solved: false,
    solvedAt: null
  }
];

const appState = loadState();
let map;
let playerMarker;
let targetMarker;
let geofenceCircle;
let watchId = null;

const elements = {
  checkpointTitle: document.getElementById('checkpointTitle'),
  checkpointHint: document.getElementById('checkpointHint'),
  distanceText: document.getElementById('distanceText'),
  startButton: document.getElementById('startButton'),
  arButton: document.getElementById('arButton'),
  unlockButton: document.getElementById('unlockButton'),
  resetButton: document.getElementById('resetButton'),
  arOverlay: document.getElementById('arOverlay'),
  modelViewer: document.getElementById('modelViewer'),
  clueTitle: document.getElementById('clueTitle'),
  clueText: document.getElementById('clueText'),
  closeArButton: document.getElementById('closeArButton')
};

function createInitialState() {
  return {
    currentCheckpointIndex: 0,
    phase: 'boot',
    playerLocation: null,
    progress: [],
    checkpoints: defaultCheckpoints.map((checkpoint) => ({ ...checkpoint }))
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createInitialState();

  try {
    const parsed = JSON.parse(saved);
    return parsed && parsed.checkpoints ? parsed : createInitialState();
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
  const distance = haversineMeters(
    location.lat,
    location.lng,
    checkpoint.lat,
    checkpoint.lng
  );
  return distance <= checkpoint.radius;
}

function setPhase(nextPhase) {
  appState.phase = nextPhase;
  render();
}

function renderMap() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([checkpoint.lat, checkpoint.lng], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    targetMarker = L.circleMarker([checkpoint.lat, checkpoint.lng], {
      radius: 9,
      color: '#f7b955',
      fillColor: '#f7b955',
      fillOpacity: 0.9,
      className: 'marker-target'
    }).addTo(map);

    geofenceCircle = L.circle([checkpoint.lat, checkpoint.lng], {
      radius: checkpoint.radius,
      color: '#39d98a',
      fillColor: '#39d98a',
      fillOpacity: 0.14
    }).addTo(map);

    playerMarker = L.circleMarker([0, 0], {
      radius: 8,
      color: '#4ec7ff',
      fillColor: '#4ec7ff',
      fillOpacity: 0.9,
      className: 'marker-player'
    }).addTo(map);
  }

  if (targetMarker && geofenceCircle) {
    targetMarker.setLatLng([checkpoint.lat, checkpoint.lng]);
    geofenceCircle.setLatLng([checkpoint.lat, checkpoint.lng]);
    geofenceCircle.setRadius(checkpoint.radius);
  }

  if (appState.playerLocation) {
    playerMarker.setLatLng([appState.playerLocation.lat, appState.playerLocation.lng]);
    map.setView([appState.playerLocation.lat, appState.playerLocation.lng], map.getZoom());
  }
}

function renderDistance() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) {
    elements.distanceText.textContent = 'Distance: --';
    return;
  }

  const location = appState.playerLocation;
  if (!location) {
    elements.distanceText.textContent = 'Distance: waiting for GPS…';
    return;
  }

  const distance = haversineMeters(
    location.lat,
    location.lng,
    checkpoint.lat,
    checkpoint.lng
  );

  elements.distanceText.textContent = `Distance: ${distance.toFixed(0)} m`;
}

function renderCheckpointInfo() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) {
    elements.checkpointTitle.textContent = 'Hunt complete';
    elements.checkpointHint.textContent = 'You have solved every checkpoint.';
    return;
  }

  elements.checkpointTitle.textContent = `${checkpoint.name}`;
  elements.checkpointHint.textContent = checkpoint.clue.text;
}

function renderButtons() {
  const checkpoint = getCurrentCheckpoint();
  const isAtCheckpoint = checkpoint && isWithinRadius(appState.playerLocation, checkpoint);

  elements.startButton.classList.toggle('hidden', appState.phase !== 'boot');
  elements.arButton.classList.toggle('hidden', !(appState.phase === 'geofence_triggered' || appState.phase === 'ar_ready'));
  elements.unlockButton.classList.toggle('hidden', !(appState.phase === 'ar_ready' || appState.phase === 'clue_reveal'));

  if (appState.phase === 'boot') {
    elements.startButton.textContent = 'Start Hunt';
  }

  if (appState.phase === 'geofence_triggered') {
    elements.arButton.disabled = false;
    elements.arButton.textContent = 'View AR Clue';
  }

  if (appState.phase === 'ar_ready' || appState.phase === 'clue_reveal') {
    elements.arButton.textContent = 'AR Ready';
    elements.arButton.disabled = true;
    elements.unlockButton.disabled = false;
  }

  if (!checkpoint) {
    elements.startButton.classList.add('hidden');
    elements.arButton.classList.add('hidden');
    elements.unlockButton.classList.add('hidden');
  }

  if (appState.phase === 'map' && !isAtCheckpoint) {
    elements.arButton.classList.add('hidden');
  }
}

function renderAR() {
  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) {
    elements.arOverlay.classList.add('hidden');
    return;
  }

  if (appState.phase === 'ar_ready' || appState.phase === 'clue_reveal') {
    elements.arOverlay.classList.remove('hidden');
    elements.modelViewer.setAttribute('src', checkpoint.clue.modelUrl);
    elements.modelViewer.setAttribute('ios-src', checkpoint.clue.modelUrl);
    elements.clueTitle.textContent = checkpoint.clue.title;
    elements.clueText.textContent = checkpoint.clue.text;
  } else {
    elements.arOverlay.classList.add('hidden');
  }
}

function render() {
  renderCheckpointInfo();
  renderMap();
  renderDistance();
  renderButtons();
  renderAR();
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
  elements.checkpointTitle.textContent = 'Hunt complete';
  elements.checkpointHint.textContent = 'You solved every checkpoint.';
  elements.distanceText.textContent = 'Distance: complete';
  elements.startButton.classList.add('hidden');
  elements.arButton.classList.add('hidden');
  elements.unlockButton.classList.add('hidden');
}

function evaluatePosition(position) {
  const { latitude, longitude } = position.coords;
  appState.playerLocation = {
    lat: latitude,
    lng: longitude
  };

  const checkpoint = getCurrentCheckpoint();
  if (!checkpoint) return;

  const distance = haversineMeters(
    latitude,
    longitude,
    checkpoint.lat,
    checkpoint.lng
  );

  if (distance <= checkpoint.radius && appState.phase !== 'ar_ready' && appState.phase !== 'clue_reveal') {
    setPhase('geofence_triggered');
  } else if (distance > checkpoint.radius && appState.phase === 'geofence_triggered') {
    setPhase('map');
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

async function requestCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setPhase('map');
    elements.checkpointHint.textContent = 'Camera AR is not supported on this device. Use the map and marker fallback.';
    return;
  }

  try {
    await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    setPhase('ar_ready');
  } catch (error) {
    console.warn('Camera permission denied:', error);
    setPhase('map');
    elements.checkpointHint.textContent = 'Camera access denied. Try the printed marker fallback or continue exploring the map.';
  }
}

function startHunt() {
  if (!navigator.geolocation) {
    elements.checkpointHint.textContent = 'This browser does not support geolocation.';
    return;
  }

  setPhase('map');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      appState.playerLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      watchLocation();
      persistProgress();
      render();
    },
    (error) => {
      console.error('Location request denied:', error);
      elements.checkpointHint.textContent = 'Location access is required to continue the hunt.';
      setPhase('boot');
    },
    {
      enableHighAccuracy: true,
      timeout: 20000
    }
  );
}

function resetProgress() {
  const nextState = createInitialState();
  Object.assign(appState, nextState);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  saveState();
  setPhase('boot');
  render();
}

function bindEvents() {
  elements.startButton.addEventListener('click', startHunt);
  elements.arButton.addEventListener('click', () => {
    if (appState.phase === 'geofence_triggered') {
      setPhase('ar_ready');
      requestCameraPermission();
    }
  });
  elements.unlockButton.addEventListener('click', () => {
    setPhase('clue_reveal');
    unlockCurrentCheckpoint();
  });
  elements.closeArButton.addEventListener('click', () => {
    elements.arOverlay.classList.add('hidden');
    setPhase('map');
  });
  elements.resetButton.addEventListener('click', resetProgress);
}

function init() {
  bindEvents();
  render();
}

init();
