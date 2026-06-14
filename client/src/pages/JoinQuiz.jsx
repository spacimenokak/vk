import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function JoinQuiz() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.getRoom(code.trim().toUpperCase());
      navigate(`/room/${code.trim().toUpperCase()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="join-page">
      <form className="join-form" onSubmit={handleSubmit}>
        <h2>Войти в квиз</h2>
        <p className="text-muted">Введите код комнаты, который вам дал организатор</p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <input
            className="room-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? 'Подключение...' : 'Присоединиться'}
        </button>
      </form>
    </div>
  );
}
