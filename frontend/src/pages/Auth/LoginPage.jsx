import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal login. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background decoration */}
      <div className="auth-bg-glow" />
      <div className="auth-bg-grid" />

      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">₿</div>
          <div>
            <h1 className="auth-logo-title">Terminal BTC</h1>
            <p className="auth-logo-sub">Personal Trading Dashboard</p>
          </div>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Selamat Datang</h2>
            <p className="auth-card-desc">Masukkan kredensial kamu untuk melanjutkan</p>
          </div>

          {error && (
            <div className="auth-error">
              <span className="auth-error-icon">⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email" className="label">Email</label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="label">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                className="input"
                placeholder="Masukkan password"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Masuk...
                </>
              ) : (
                'Masuk ke Terminal'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Belum punya akun?{' '}
              <Link to="/register" className="auth-link">Daftar sekarang</Link>
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
