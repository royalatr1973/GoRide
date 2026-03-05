import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', license_number: '', vehicle_id: '' });

  const loadDrivers = () => {
    api.get('/operator/drivers').then((res) => setDrivers(res.data.drivers)).catch(console.error);
  };

  const loadVehicles = () => {
    api.get('/operator/vehicles').then((res) => setVehicles(res.data.vehicles)).catch(console.error);
  };

  useEffect(() => {
    loadDrivers();
    loadVehicles();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        phone: `+91${form.phone}`,
        license_number: form.license_number,
      };
      if (form.vehicle_id) payload.vehicle_id = form.vehicle_id;
      await api.post('/operator/drivers/add', payload);
      setShowModal(false);
      setForm({ name: '', phone: '', license_number: '', vehicle_id: '' });
      loadDrivers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add driver');
    }
  };

  const handleAssignVehicle = async (driverId, vehicleId) => {
    try {
      await api.put(`/operator/drivers/${driverId}`, { vehicle_id: vehicleId || null });
      loadDrivers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign vehicle');
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
                <td>
                  <select
                    value={d.vehicle_id || ''}
                    onChange={(e) => handleAssignVehicle(d.id, e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #DFE6E9' }}
                  >
                    <option value="">No vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.registration_number})
                      </option>
                    ))}
                  </select>
                </td>
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
              <div className="form-group">
                <label>Assign Vehicle</label>
                <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
                  <option value="">None (assign later)</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model} ({v.registration_number})
                    </option>
                  ))}
                </select>
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
