import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { io } from 'socket.io-client';

const POLL_INTERVAL = 10000;

export default function Rides() {
  const [rides, setRides] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchRides = useCallback(() => {
    const params = filter ? { status: filter } : {};
    api.get('/operator/rides', { params }).then((res) => setRides(res.data.rides)).catch(console.error);
  }, [filter]);

  // Initial fetch + polling
  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRides]);

  // WebSocket for real-time ride updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('ride_status_changed', () => fetchRides());

    return () => socket.disconnect();
  }, [fetchRides]);

  return (
    <div>
      <div className="page-header">
        <h1>Rides</h1>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
        {['', 'searching', 'in_progress', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            className={`btn ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Passenger</th>
              <th>Driver</th>
              <th>Pickup</th>
              <th>Dropoff</th>
              <th>Vehicle</th>
              <th>Fare</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString('en-IN')}</td>
                <td>{r.passenger_name || '—'}</td>
                <td>{r.driver_name || '—'}</td>
                <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.pickup_address || `${r.pickup_lat}, ${r.pickup_lng}`}
                </td>
                <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.dropoff_address || `${r.dropoff_lat}, ${r.dropoff_lng}`}
                </td>
                <td>{r.vehicle_type_requested}</td>
                <td>&#8377;{r.actual_fare || r.estimated_fare || '—'}</td>
                <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
            {rides.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#999' }}>No rides found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
