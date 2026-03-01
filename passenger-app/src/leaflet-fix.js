import L from 'leaflet';

// Patch Leaflet's getPosition to handle missing _leaflet_pos.
// Without this, Leaflet crashes with "Cannot read properties of undefined
// (reading '_leaflet_pos')" when the map pane hasn't been positioned yet
// (e.g. container has zero dimensions during React transitions).
const originalGetPosition = L.DomUtil.getPosition;
L.DomUtil.getPosition = function (el) {
  return originalGetPosition.call(this, el) || new L.Point(0, 0);
};
