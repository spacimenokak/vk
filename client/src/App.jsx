import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import QuizEditor from './pages/QuizEditor';
import QuizRoom from './pages/QuizRoom';
import JoinQuiz from './pages/JoinQuiz';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="join" element={<PrivateRoute><JoinQuiz /></PrivateRoute>} />
        <Route path="quiz/new" element={<PrivateRoute roles={['organizer']}><QuizEditor /></PrivateRoute>} />
        <Route path="quiz/:id/edit" element={<PrivateRoute roles={['organizer']}><QuizEditor /></PrivateRoute>} />
        <Route path="room/:code" element={<PrivateRoute><QuizRoom /></PrivateRoute>} />
      </Route>
    </Routes>
  );
}
