import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import '../App.css';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '\u2302' },
  { path: '/drivers', label: 'Drivers', icon: '\u263A' },
  { path: '/vehicles', label: 'Vehicles', icon: '\u2699' },
  { path: '/rides', label: 'Rides', icon: '\u2794' },
  { path: '/earnings', label: 'Earnings', icon: '\u20B9' },
  { path: '/fare-settings', label: 'Fare Settings', icon: '\u2706' },
  { path: '/settings', label: 'Settings', icon: '\u2630' },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('operator_token');
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>Freedom</h2>
          <small>Operator Dashboard</small>
        </div>
        <nav>
          {NAV_ITEMS.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          <a href="#logout" onClick={handleLogout} style={{ marginTop: 40 }}>
            <span>&#x2190;</span>
            <span>Logout</span>
          </a>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
