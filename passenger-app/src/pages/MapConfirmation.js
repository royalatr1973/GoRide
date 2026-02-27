import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { passengerAPI } from '../api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const greenIcon = L.divIcon({
  className: '',
  html: '<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#22c55e"/><circle cx="12.5" cy="12.5" r="6" fill="#fff"/></svg>',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const redIcon = L.divIcon({
  className: '',
  html: '<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#ef4444"/><circle cx="12.5" cy="12.5" r="6" fill="#fff"/></svg>',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

function MapConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pickup, dropoff } = location.state || {};

  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!pickup || !dropoff) { navigate('/'); return; }
    geocodeLocations();
  }, []);

  const geocodeLocations = async () => {
    try {
      const [pickupRes, dropoffRes] = await Promise.all([
        passengerAPI.geocode(pickup),
        passengerAPI.geocode(dropoff),
      ]);
      setPickupCoords(pickupRes.data);
      setDropoffCoords(dropoffRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to find locations');
    }
    setLoading(false);
  };

  const initMap = useCallback(() => {
    if (!pickupCoords || !dropoffCoords || !mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const pLat = pickupCoords.lat, pLng = pickupCoords.lng;
    const dLat = dropoffCoords.lat, dLng = dropoffCoords.lng;

    const map = L.map(mapRef.current, { zoomControl: false }).setView(
      [(pLat + dLat) / 2, (pLng + dLng) / 2], 13
    );
    mapInstanceRef.current = map;

    L.tileLayer('/api/tiles/{z}/{x}/{y}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.marker([pLat, pLng], { icon: greenIcon }).addTo(map);
    L.marker([dLat, dLng], { icon: redIcon }).addTo(map);

    // Show a faint dashed line as placeholder while route loads
    const routeLine = L.polyline(
      [[pLat, pLng], [dLat, dLng]],
      { color: '#6C63FF', weight: 3, opacity: 0.3, dashArray: '8, 8' }
    ).addTo(map);

    const bounds = L.latLngBounds([[pLat, pLng], [dLat, dLng]]);
    map.fitBounds(bounds.pad(0.3));

    setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds.pad(0.3)); }, 200);

    // Fetch actual driving route from OSRM
    fetch(`https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`)
      .then(r => {
        if (!r.ok) throw new Error('OSRM request failed');
        return r.json();
      })
      .then(data => {
        if (data.routes?.[0]) {
          map.removeLayer(routeLine);
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          L.polyline(coords, { color: '#6C63FF', weight: 5, opacity: 0.9 }).addTo(map);
          map.fitBounds(L.latLngBounds(coords).pad(0.15));
        }
      })
      .catch(err => {
        console.warn('Route fetch failed, showing straight line:', err.message);
      });
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    initMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [initMap]);

  const handleConfirm = () => {
    navigate('/booking', { state: { pickup, dropoff, pickupCoords, dropoffCoords } });
  };

  if (loading) {
    return (
      <div className="page map-page">
        <div className="loading-fullscreen">
          <div className="spinner"></div>
          <p>Finding your locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page map-page">
      {/* Back button floating */}
      <button className="floating-back" onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      {error && <div className="error-msg" style={{ position: 'absolute', top: 60, left: 16, right: 16, zIndex: 10 }}>{error}</div>}

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}></div>

      {/* Bottom sheet */}
      {pickupCoords && dropoffCoords && (
        <div className="bottom-sheet">
          <div className="sheet-handle"></div>
          <h3 className="sheet-title">Confirm your route</h3>

          <div className="sheet-locations">
            <div className="sheet-loc-row">
              <div className="sheet-loc-dot green"></div>
              <div className="sheet-loc-info">
                <span className="sheet-loc-label">PICKUP</span>
                <span className="sheet-loc-address">{pickupCoords.address || pickup}</span>
              </div>
            </div>
            <div className="sheet-loc-connector">
              <div className="connector-line"></div>
            </div>
            <div className="sheet-loc-row">
              <div className="sheet-loc-dot red"></div>
              <div className="sheet-loc-info">
                <span className="sheet-loc-label">DROP-OFF</span>
                <span className="sheet-loc-address">{dropoffCoords.address || dropoff}</span>
              </div>
            </div>
          </div>

          <button className="btn-yellow" onClick={handleConfirm}>
            Confirm Locations
          </button>
          <button className="btn-text" onClick={() => navigate('/')}>
            Change locations
          </button>
        </div>
      )}
    </div>
  );
}

export default MapConfirmation;
