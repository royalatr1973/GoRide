import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { passengerAPI } from '../api';
import Header from '../components/Header';
import VehicleSelector from '../components/VehicleSelector';

function Booking() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pickup, dropoff, pickupCoords: prePickupCoords, dropoffCoords: preDropoffCoords } = location.state || {};

  const [pickupCoords, setPickupCoords] = useState(prePickupCoords || null);
  const [dropoffCoords, setDropoffCoords] = useState(preDropoffCoords || null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pickup || !dropoff) {
      navigate('/');
      return;
    }
    fetchRoute();
  }, []);

  const fetchRoute = async () => {
    try {
      let pCoords = pickupCoords;
      let dCoords = dropoffCoords;

      // Only geocode if we don't have pre-geocoded coords from map confirmation
      if (!pCoords) {
        const pickupRes = await passengerAPI.geocode(pickup);
        pCoords = pickupRes.data;
        setPickupCoords(pCoords);
      }

      if (!dCoords) {
        const dropoffRes = await passengerAPI.geocode(dropoff);
        dCoords = dropoffRes.data;
        setDropoffCoords(dCoords);
      }

      // Calculate route
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

  const handleBook = async () => {
    if (!routeInfo || !pickupCoords || !dropoffCoords) return;
    setBooking(true);
    setError('');
    try {
      const { data } = await passengerAPI.bookRide({
        pickup: { lat: pickupCoords.lat, lng: pickupCoords.lng, address: pickupCoords.address },
        dropoff: { lat: dropoffCoords.lat, lng: dropoffCoords.lng, address: dropoffCoords.address },
        vehicle_type: selectedVehicle,
        payment_method: 'cash',
        estimated_fare: routeInfo.fares[selectedVehicle]?.total,
        estimated_distance_km: routeInfo.distance_km,
        estimated_duration_minutes: routeInfo.duration_minutes,
      });
      navigate(`/ride/${data.ride_id}`, { state: { otp: data.otp } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to book ride');
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <Header back />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Calculating your route...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page booking-page">
      <Header back />

      {error && <div className="error-msg">{error}</div>}

      <div className="route-summary">
        <div className="route-point">
          <span className="dot green"></span>
          <span>{pickupCoords?.address || pickup}</span>
        </div>
        <div className="route-point">
          <span className="dot red"></span>
          <span>{dropoffCoords?.address || dropoff}</span>
        </div>
        {routeInfo && (
          <div className="route-stats">
            <span>{routeInfo.distance_km} km</span>
            <span>{routeInfo.duration_minutes} min</span>
          </div>
        )}
      </div>

      {routeInfo?.fares && (
        <VehicleSelector
          fares={routeInfo.fares}
          selected={selectedVehicle}
          onSelect={setSelectedVehicle}
        />
      )}

      <div className="booking-footer">
        <div className="fare-display">
          <span className="fare-label">Estimated Fare</span>
          <span className="fare-amount">
            {routeInfo?.fares[selectedVehicle]
              ? `₹${routeInfo.fares[selectedVehicle].total}`
              : '--'}
          </span>
        </div>
        <button
          className="btn-primary btn-book"
          onClick={handleBook}
          disabled={booking || !routeInfo?.fares[selectedVehicle]}
        >
          {booking ? 'Booking...' : 'Book Now'}
        </button>
      </div>
    </div>
  );
}

export default Booking;
