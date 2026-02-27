import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { passengerAPI } from '../api';

const VEHICLE_INFO = {
  auto: { name: 'Auto', emoji: '\u{1F6FA}' },
  economy: { name: 'Economy', emoji: '\u{1F697}' },
  sedan: { name: 'Sedan', emoji: '\u{1F699}' },
  suv: { name: 'SUV', emoji: '\u{1F690}' },
};

const PRICE_ADJUSTMENTS = [-30, -20, -10, 0, 10, 20, 30, 50];

function SetPrice() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    pickup, dropoff, pickupCoords, dropoffCoords,
    routeInfo, selectedVehicle,
  } = location.state || {};

  const baseFare = routeInfo?.fares?.[selectedVehicle]?.total || 0;
  const [adjustment, setAdjustment] = useState(0);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  const finalFare = Math.max(baseFare + adjustment, Math.round(baseFare * 0.5));
  const info = VEHICLE_INFO[selectedVehicle] || VEHICLE_INFO.auto;

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
        estimated_fare: finalFare,
        estimated_distance_km: routeInfo.distance_km,
        estimated_duration_minutes: routeInfo.duration_minutes,
      });
      navigate(`/ride/${data.ride_id}`, { state: { otp: data.otp } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to book ride');
      setBooking(false);
    }
  };

  if (!routeInfo) {
    navigate('/');
    return null;
  }

  return (
    <div className="page setprice-page">
      {/* Back */}
      <button className="floating-back dark" onClick={() => navigate(-1)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      {/* No commission banner */}
      <div className="commission-banner">
        <div className="banner-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <div className="banner-text">
          <strong>Zero Commission</strong>
          <span>Full amount goes directly to your driver</span>
        </div>
      </div>

      {/* Vehicle info */}
      <div className="price-vehicle">
        <span className="price-vehicle-emoji">{info.emoji}</span>
        <span className="price-vehicle-name">{info.name}</span>
        <span className="price-vehicle-meta">{routeInfo.distance_km} km &middot; {routeInfo.duration_minutes} min</span>
      </div>

      {/* Large fare display */}
      <div className="fare-hero">
        <span className="fare-hero-label">Your fare</span>
        <span className="fare-hero-amount">&#8377;{finalFare}</span>
        {adjustment !== 0 && (
          <span className={`fare-hero-diff ${adjustment > 0 ? 'up' : 'down'}`}>
            {adjustment > 0 ? '+' : ''}{adjustment} from base &#8377;{baseFare}
          </span>
        )}
      </div>

      {/* Price adjustment */}
      <div className="price-adjust-section">
        <span className="price-adjust-label">Adjust your fare</span>
        <div className="price-chips">
          {PRICE_ADJUSTMENTS.map((adj) => {
            const isActive = adjustment === adj;
            return (
              <button
                key={adj}
                className={`price-chip ${isActive ? 'active' : ''} ${adj === 0 ? 'base' : ''}`}
                onClick={() => setAdjustment(adj)}
              >
                {adj === 0 ? `\u20B9${baseFare}` : (adj > 0 ? `+${adj}` : adj)}
              </button>
            );
          })}
        </div>
        <span className="price-adjust-hint">
          Tip: Higher fares help you get a driver faster
        </span>
      </div>

      {/* Route summary */}
      <div className="price-route-summary">
        <div className="price-route-row">
          <span className="prs-dot green"></span>
          <span className="prs-text">{pickupCoords?.address || pickup}</span>
        </div>
        <div className="price-route-row">
          <span className="prs-dot red"></span>
          <span className="prs-text">{dropoffCoords?.address || dropoff}</span>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Book button */}
      <div className="setprice-footer">
        <button
          className="btn-yellow btn-book-final"
          onClick={handleBook}
          disabled={booking}
        >
          {booking ? 'Booking...' : `Book ${info.name} for \u20B9${finalFare}`}
        </button>
      </div>
    </div>
  );
}

export default SetPrice;
