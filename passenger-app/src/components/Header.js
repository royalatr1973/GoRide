import React from 'react';
import { useNavigate } from 'react-router-dom';

function Header({ back }) {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      {back && (
        <button className="back-btn" onClick={() => navigate(-1)}>
          &#8592;
        </button>
      )}
      <span className="header-brand">Freedom</span>
    </header>
  );
}

export default Header;
