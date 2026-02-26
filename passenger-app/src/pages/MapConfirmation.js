import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { passengerAPI } from '../api';
import Header from '../components/Header';
import L from 'leaflet';

// Fix default marker icons (leaflet + webpack issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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
    if (!pickup || !dropoff) {
      navigate('/');
      return;
    }
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

    // Clean up previous map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const pLat = pickupCoords.lat;
    const pLng = pickupCoords.lng;
    const dLat = dropoffCoords.lat;
    const dLng = dropoffCoords.lng;

    const centerLat = (pLat + dLat) / 2;
    const centerLng = (pLng + dLng) / 2;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 13);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    // Add markers
    L.marker([pLat, pLng], { icon: greenIcon })
      .addTo(map)
      .bindPopup('<b>Pickup</b><br>' + (pickupCoords.address || pickup));

    L.marker([dLat, dLng], { icon: redIcon })
      .addTo(map)
      .bindPopup('<b>Drop-off</b><br>' + (dropoffCoords.address || dropoff));

    // Draw dashed line as immediate fallback
    const routeLine = L.polyline(
      [[pLat, pLng], [dLat, dLng]],
      { color: '#4f46e5', weight: 4, opacity: 0.7, dashArray: '10, 8' }
    ).addTo(map);

    // Fit both markers in view
    const bounds = L.latLngBounds([[pLat, pLng], [dLat, dLng]]);
    map.fitBounds(bounds.pad(0.3));

    // Force recalculate after render
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds.pad(0.3));
    }, 200);

    // Try to get actual route from OSRM
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.routes && data.routes[0]) {
          map.removeLayer(routeLine);
          const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
          L.polyline(coords, {
            color: '#4f46e5',
            weight: 4,
            opacity: 0.8,
          }).addTo(map);
          map.fitBounds(L.latLngBounds(coords).pad(0.15));
        }
      })
      .catch(() => {
        // Keep the straight dashed line as fallback
      });
  }, [pickupCoords, dropoffCoords, pickup, dropoff]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  const handleConfirm = () => {
    navigate('/booking', {
      state: {
        pickup,
        dropoff,
        pickupCoords,
        dropoffCoords,
      },
    });
  };

  const handleChange = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="page">
        <Header back />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Finding your locations on map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page map-confirm-page">
      <Header back />

      {error && <div className="error-msg">{error}</div>}

      {pickupCoords && dropoffCoords && (
        <>
          <div
            ref={mapRef}
            id="confirm-map"
            style={{ width: '100%', height: '50vh', minHeight: '300px' }}
          ></div>

          <div className="map-locations">
            <div className="map-location-item">
              <span className="dot green"></span>
              <div className="map-location-text">
                <span className="map-location-label">Pickup</span>
                <span className="map-location-address">
                  {pickupCoords.address || pickup}
                </span>
              </div>
            </div>
            <div className="map-location-item">
              <span className="dot red"></span>
              <div className="map-location-text">
                <span className="map-location-label">Drop-off</span>
                <span className="map-location-address">
                  {dropoffCoords.address || dropoff}
                </span>
              </div>
            </div>
          </div>

          <div className="map-actions">
            <button className="btn-primary" onClick={handleConfirm}>
              Confirm Locations
            </button>
            <button className="btn-change" onClick={handleChange}>
              Change Locations
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default MapConfirmation;
