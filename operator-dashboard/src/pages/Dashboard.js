import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { io } from 'socket.io-client';

const POLL_INTERVAL = 10000; // 10s polling fallback

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [liveDrivers, setLiveDrivers] = useState([]);

  const fetchData = useCallback(() => {
    api.get('/operator/dashboard').then((res) => setStats(res.data)).catch(console.error);
    api.get('/operator/live-map').then((res) => setLiveDrivers(res.data.drivers)).catch(console.error);
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Operator socket connected');
    });

    // Refresh data on any ride or driver change
    socket.on('driver_status_changed', () => fetchData());
    socket.on('ride_status_changed', () => fetchData());
    socket.on('driver_location_update', () => fetchData());

    return () => socket.disconnect();
  }, [fetchData]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Active Drivers</div>
          <div className="value">{stats.active_drivers}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Drivers</div>
          <div className="value">{stats.total_drivers}</div>
        </div>
        <div className="stat-card">
          <div className="label">Vehicles</div>
          <div className="value">{stats.total_vehicles}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ongoing Rides</div>
          <div className="value">{stats.ongoing_rides}</div>
        </div>
        <div className="stat-card">
          <div className="label">Today's Revenue</div>
          <div className="value" style={{ color: '#00B894' }}>&#8377;{stats.today_revenue}</div>
        </div>
        <div className="stat-card">
          <div className="label">Today's Commission</div>
          <div className="value" style={{ color: '#6C5CE7' }}>&#8377;{stats.today_commission}</div>
        </div>
      </div>

      <div className="data-table">
        <div style={{ padding: '16px', borderBottom: '1px solid #DFE6E9' }}>
          <h3>Live Drivers</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {liveDrivers.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                <td>{d.current_lat}, {d.current_lng}</td>
              </tr>
            ))}
            {liveDrivers.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: '#999' }}>No active drivers</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
