(() => {
  'use strict';

  // ========== CONSTANTS ==========

  const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route';
  const MAX_PUBS = 4;
  const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png';
  const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
  const OLC_PREFIX = '9C5M';
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  const LS_START_KEY = 'pub-crawler-start';
  const DEFAULT_START = { ...window.START_POINT };
  let START = loadStart();
  const PUBS = window.PUB_DATA;

  function loadStart() {
    try {
      const saved = localStorage.getItem(LS_START_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) { /* ignore */ }
    return { ...window.START_POINT };
  }

  function saveStart(point) {
    localStorage.setItem(LS_START_KEY, JSON.stringify(point));
  }

  // Decode Plus Code short codes (Dublin area) to lat/lng
  function decodePlusCode(shortCode) {
    const full = (OLC_PREFIX + shortCode).replace('+', '');
    const res = [20, 1, 0.05, 0.0025, 0.000125];
    let lat = -90, lng = -180, cell = 0;
    for (let i = 0; i < res.length; i++) {
      lat += OLC_ALPHABET.indexOf(full[i * 2]) * res[i];
      lng += OLC_ALPHABET.indexOf(full[i * 2 + 1]) * res[i];
      cell = res[i];
    }
    return { lat: lat + cell / 2, lng: lng + cell / 2 };
  }

  PUBS.forEach((pub) => {
    if (pub.pluscode) {
      const { lat, lng } = decodePlusCode(pub.pluscode);
      pub.lat = lat;
      pub.lng = lng;
    }
  });

  // ========== STATE ==========

  const state = {
    mode: 'manual',
    selectedPubs: [],
    finalPub: null,
    intermediates: [],
    routeLayer: null,
    stepMarkers: [],
    pubMarkerMap: new Map(),
    startMarker: null,
    map: null,
    calculating: false,
    lastRoute: null,
    lastOrderedPubs: null,
    shufflesRemaining: 2,
  };

  // ========== HELPERS ==========

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  function formatDistance(meters) {
    return meters >= 1000
      ? (meters / 1000).toFixed(1) + ' km'
      : Math.round(meters) + ' m';
  }

  function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return mins + ' min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h + ' hr ' + (m ? m + ' min' : '');
  }

  function buildGoogleMapsUrl(orderedPubs) {
    const enc = (s) => encodeURIComponent(s);
    const pubLocation = (p) => `${p.name}, ${p.address}`;
    const origin = enc(`${START.name}, Dublin`);
    const destination = enc(pubLocation(orderedPubs[orderedPubs.length - 1]));
    const waypoints = orderedPubs.slice(0, -1)
      .map((p) => enc(pubLocation(p)))
      .join('|');
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    return url;
  }

  // ========== MAP SETUP ==========

  function initMap() {
    const map = L.map('map', { zoomControl: true }).setView([53.345, -6.262], 15);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    return map;
  }

  function createStartMarker(map) {
    if (state.startMarker) {
      map.removeLayer(state.startMarker);
    }
    const icon = L.divIcon({
      className: '',
      html: '<div class="marker-start">S</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    state.startMarker = L.marker([START.lat, START.lng], { icon, interactive: false, zIndexOffset: 500 })
      .addTo(map);
  }

  function createPubMarkers(map) {
    PUBS.forEach((pub) => {
      const icon = L.divIcon({
        className: '',
        html: `<div class="marker-pub" data-id="${pub.id}"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([pub.lat, pub.lng], { icon, zIndexOffset: 100 })
        .bindTooltip(
          `<div class="pub-popup__name">${pub.name}</div>` +
          `<div class="pub-popup__address">${pub.address}</div>`,
          { direction: 'top', offset: [0, -8] }
        )
        .addTo(map);

      marker.on('click', () => onPubClick(pub));
      state.pubMarkerMap.set(pub.id, marker);
    });
  }

  // ========== MARKER STYLES ==========

  function updateMarkerStyles() {
    const selectedIds = new Set(state.selectedPubs.map((p) => p.id));
    const finalId = state.finalPub ? state.finalPub.id : null;
    const randomIds = new Set(state.intermediates.map((p) => p.id));
    const atLimit = state.mode === 'manual' && state.selectedPubs.length >= MAX_PUBS;

    state.pubMarkerMap.forEach((marker, id) => {
      const el = marker.getElement();
      if (!el) return;
      const dot = el.querySelector('.marker-pub');
      if (!dot) return;

      dot.classList.remove('marker-pub--selected', 'marker-pub--final', 'marker-pub--dimmed', 'marker-pub--random');

      if (state.mode === 'manual') {
        if (selectedIds.has(id)) {
          dot.classList.add('marker-pub--selected');
        } else if (atLimit || state.routeLayer) {
          dot.classList.add('marker-pub--dimmed');
        }
      } else {
        if (id === finalId) {
          dot.classList.add('marker-pub--final');
        } else if (randomIds.has(id)) {
          dot.classList.add('marker-pub--random');
        } else if (state.routeLayer) {
          dot.classList.add('marker-pub--dimmed');
        }
      }
    });
  }

  // ========== SELECTION ==========

  function onPubClick(pub) {
    if (state.calculating) return;
    clearRoute();

    if (state.mode === 'manual') {
      togglePubSelection(pub);
    } else {
      setFinalPub(pub);
    }
  }

  function togglePubSelection(pub) {
    const idx = state.selectedPubs.findIndex((p) => p.id === pub.id);
    if (idx >= 0) {
      state.selectedPubs.splice(idx, 1);
    } else if (state.selectedPubs.length < MAX_PUBS) {
      state.selectedPubs.push(pub);
    }
    updateMarkerStyles();
    updateButtonStates();
    renderPickList();
  }

  function setFinalPub(pub) {
    state.finalPub = (state.finalPub && state.finalPub.id === pub.id) ? null : pub;
    state.intermediates = [];
    state.shufflesRemaining = 2;
    state.lastRoute = null;
    state.lastOrderedPubs = null;
    updateMarkerStyles();
    updateButtonStates();
  }

  // ========== LUCKY DIP: PICK INTERMEDIATE PUBS ==========

  // Score pubs by how much detour they add to the start→finish walk.
  // detour = dist(start→pub) + dist(pub→final) - dist(start→final)
  // Lower detour = more "on the way". We also enforce a minimum
  // distance from start so the crawl doesn't begin at the office door.
  function pickRandomIntermediatePubs(finalPub) {
    const totalDist = haversine(START.lat, START.lng, finalPub.lat, finalPub.lng);
    if (totalDist === 0) return [];

    const scored = PUBS
      .filter((p) => p.id !== finalPub.id)
      .map((p) => {
        const toStart = haversine(START.lat, START.lng, p.lat, p.lng);
        const toFinal = haversine(p.lat, p.lng, finalPub.lat, finalPub.lng);
        const detour = toStart + toFinal - totalDist;
        return { pub: p, detour, toStart };
      });

    // Primary filter: reasonable detour and not right next to the office
    const minFromStart = totalDist * 0.15;
    const maxDetour = totalDist * 0.6;
    let pool = scored.filter((c) => c.detour < maxDetour && c.toStart > minFromStart);

    // Fallback: relax the minimum-distance-from-start requirement
    if (pool.length < 3) {
      pool = scored.filter((c) => c.detour < maxDetour);
    }

    // Last resort: any pub, sorted by detour
    if (pool.length < 3) {
      pool = scored.sort((a, b) => a.detour - b.detour);
    }

    // Pick 3 at random from the pool
    const picked = [];
    const available = [...pool];
    for (let i = 0; i < 3 && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      picked.push(available[idx].pub);
      available.splice(idx, 1);
    }

    return picked;
  }

  function pickOneRandomPub(excludeIds, oldPub) {
    const finalPub = state.finalPub;
    const totalDist = haversine(START.lat, START.lng, finalPub.lat, finalPub.lng);

    const scored = PUBS
      .filter((p) => !excludeIds.has(p.id))
      .map((p) => {
        const toStart = haversine(START.lat, START.lng, p.lat, p.lng);
        const toFinal = haversine(p.lat, p.lng, finalPub.lat, finalPub.lng);
        const detour = toStart + toFinal - totalDist;
        const fromOld = haversine(oldPub.lat, oldPub.lng, p.lat, p.lng);
        return { pub: p, detour, toStart, fromOld };
      });

    // Similar detour budget + close to the pub being replaced
    const maxDetour = totalDist * 0.6;
    const maxFromOld = totalDist * 0.5;
    let pool = scored.filter((c) => c.detour < maxDetour && c.fromOld < maxFromOld);

    // Relax: just detour budget
    if (pool.length === 0) {
      pool = scored.filter((c) => c.detour < maxDetour);
    }

    // Last resort: any pub
    if (pool.length === 0) {
      pool = scored;
    }

    return pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)].pub
      : null;
  }

  async function shufflePub(index) {
    if (state.shufflesRemaining <= 0 || state.calculating) return;

    const currentPubs = state.lastOrderedPubs;
    const excludeIds = new Set(currentPubs.map((p) => p.id));
    const oldPub = currentPubs[index];

    const replacement = pickOneRandomPub(excludeIds, oldPub);
    if (!replacement) {
      showToast('No more pubs available to shuffle in.');
      return;
    }

    const newPubs = [...currentPubs];
    newPubs[index] = replacement;

    state.intermediates = newPubs.filter((p) => p.id !== state.finalPub.id);
    state.shufflesRemaining--;

    clearRoute();
    setCalculating(true);

    try {
      const route = await fetchRoute(newPubs);
      state.lastOrderedPubs = newPubs;
      state.lastRoute = route;
      drawRoute(route, newPubs);
      renderRouteInfo(route, newPubs);
      updateMarkerStyles();
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
    } finally {
      setCalculating(false);
    }
  }

  // ========== ROUTE OPTIMISATION ==========

  function findOptimalOrder(pubs, fixedLast) {
    if (pubs.length <= 1) return pubs.slice();

    let toPermute, suffix;
    if (fixedLast) {
      toPermute = pubs.slice(0, -1);
      suffix = [pubs[pubs.length - 1]];
    } else {
      toPermute = pubs.slice();
      suffix = [];
    }

    if (toPermute.length === 0) return suffix;

    const perms = permutations(toPermute);
    let bestOrder = null;
    let bestDist = Infinity;

    for (const perm of perms) {
      const order = [...perm, ...suffix];
      let dist = haversine(START.lat, START.lng, order[0].lat, order[0].lng);
      for (let i = 1; i < order.length; i++) {
        dist += haversine(order[i - 1].lat, order[i - 1].lng, order[i].lat, order[i].lng);
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestOrder = order;
      }
    }

    return bestOrder;
  }

  // ========== POLYLINE DECODER ==========

  // Valhalla uses encoded polyline with precision 6
  function decodePolyline(encoded, precision) {
    const factor = Math.pow(10, precision || 6);
    const coords = [];
    let lat = 0;
    let lng = 0;
    let i = 0;

    while (i < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);

      coords.push([lat / factor, lng / factor]);
    }
    return coords;
  }

  // ========== VALHALLA FETCH ==========

  async function fetchRoute(orderedPubs) {
    const locations = [
      { lat: START.lat, lon: START.lng },
      ...orderedPubs.map((p) => ({ lat: p.lat, lon: p.lng })),
    ];

    const body = JSON.stringify({
      locations,
      costing: 'pedestrian',
      units: 'kilometers',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(VALHALLA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const trip = data.trip;

      // Normalize to a common format used by drawRoute / renderRouteInfo
      const allCoords = [];
      const legs = trip.legs.map((leg) => {
        const coords = decodePolyline(leg.shape);
        allCoords.push(...coords);
        return {
          distance: leg.summary.length * 1000, // km -> m
          duration: leg.summary.time,           // already in seconds
        };
      });

      return {
        distance: trip.summary.length * 1000,
        duration: trip.summary.time,
        legs,
        coords: allCoords,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Routing request timed out. Please try again.');
      }
      throw err;
    }
  }

  // ========== DRAW ROUTE ==========

  function drawRoute(route, orderedPubs) {
    // Draw polyline from decoded coordinates [lat, lng]
    state.routeLayer = L.polyline(route.coords, {
      color: '#3498db',
      weight: 5,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(state.map);

    // Add numbered step markers (start marker is already on the map)
    const points = orderedPubs.map((p, i) => ({ lat: p.lat, lng: p.lng, label: String(i + 1) }));

    points.forEach((pt, i) => {
      const isFinish = i === points.length - 1;
      const icon = isFinish
        ? L.divIcon({
            className: '',
            html: '<div class="marker-finish"></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          })
        : L.divIcon({
            className: '',
            html: `<div class="marker-step">${pt.label}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
      const m = L.marker([pt.lat, pt.lng], { icon, interactive: false, zIndexOffset: isFinish ? 700 : 600 })
        .addTo(state.map);
      state.stepMarkers.push(m);
    });

    // Fit bounds
    state.map.fitBounds(state.routeLayer.getBounds().pad(0.1));
    updateMarkerStyles();
  }

  function clearRoute() {
    if (state.routeLayer) {
      state.map.removeLayer(state.routeLayer);
      state.routeLayer = null;
    }
    state.stepMarkers.forEach((m) => state.map.removeLayer(m));
    state.stepMarkers = [];

    document.getElementById('route-info').hidden = true;

    const shuffleInfo = document.getElementById('shuffle-info');
    if (shuffleInfo) shuffleInfo.remove();
    updateMarkerStyles();
  }

  // ========== PICK LIST (Manual Mode) ==========

  function renderPickList(route) {
    const section = document.getElementById('pick-list-section');
    const list = document.getElementById('pick-list');
    const summary = document.getElementById('pick-summary');

    if (state.mode !== 'manual' || state.selectedPubs.length === 0) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    list.innerHTML = '';

    state.selectedPubs.forEach((pub, i) => {
      const li = document.createElement('li');
      const isFirst = i === 0;
      const isLast = i === state.selectedPubs.length - 1;

      let meta = '';
      if (route && route.legs[i]) {
        meta = `<div class="pick-list__meta">${formatDistance(route.legs[i].distance)} &middot; ${formatDuration(route.legs[i].duration)} walk</div>`;
      }

      li.innerHTML =
        `<div class="pick-list__number">${i + 1}</div>` +
        `<div class="pick-list__info">` +
          `<div class="pick-list__name">${pub.name}</div>` +
          meta +
        `</div>` +
        `<div class="pick-list__actions">` +
          `<button class="pick-list__move" data-dir="up" ${isFirst ? 'disabled' : ''} aria-label="Move up">&#9650;</button>` +
          `<button class="pick-list__move" data-dir="down" ${isLast ? 'disabled' : ''} aria-label="Move down">&#9660;</button>` +
          `<button class="pick-list__remove" aria-label="Remove">&times;</button>` +
        `</div>`;

      li.querySelectorAll('.pick-list__move').forEach((btn) => {
        btn.addEventListener('click', () => movePub(i, btn.dataset.dir));
      });
      li.querySelector('.pick-list__remove').addEventListener('click', () => removePub(pub.id));

      list.appendChild(li);
    });

    const oldMapsLink = section.querySelector('.gmaps-link');
    if (oldMapsLink) oldMapsLink.remove();

    if (route) {
      document.getElementById('pick-total-distance').textContent = formatDistance(route.distance);
      document.getElementById('pick-total-time').textContent = formatDuration(route.duration);
      summary.hidden = false;

      const link = document.createElement('a');
      link.className = 'btn btn--gmaps gmaps-link';
      link.href = buildGoogleMapsUrl(state.selectedPubs);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open in Google Maps';
      section.appendChild(link);
    } else {
      summary.hidden = true;
    }
  }

  function movePub(index, direction) {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= state.selectedPubs.length) return;

    const [pub] = state.selectedPubs.splice(index, 1);
    state.selectedPubs.splice(newIndex, 0, pub);

    if (state.routeLayer) {
      recalculateManualRoute();
    } else {
      renderPickList();
    }
  }

  function removePub(pubId) {
    state.selectedPubs = state.selectedPubs.filter((p) => p.id !== pubId);
    clearRoute();
    renderPickList();
    updateMarkerStyles();
    updateButtonStates();
  }

  async function recalculateManualRoute() {
    clearRoute();
    setCalculating(true);

    try {
      const route = await fetchRoute(state.selectedPubs);
      drawRoute(route, state.selectedPubs);
      renderPickList(route);
    } catch (err) {
      showToast(err.message || 'Something went wrong.');
      renderPickList();
    } finally {
      setCalculating(false);
    }
  }

  // ========== UI ==========

  function renderRouteInfo(route, orderedPubs) {
    const list = document.getElementById('route-list');
    list.innerHTML = '';

    // Remove old shuffle info if present
    const oldShuffleInfo = document.getElementById('shuffle-info');
    if (oldShuffleInfo) oldShuffleInfo.remove();

    orderedPubs.forEach((pub, i) => {
      const leg = route.legs[i];
      const li = document.createElement('li');
      const isFinal = state.mode === 'final' && pub.id === state.finalPub.id;
      const canShuffle = state.mode === 'final' && !isFinal && state.shufflesRemaining > 0;

      li.innerHTML =
        `<div>` +
          `<div class="route-list__name">${pub.name}</div>` +
          `<div class="route-list__meta">${formatDistance(leg.distance)} &middot; ${formatDuration(leg.duration)} walk</div>` +
        `</div>` +
        (canShuffle ? `<button class="shuffle-btn" aria-label="Shuffle ${pub.name}">&#x21BB;</button>` : '');

      if (canShuffle) {
        li.querySelector('.shuffle-btn').addEventListener('click', () => shufflePub(i));
      }

      list.appendChild(li);
    });

    // Show shuffle info for Lucky Dip
    if (state.mode === 'final') {
      const info = document.createElement('div');
      info.id = 'shuffle-info';
      info.className = 'shuffle-info';
      info.textContent = state.shufflesRemaining > 0
        ? `${state.shufflesRemaining} shuffle${state.shufflesRemaining !== 1 ? 's' : ''} remaining`
        : 'No shuffles remaining';
      list.after(info);
    }

    document.getElementById('total-distance').textContent = formatDistance(route.distance);
    document.getElementById('total-time').textContent = formatDuration(route.duration);
    document.getElementById('route-info').hidden = false;

    const routeInfo = document.getElementById('route-info');
    const oldMapsLink = routeInfo.querySelector('.gmaps-link');
    if (oldMapsLink) oldMapsLink.remove();

    const link = document.createElement('a');
    link.className = 'btn btn--gmaps gmaps-link';
    link.href = buildGoogleMapsUrl(orderedPubs);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open in Google Maps';
    routeInfo.appendChild(link);
  }

  function updateButtonStates() {
    const btn = document.getElementById('btn-route');
    if (state.mode === 'manual') {
      btn.disabled = state.selectedPubs.length === 0 || state.calculating;
    } else {
      btn.disabled = !state.finalPub || state.calculating;
    }
  }

  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    toast.addEventListener('animationend', () => toast.remove());
  }

  function setCalculating(active) {
    state.calculating = active;
    const btn = document.getElementById('btn-route');
    btn.textContent = active ? 'Calculating\u2026' : 'Calculate Route';
    updateButtonStates();
  }

  // ========== CALCULATE ROUTE ==========

  async function calculateRoute() {
    if (state.calculating) return;
    clearRoute();
    setCalculating(true);

    try {
      let pubs;

      if (state.mode === 'manual') {
        pubs = findOptimalOrder(state.selectedPubs, false);
        state.selectedPubs = pubs;
      } else {
        const intermediates = pickRandomIntermediatePubs(state.finalPub);
        state.intermediates = intermediates;
        const allPubs = [...intermediates, state.finalPub];
        pubs = findOptimalOrder(allPubs, true);
        state.intermediates = pubs.slice(0, -1);
        updateMarkerStyles();
      }

      const route = await fetchRoute(pubs);
      drawRoute(route, pubs);

      if (state.mode === 'manual') {
        renderPickList(route);
      } else {
        state.lastRoute = route;
        state.lastOrderedPubs = pubs;
        renderRouteInfo(route, pubs);
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong. Please try again.');
    } finally {
      setCalculating(false);
    }
  }

  // ========== MODE SWITCHING ==========

  function switchMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    clearAll();

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    document.getElementById('instructions-manual').hidden = mode !== 'manual';
    document.getElementById('instructions-final').hidden = mode !== 'final';
    document.getElementById('pick-list-section').hidden = true;
  }

  function clearAll() {
    state.selectedPubs = [];
    state.finalPub = null;
    state.intermediates = [];
    state.lastRoute = null;
    state.lastOrderedPubs = null;
    state.shufflesRemaining = 2;
    clearRoute();
    renderPickList();
    updateMarkerStyles();
    updateButtonStates();
  }

  // ========== START POINT ==========

  async function geocode(query) {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'ie',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`);
    const data = await res.json();
    if (!data.length) return null;
    return {
      name: query,
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  }

  function updateStartPoint(point) {
    START.name = point.name;
    START.lat = point.lat;
    START.lng = point.lng;
    saveStart(point);
    clearAll();
    createStartMarker(state.map);
    state.map.panTo([START.lat, START.lng]);
    updateStartUI();
  }

  function resetStartPoint() {
    localStorage.removeItem(LS_START_KEY);
    START.name = DEFAULT_START.name;
    START.lat = DEFAULT_START.lat;
    START.lng = DEFAULT_START.lng;
    clearAll();
    createStartMarker(state.map);
    state.map.panTo([START.lat, START.lng]);
    updateStartUI();
  }

  function updateStartUI() {
    const input = document.getElementById('start-input');
    const resetBtn = document.getElementById('start-reset');
    input.value = START.name;
    const isCustom = START.name !== DEFAULT_START.name;
    resetBtn.hidden = !isCustom;
  }

  function initStartPoint() {
    const input = document.getElementById('start-input');
    const resetBtn = document.getElementById('start-reset');

    updateStartUI();

    async function handleSubmit() {
      const query = input.value.trim();
      if (!query || query === START.name) return;

      input.disabled = true;
      try {
        const result = await geocode(query);
        if (result) {
          updateStartPoint(result);
        } else {
          showToast('Could not find that location.');
          input.value = START.name;
        }
      } catch (_) {
        showToast('Geocoding failed. Please try again.');
        input.value = START.name;
      } finally {
        input.disabled = false;
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });

    input.addEventListener('blur', handleSubmit);

    resetBtn.addEventListener('click', () => {
      resetStartPoint();
      input.focus();
    });
  }

  // ========== INIT ==========

  function init() {
    state.map = initMap();
    createStartMarker(state.map);
    createPubMarkers(state.map);
    initStartPoint();

    // Mode toggle
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });

    // Buttons
    document.getElementById('btn-route').addEventListener('click', calculateRoute);
    document.getElementById('btn-clear').addEventListener('click', clearAll);

    // Sidebar toggle (mobile)
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });
  }

  init();
})();
