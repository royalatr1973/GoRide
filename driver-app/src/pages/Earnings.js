import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAPI } from '../api';

function Earnings() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await driverAPI.getEarnings(period);
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  return (
    <div className="page earnings-page">
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h2>Earnings</h2>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Period tabs */}
      <div className="period-tabs">
        {['today', 'week', 'month'].map((p) => (
          <button
            key={p}
            className={`period-tab ${period === p ? 'active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner"></div></div>
      ) : data ? (
        <>
          {/* Big earning number */}
          <div className="earnings-hero">
            <span className="eh-label">Total Earnings</span>
            <span className="eh-amount">&#8377;{Math.round(data.total_earning || 0)}</span>
          </div>

          {/* Breakdown */}
          <div className="earnings-breakdown">
            <div className="eb-card">
              <div className="eb-icon rides">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="eb-info">
                <span className="eb-value">{data.ride_count || 0}</span>
                <span className="eb-label">Total Rides</span>
              </div>
            </div>

            <div className="eb-card">
              <div className="eb-icon fare">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="eb-info">
                <span className="eb-value">&#8377;{Math.round(data.total_fare || 0)}</span>
                <span className="eb-label">Total Fares</span>
              </div>
            </div>

            <div className="eb-card">
              <div className="eb-icon commission">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              </div>
              <div className="eb-info">
                <span className="eb-value">&#8377;{Math.round(data.total_commission || 0)}</span>
                <span className="eb-label">Commission</span>
              </div>
            </div>
          </div>

          {/* Average per ride */}
          {data.ride_count > 0 && (
            <div className="avg-card">
              <span className="avg-label">Average per ride</span>
              <span className="avg-value">&#8377;{Math.round((data.total_earning || 0) / data.ride_count)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>No earnings data available</p>
        </div>
      )}
    </div>
  );
}

export default Earnings;
