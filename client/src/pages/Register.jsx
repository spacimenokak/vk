import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'participant' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Регистрация</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label>Имя</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Пароль</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        </div>
        <div className="form-group">
          <label>Роль</label>
          <div className="role-selector">
            <button
              type="button"
              className={`role-btn ${form.role === 'participant' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, role: 'participant' })}
            >
              👤 Участник
            </button>
            <button
              type="button"
              className={`role-btn ${form.role === 'organizer' ? 'active' : ''}`}
              onClick={() => setForm({ ...form, role: 'organizer' })}
            >
              🎤 Организатор
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
        <p className="auth-link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
