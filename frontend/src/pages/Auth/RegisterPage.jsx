import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Password dan konfirmasi tidak sama');
      return;
    }
    if (form.password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register(form.email, form.password, form.name);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mendaftar. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-glow" />
      <div className="auth-bg-grid" />

      <div className="auth-container">
        <div className="auth-logo">
          <div className="auth-logo-icon">₿</div>
          <div>
            <h1 className="auth-logo-title">Terminal BTC</h1>
            <p className="auth-logo-sub">Personal Trading Dashboard</p>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Buat Akun</h2>
            <p className="auth-card-desc">Daftarkan diri kamu untuk mengakses Terminal BTC</p>
          </div>

          {error && (
            <div className="auth-error">
              <span className="auth-error-icon">⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="reg-name" className="label">Nama (opsional)</label>
              <input
                id="reg-name"
                type="text"
                name="name"
                className="input"
                placeholder="Nama kamu"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-email" className="label">Email</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                className="input"
                placeholder="nama@email.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password" className="label">Password</label>
              <input
                id="reg-password"
                type="password"
                name="password"
                className="input"
                placeholder="Minimal 6 karakter"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm" className="label">Konfirmasi Password</label>
              <input
                id="reg-confirm"
                type="password"
                name="confirm"
                className="input"
                placeholder="Ulangi password"
                value={form.confirm}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={loading}
              id="register-submit-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Mendaftar...
                </>
              ) : (
                'Buat Akun'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Sudah punya akun?{' '}
              <Link to="/login" className="auth-link">Masuk di sini</Link>
            </p>
          </div>
        </div>

        <p className="auth-disclaimer">
          Terminal BTC dirancang untuk penggunaan pribadi dalam analisis trading Bitcoin.
        </p>
      </div>
    </div>
  );
}
