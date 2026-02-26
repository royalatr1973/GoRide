import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { passengerAPI } from '../api';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const VEHICLE_INFO = {
  auto: { name: 'Auto', emoji: '\u{1F6FA}', seats: 3, tagline: 'Affordable & quick', color: '#FFF3E0' },
  economy: { name: 'Economy', emoji: '\u{1F697}', seats: 4, tagline: 'Budget friendly', color: '#E3F2FD' },
  sedan: { name: 'Sedan', emoji: '\u{1F699}', seats: 4, tagline: 'Comfortable rides', color: '#F3E5F5' },
  suv: { name: 'SUV', emoji: '\u{1F690}', seats: 6, tagline: 'Spacious for groups', color: '#E8F5E9' },
};

function Booking() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pickup, dropoff, pickupCoords: prePickup, dropoffCoords: preDrop } = location.state || {};

  const [pickupCoords, setPickupCoords] = useState(prePickup || null);
  const [dropoffCoords, setDropoffCoords] = useState(preDrop || null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!pickup || !dropoff) { navigate('/'); return; }
    fetchRoute();
  }, []);

  const fetchRoute = async () => {
    try {
      let pCoords = pickupCoords;
      let dCoords = dropoffCoords;
      if (!pCoords) { const r = await passengerAPI.geocode(pickup); pCoords = r.data; setPickupCoords(pCoords); }
      if (!dCoords) { const r = await passengerAPI.geocode(dropoff); dCoords = r.data; setDropoffCoords(dCoords); }
      const routeRes = await passengerAPI.calculateRoute(
        { lat: pCoords.lat, lng: pCoords.lng },
        { lat: dCoords.lat, lng: dCoords.lng }
      );
      setRouteInfo(routeRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate route');
    }
    setLoading(false);
  };

  const initMap = useCallback(() => {
    if (!pickupCoords || !dropoffCoords || !mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const pLat = pickupCoords.lat, pLng = pickupCoords.lng;
    const dLat = dropoffCoords.lat, dLng = dropoffCoords.lng;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
      .setView([(pLat + dLat) / 2, (pLng + dLng) / 2], 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.marker([pLat, pLng], { icon: greenIcon }).addTo(map);
    L.marker([dLat, dLng], { icon: redIcon }).addTo(map);

    const routeLine = L.polyline([[pLat, pLng], [dLat, dLng]], { color: '#6C63FF', weight: 4, dashArray: '10, 8' }).addTo(map);
    const bounds = L.latLngBounds([[pLat, pLng], [dLat, dLng]]);
    map.fitBounds(bounds.pad(0.3));
    setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds.pad(0.3)); }, 200);

    fetch(`https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]) {
          map.removeLayer(routeLine);
          const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
          L.polyline(coords, { color: '#6C63FF', weight: 5 }).addTo(map);
          map.fitBounds(L.latLngBounds(coords).pad(0.15));
        }
      }).catch(() => {});
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    if (!loading && pickupCoords && dropoffCoords) {
      setTimeout(initMap, 100);
    }
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [loading, initMap]);

  const handleSelectAndContinue = () => {
    if (!routeInfo?.fares?.[selectedVehicle]) return;
    navigate('/set-price', {
      state: {
        pickup, dropoff, pickupCoords, dropoffCoords,
        routeInfo, selectedVehicle,
      },
    });
  };

  // Find fastest vehicle
  const getFastest = () => {
    if (!routeInfo?.fares) return null;
    const types = Object.keys(routeInfo.fares).filter(k => routeInfo.fares[k]);
    return types[0]; // auto is typically fastest in city
  };

  if (loading) {
    return (
      <div className="page map-page">
        <div className="loading-fullscreen">
          <div className="spinner"></div>
          <p>Finding best rides for you...</p>
        </div>
      </div>
    );
  }

  const selectedFare = routeInfo?.fares?.[selectedVehicle];
  const fastest = getFastest();

  return (
    <div className="page map-page">
      {/* Back button */}
      <button className="floating-back" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      {error && <div className="error-msg" style={{ position: 'absolute', top: 60, left: 16, right: 16, zIndex: 10 }}>{error}</div>}

      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}></div>

      {/* Vehicle selection bottom sheet */}
      <div className="bottom-sheet vehicle-sheet">
        <div className="sheet-handle"></div>

        {/* Route summary bar */}
        {routeInfo && (
          <div className="route-bar">
            <span>{routeInfo.distance_km} km</span>
            <span className="route-bar-dot"></span>
            <span>{routeInfo.duration_minutes} min</span>
          </div>
        )}

        <h3 className="sheet-title">Choose your ride</h3>

        {/* Vehicle list */}
        <div className="vehicle-list-new">
          {routeInfo?.fares && Object.keys(routeInfo.fares).filter(k => routeInfo.fares[k]).map((type) => {
            const info = VEHICLE_INFO[type];
            const fare = routeInfo.fares[type];
            const isSelected = selectedVehicle === type;
            const isFastest = type === fastest;

            return (
              <button
                key={type}
                className={`vehicle-card-new ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedVehicle(type)}
              >
                <div className="vc-icon" style={{ background: info.color }}>
                  <span>{info.emoji}</span>
                </div>
                <div className="vc-info">
                  <div className="vc-top-row">
                    <span className="vc-name">{info.name}</span>
                    {isFastest && <span className="vc-badge">FASTEST</span>}
                  </div>
                  <span className="vc-tagline">{info.tagline} &middot; {info.seats} seats</span>
                </div>
                <div className="vc-price">
                  <span className="vc-amount">&#8377;{fare.total}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Book button bar */}
        <div className="book-bar">
          <div className="payment-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span>Cash</span>
          </div>
          <button
            className="btn-yellow btn-book-now"
            onClick={handleSelectAndContinue}
            disabled={!selectedFare}
          >
            Book {VEHICLE_INFO[selectedVehicle]?.name} &middot; &#8377;{selectedFare?.total || '--'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Booking;
