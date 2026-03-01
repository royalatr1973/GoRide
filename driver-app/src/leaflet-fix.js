import L from 'leaflet';

// Replace Leaflet's getPosition with a null-safe version.
// The original does: return el._leaflet_pos
// This crashes when el itself is undefined (e.g. _mapPane removed
// during React unmount) or when _leaflet_pos hasn't been set yet.
L.DomUtil.getPosition = function (el) {
  if (!el) return new L.Point(0, 0);
  return el._leaflet_pos || new L.Point(0, 0);
};
