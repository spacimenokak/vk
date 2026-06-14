import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          <span className="logo-icon">⚡</span>
          QuizLive
        </Link>
        <nav className="nav">
          {user ? (
            <>
              <Link to="/dashboard">Кабинет</Link>
              {user.role === 'participant' && <Link to="/join">Войти в квиз</Link>}
              {user.role === 'organizer' && <Link to="/quiz/new" className="btn btn-primary btn-sm">+ Создать квиз</Link>}
              <span className="user-badge">{user.name}</span>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Регистрация</Link>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <p>QuizLive — платформа для проведения квизов в реальном времени</p>
      </footer>
    </div>
  );
}
