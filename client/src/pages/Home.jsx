import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="hero">
      <div className="hero-content">
        <h1>Квизы в реальном времени</h1>
        <p className="hero-subtitle">
          Создавайте интерактивные опросы, подключайте участников по коду комнаты
          и соревнуйтесь за первое место в лидерборде
        </p>
        <div className="hero-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary btn-lg">Перейти в кабинет</Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-lg">Начать бесплатно</Link>
              <Link to="/login" className="btn btn-outline btn-lg">Войти</Link>
            </>
          )}
        </div>
      </div>
      <div className="features">
        <div className="feature-card">
          <div className="feature-icon">🎯</div>
          <h3>Для организаторов</h3>
          <p>Создавайте квизы с разными типами вопросов, настраивайте время и запускайте сессии</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">👥</div>
          <h3>Для участников</h3>
          <p>Подключайтесь по коду комнаты и отвечайте на вопросы в режиме реального времени</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3>Лидерборд</h3>
          <p>Автоматический подсчёт баллов и определение победителей по окончании квиза</p>
        </div>
      </div>
    </div>
  );
}
