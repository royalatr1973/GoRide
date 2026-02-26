import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { passengerAPI } from '../api';
import Header from '../components/Header';

const STATUS_LABELS = {
  searching: 'Searching for a driver...',
  driver_assigned: 'Driver assigned!',
  driver_arriving: 'Driver is on the way',
  driver_arrived: 'Driver has arrived',
  in_progress: 'Ride in progress',
  completed: 'Ride completed',
  cancelled: 'Ride cancelled',
  no_driver_found: 'No driver found',
};

function RideTracker() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [error, setError] = useState('');
  const [rating, setRating] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await passengerAPI.getRideStatus(id);
      setRide(data);
    } catch (err) {
      setError('Failed to get ride status');
    }
  }, [id]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await passengerAPI.cancelRide(id, 'Cancelled by passenger');
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Cannot cancel ride');
    }
    setCancelling(false);
  };

  const handleRate = async (stars) => {
    setRating(stars);
    try {
      await passengerAPI.rateRide(id, stars);
    } catch (err) {
      setError('Failed to submit rating');
    }
  };

  if (!ride && !error) {
    return (
      <div className="page">
        <Header back />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading ride details...</p>
        </div>
      </div>
    );
  }

  const canCancel = ['searching', 'driver_assigned', 'driver_arriving'].includes(ride?.status);
  const isActive = ['searching', 'driver_assigned', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(ride?.status);

  return (
    <div className="page ride-tracker-page">
      <Header back />

      {error && <div className="error-msg">{error}</div>}

      {ride && (
        <>
          <div className={`status-banner status-${ride.status}`}>
            <div className="status-text">{STATUS_LABELS[ride.status] || ride.status}</div>
            {isActive && ride.status === 'searching' && <div className="pulse-dot"></div>}
          </div>

          {location.state?.otp && ride.status !== 'completed' && ride.status !== 'cancelled' && (
            <div className="otp-display">
              <span className="otp-label">Share this OTP with driver</span>
              <span className="otp-code">{location.state.otp}</span>
            </div>
          )}

          <div className="ride-details">
            <div className="detail-row">
              <span className="dot green"></span>
              <span>{ride.pickup_address}</span>
            </div>
            <div className="detail-row">
              <span className="dot red"></span>
              <span>{ride.dropoff_address}</span>
            </div>
            {ride.estimated_fare && (
              <div className="detail-row">
                <span className="detail-label">Fare</span>
                <span className="detail-value">₹{ride.actual_fare || ride.estimated_fare}</span>
              </div>
            )}
          </div>

          {ride.driver && (
            <div className="driver-card">
              <div className="driver-info">
                <div className="driver-avatar">
                  {ride.driver.name ? ride.driver.name[0].toUpperCase() : 'D'}
                </div>
                <div>
                  <div className="driver-name">{ride.driver.name || 'Driver'}</div>
                  <div className="driver-rating">
                    {'★'.repeat(Math.round(ride.driver.rating_avg || 0))} {ride.driver.rating_avg || 'New'}
                  </div>
                </div>
              </div>
              {ride.vehicle && (
                <div className="vehicle-info">
                  <span>{ride.vehicle.color} {ride.vehicle.make} {ride.vehicle.model}</span>
                  <span className="vehicle-number">{ride.vehicle.registration_number}</span>
                </div>
              )}
              <a href={`tel:${ride.driver.phone}`} className="btn-call">Call Driver</a>
            </div>
          )}

          {canCancel && (
            <button className="btn-danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Cancel Ride'}
            </button>
          )}

          {ride.status === 'completed' && !rating && (
            <div className="rating-section">
              <p>Rate your ride</p>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} className="star-btn" onClick={() => handleRate(s)}>
                    {s <= rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(ride.status === 'completed' || ride.status === 'cancelled' || ride.status === 'no_driver_found') && (
            <button className="btn-primary" onClick={() => navigate('/')}>
              Book Another Ride
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default RideTracker;
