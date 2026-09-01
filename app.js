const STORAGE_KEY = 'geo-hunt-state-v3';
const ROUTE_VERSION = 'rei-50m-v1';
const ROUTE = window.unionMarketRoute || [];
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';

const unionMarketCheckpoints = ROUTE.length
  ? ROUTE.map((checkpoint) => ({ ...checkpoint, solved: false, solvedAt: null }))
  : [];

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

  targetMarker.setLatLng([checkpoint.lat, checkpoint.lng]);
  geofenceCircle.setLatLng([checkpoint.lat, checkpoint.lng]);
  geofenceCircle.setRadius(checkpoint.radius);

  if (appState.playerLocation) {
    playerMarker.setLatLng([appState.playerLocation.lat, appState.playerLocation.lng]);
    map.setView([appState.playerLocation.lat, appState.playerLocation.lng], map.getZoom());
  }
}

function renderStatusBadge() {
  const phaseLabels = {
    boot: 'Waiting for GPS',
    map: 'Tracking checkpoint',
    geofence_triggered: 'Checkpoint nearby',
    ar_permission: 'Requesting camera',
    ar_ready: 'AR active',
    clue_reveal: 'Clue revealed',
    complete: 'Hunt complete'
  };

  elements.statusBadge.textContent = phaseLabels[appState.phase] || 'Tracking';
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
  if (!getCurrentCheckpoint()) {
    elements.startButton.classList.add('hidden');
    elements.arButton.classList.add('hidden');
    elements.unlockButton.classList.add('hidden');
    return;
  }

  const isAtCheckpoint = isWithinRadius(appState.playerLocation, getCurrentCheckpoint());
  elements.startButton.classList.toggle('hidden', appState.phase !== 'boot');
  elements.startButton.disabled = appState.phase !== 'boot';
  elements.arButton.classList.toggle('hidden', !(appState.phase === 'geofence_triggered' || appState.phase === 'ar_ready'));
  elements.unlockButton.classList.toggle('hidden', !(appState.phase === 'ar_ready' || appState.phase === 'clue_reveal'));

  if (appState.phase === 'geofence_triggered') {
    elements.arButton.disabled = false;
    elements.arButton.textContent = 'View AR Clue';
  }

  if (appState.phase === 'ar_ready' || appState.phase === 'clue_reveal') {
    elements.arButton.textContent = 'AR Ready';
    elements.arButton.disabled = true;
    elements.unlockButton.disabled = false;
  }

  if (appState.phase === 'map' && !isAtCheckpoint) {
    elements.arButton.classList.add('hidden');
    elements.unlockButton.classList.add('hidden');
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

  if (distance <= checkpoint.radius && appState.phase !== 'ar_ready' && appState.phase !== 'clue_reveal') {
    setPhase('geofence_triggered');
    elements.checkpointHint.textContent = `You are within ${checkpoint.radius} m of ${checkpoint.name}. Tap “View AR Clue” to continue.`;
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

async function requestCameraPermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setPhase('map');
    elements.checkpointHint.textContent = 'Camera AR is not supported on this device. Continue with the map route for now.';
    return;
  }

  try {
    await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    setPhase('ar_ready');
  } catch (error) {
    console.warn('Camera permission denied:', error);
    setPhase('map');
    elements.checkpointHint.textContent = 'Camera access denied. You can continue using the route map and re-attempt later.';
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
    startHunt();
  });

  elements.startButton.addEventListener('click', startHunt);
  elements.arButton.addEventListener('click', () => {
    if (appState.phase === 'geofence_triggered') {
      setPhase('ar_permission');
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
