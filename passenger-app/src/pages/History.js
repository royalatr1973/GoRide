import React, { useState, useEffect } from 'react';
import { passengerAPI } from '../api';
import Header from '../components/Header';
import RideCard from '../components/RideCard';

function History() {
  const [rides, setRides] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRides();
  }, [page]);

  const fetchRides = async () => {
    setLoading(true);
    try {
      const { data } = await passengerAPI.getRideHistory(page);
      setRides(data.rides);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="page history-page">
      <Header back />
      <h2>Ride History</h2>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : rides.length === 0 ? (
        <div className="empty-state">
          <p>No rides yet</p>
          <p className="sub-text">Your completed and cancelled rides will appear here</p>
        </div>
      ) : (
        <>
          <div className="ride-list">
            {rides.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default History;
