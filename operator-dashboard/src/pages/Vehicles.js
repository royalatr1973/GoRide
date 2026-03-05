import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    registration_number: '', make: '', model: '', color: '', vehicle_type: 'economy', seats: 4,
  });

  const loadVehicles = () => {
    api.get('/operator/vehicles').then((res) => setVehicles(res.data.vehicles)).catch(console.error);
  };

  useEffect(loadVehicles, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/operator/vehicles/add', { ...form, seats: parseInt(form.seats) });
      setShowModal(false);
      setForm({ registration_number: '', make: '', model: '', color: '', vehicle_type: 'economy', seats: 4 });
      loadVehicles();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add vehicle');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Vehicles</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Vehicle</button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Make</th>
              <th>Model</th>
              <th>Color</th>
              <th>Type</th>
              <th>Seats</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.registration_number}</td>
                <td>{v.make}</td>
                <td>{v.model}</td>
                <td>{v.color || '—'}</td>
                <td><span className={`badge badge-${v.is_active ? 'online' : 'offline'}`}>{v.vehicle_type}</span></td>
                <td>{v.seats}</td>
                <td>{v.is_active ? 'Yes' : 'No'}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => {
                      if (window.confirm(`Delete vehicle "${v.registration_number}"?`)) {
                        api.delete(`/operator/vehicles/${v.id}`).then(loadVehicles).catch((err) => alert(err.response?.data?.error || 'Failed to delete'));
                      }
                    }}
                  >Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Vehicle</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Registration Number</label>
                <input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Make</label>
                <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Model</label>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vehicle Type</label>
                <select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                  <option value="auto">Auto</option>
                  <option value="economy">Economy</option>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                </select>
              </div>
              <div className="form-group">
                <label>Seats</label>
                <input type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} min={1} max={10} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
