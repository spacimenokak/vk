const API = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${url}`, {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
    });
  } catch {
    throw new Error('Сервер недоступен. Запустите npm run dev в папке проекта.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  getQuizzes: () => request('/quizzes'),
  getQuiz: (id) => request(`/quizzes/${id}`),
  createQuiz: (body) => request('/quizzes', { method: 'POST', body: JSON.stringify(body) }),
  updateQuiz: (id, body) => request(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteQuiz: (id) => request(`/quizzes/${id}`, { method: 'DELETE' }),
  startSession: (quiz_id) => request('/sessions/start', { method: 'POST', body: JSON.stringify({ quiz_id }) }),
  getRoom: (code) => request(`/sessions/room/${code}`),
  getHistory: () => request('/sessions/history'),
};
