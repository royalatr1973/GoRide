import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', license_number: '' });

  const loadDrivers = () => {
    api.get('/operator/drivers').then((res) => setDrivers(res.data.drivers)).catch(console.error);
  };

  useEffect(loadDrivers, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await api.post('/operator/drivers/add', {
        name: form.name,
        phone: `+91${form.phone}`,
        license_number: form.license_number,
      });
      setShowModal(false);
      setForm({ name: '', phone: '', license_number: '' });
      loadDrivers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add driver');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Drivers</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Driver</button>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>License</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Acceptance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id}>
                <td>{d.name || '—'}</td>
                <td>{d.phone}</td>
                <td>{d.license_number || '—'}</td>
                <td>{d.vehicle_make ? `${d.vehicle_make} ${d.vehicle_model} (${d.registration_number})` : '—'}</td>
                <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                <td>{d.rating_avg}</td>
                <td>{d.acceptance_rate}%</td>
                <td>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 12px', fontSize: 13 }}
                    onClick={() => {
                      if (window.confirm(`Delete driver "${d.name}"?`)) {
                        api.delete(`/operator/drivers/${d.id}`).then(loadDrivers).catch((err) => alert(err.response?.data?.error || 'Failed to delete'));
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
            <h2>Add Driver</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone (10 digits)</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} required />
              </div>
              <div className="form-group">
                <label>License Number</label>
                <input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Driver</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
