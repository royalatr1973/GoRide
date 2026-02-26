import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Earnings() {
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/operator/earnings', { params: { period } }).then((res) => setData(res.data)).catch(console.error);
  }, [period]);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Earnings</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['today', 'week', 'month'].map((p) => (
            <button
              key={p}
              className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Revenue</div>
          <div className="value">&#8377;{parseFloat(data.summary.total_revenue).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card">
          <div className="label">Your Commission</div>
          <div className="value" style={{ color: '#6C5CE7' }}>&#8377;{parseFloat(data.summary.total_commission).toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Rides</div>
          <div className="value">{data.summary.total_rides}</div>
        </div>
      </div>

      <div className="data-table">
        <div style={{ padding: '16px', borderBottom: '1px solid #DFE6E9' }}>
          <h3>Driver Breakdown</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Rides</th>
              <th>Total Fare</th>
              <th>Driver Earning</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {data.driver_breakdown.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.rides}</td>
                <td>&#8377;{parseFloat(d.total_fare).toLocaleString('en-IN')}</td>
                <td>&#8377;{parseFloat(d.driver_earning).toLocaleString('en-IN')}</td>
                <td>&#8377;{parseFloat(d.commission).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {data.driver_breakdown.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>No earnings for this period</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
