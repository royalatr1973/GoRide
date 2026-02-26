import React from 'react';

function RideCard({ ride }) {
  const date = new Date(ride.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`ride-card status-card-${ride.status}`}>
      <div className="ride-card-header">
        <span className="ride-date">{date}</span>
        <span className={`ride-status-badge ${ride.status}`}>{ride.status}</span>
      </div>
      <div className="ride-card-body">
        <div className="ride-route">
          <div className="route-item">
            <span className="dot green"></span>
            <span className="route-text">{ride.pickup_address || 'Pickup'}</span>
          </div>
          <div className="route-item">
            <span className="dot red"></span>
            <span className="route-text">{ride.dropoff_address || 'Dropoff'}</span>
          </div>
        </div>
        <div className="ride-card-footer">
          <span className="ride-type">{ride.vehicle_type_requested}</span>
          <span className="ride-fare">₹{ride.actual_fare || ride.estimated_fare || '--'}</span>
        </div>
      </div>
    </div>
  );
}

export default RideCard;
