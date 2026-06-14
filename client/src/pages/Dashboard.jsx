import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    Promise.all([
      user.role === 'organizer' ? api.getQuizzes() : Promise.resolve([]),
      api.getHistory(),
    ])
      .then(([q, h]) => {
        setQuizzes(q);
        setHistory(h);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.role]);

  const handleStart = async (quizId) => {
    setStarting(quizId);
    try {
      const { room_code } = await api.startSession(quizId);
      navigate(`/room/${room_code}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setStarting(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить квиз? Вся история сессий тоже будет удалена.')) return;
    try {
      await api.deleteQuiz(id);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      alert(err.message || 'Не удалось удалить квиз');
    }
  };

  if (loading) return <div className="loading-screen">Загрузка...</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Личный кабинет</h1>
        <p className="text-muted">
          {user.role === 'organizer' ? 'Управление квизами и история проведения' : 'История участия в квизах'}
        </p>
      </div>

      {user.role === 'organizer' && (
        <section className="section">
          <div className="section-header">
            <h2>Мои квизы</h2>
            <Link to="/quiz/new" className="btn btn-primary btn-sm">+ Создать</Link>
          </div>
          {quizzes.length === 0 ? (
            <div className="empty-state">
              <p>У вас пока нет квизов</p>
              <Link to="/quiz/new" className="btn btn-primary">Создать первый квиз</Link>
            </div>
          ) : (
            <div className="quiz-grid">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="quiz-card">
                  <div className="quiz-card-header">
                    <span className="category-badge">{quiz.category}</span>
                  </div>
                  <h3>{quiz.title}</h3>
                  <p className="text-muted">{quiz.description || 'Без описания'}</p>
                  <div className="quiz-card-actions">
                    <Link to={`/quiz/${quiz.id}/edit`} className="btn btn-outline btn-sm">Редактировать</Link>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStart(quiz.id)}
                      disabled={starting === quiz.id}
                    >
                      {starting === quiz.id ? 'Запуск...' : 'Запустить'}
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(quiz.id)}>Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {user.role === 'participant' && (
        <section className="section">
          <div className="section-header">
            <h2>Присоединиться к квизу</h2>
          </div>
          <Link to="/join" className="btn btn-primary btn-lg">Ввести код комнаты</Link>
        </section>
      )}

      <section className="section">
        <h2>{user.role === 'organizer' ? 'История проведения' : 'История участия'}</h2>
        {history.length === 0 ? (
          <p className="text-muted">История пуста</p>
        ) : (
          <div className="history-table">
            <table>
              <thead>
                <tr>
                  <th>Квиз</th>
                  <th>Категория</th>
                  <th>Статус</th>
                  {user.role === 'organizer' ? <th>Участников</th> : <th>Баллы</th>}
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.quiz_title}</td>
                    <td>{item.category}</td>
                    <td><span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span></td>
                    {user.role === 'organizer' ? (
                      <td>{item.participants_count || 0}</td>
                    ) : (
                      <td><strong>{item.score}</strong></td>
                    )}
                    <td>{formatDate(item.started_at || item.joined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function statusLabel(status) {
  return { waiting: 'Ожидание', active: 'Активен', finished: 'Завершён' }[status] || status;
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('ru-RU');
}
