import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { parseServerDate } from '../utils/date';

export default function QuizRoom() {
  const { code } = useParams();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const finishedRef = useRef(false);
  const questionIdRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [organizerId, setOrganizerId] = useState(null);
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [answered, setAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isOrganizer = Boolean(user?.id && organizerId && user.id === organizerId);

  const applyQuestion = useCallback((question, reset = true) => {
    if (!question) return;
    const isNewQuestion = questionIdRef.current !== question.id;
    questionIdRef.current = question.id;
    setCurrentQuestion(question);
    if (reset || isNewQuestion) {
      setSelectedOptions([]);
      setAnswered(false);
      setAnswerResult(null);
      setTimeLeft(null);
      setTimeExpired(false);
    }
  }, []);

  const connectSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: !finishedRef.current,
    });

    socket.on('connect', () => {
      setConnected(true);
      setError('');
      socket.emit('join-room', { roomCode: code });
    });

    socket.on('room-joined', (data) => {
      setOrganizerId(data.organizerId);
      setSession(data.session);
      setParticipants(data.participants || []);
      if (data.currentQuestion) {
        applyQuestion(data.currentQuestion, true);
      }
    });

    socket.on('participants-updated', ({ participants: p }) => {
      if (p) setParticipants(p);
    });

    socket.on('quiz-started', (data) => {
      setSession(data.session);
      applyQuestion(data.currentQuestion, true);
      setLeaderboard(null);
    });

    socket.on('question-show', (question) => {
      applyQuestion(question, true);
    });

    socket.on('answer-result', (result) => {
      setAnswerResult(result);
      setAnswered(true);
      if (result.timedOut) setTimeExpired(true);
    });

    socket.on('quiz-finished', ({ leaderboard: lb }) => {
      finishedRef.current = true;
      socket.disconnect();
      setLeaderboard(lb);
      setCurrentQuestion(null);
      questionIdRef.current = null;
      setSession((s) => (s ? { ...s, status: 'finished' } : s));
    });

    socket.on('action-denied', ({ message }) => setNotice(message));
    socket.on('error', ({ message }) => setError(message));
    socket.on('connect_error', () => {
      if (!finishedRef.current) {
        setError('Ошибка подключения к серверу');
      }
    });

    socketRef.current = socket;
    return socket;
  }, [code, applyQuestion]);

  useEffect(() => {
    finishedRef.current = false;
    questionIdRef.current = null;
    const socket = connectSocket();
    return () => {
      if (socket) socket.disconnect();
    };
  }, [connectSocket, user?.id]);

  useEffect(() => {
    const startedAt = parseServerDate(currentQuestion?.started_at);
    const duration = currentQuestion?.time_per_question;
    if (!startedAt || !duration) return;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil(duration - elapsed / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setTimeExpired(true);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [currentQuestion]);

  useEffect(() => {
    if (!timeExpired || answered || !currentQuestion || isOrganizer) return;
    socketRef.current?.emit('reveal-answers', { questionId: currentQuestion.id });
  }, [timeExpired, answered, currentQuestion, isOrganizer]);

  const canAnswer = !isOrganizer && !answered && !timeExpired && timeLeft !== 0
    && session?.status === 'active' && currentQuestion;

  const toggleOption = (optionId) => {
    if (!canAnswer) return;
    const id = String(optionId);
    if (currentQuestion.choice_type === 'single') {
      setSelectedOptions([id]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const submitAnswer = () => {
    if (!canAnswer || selectedOptions.length === 0 || !socketRef.current) return;
    socketRef.current.emit('submit-answer', {
      questionId: currentQuestion.id,
      selectedOptionIds: selectedOptions,
    });
  };

  const startQuiz = () => {
    if (!isOrganizer) {
      setNotice('Только организатор может запустить квиз');
      return;
    }
    socketRef.current?.emit('start-quiz');
  };

  const nextQuestion = () => socketRef.current?.emit('next-question');

  if (leaderboard) {
    return (
      <div className="room-page">
        <div className="leaderboard-screen">
          <h1>🏆 Квиз завершён!</h1>
          <div className="leaderboard">
            {leaderboard.length === 0 ? (
              <p className="text-muted">Нет участников с баллами</p>
            ) : (
              leaderboard.map((entry, idx) => (
                <div key={entry.user_id} className={`leaderboard-row ${idx < 3 ? `place-${idx + 1}` : ''}`}>
                  <span className="place">{idx + 1}</span>
                  <span className="name">{entry.name}{entry.user_id === user.id ? ' (вы)' : ''}</span>
                  <span className="score">{entry.score} баллов</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-page">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!connected || !session) {
    return <div className="loading-screen">Подключение к комнате {code}...</div>;
  }

  return (
    <div className="room-page">
      <div className="room-header">
        <div className="room-info">
          <span className="room-code">Код: <strong>{code}</strong></span>
          <span className={`status-badge status-${session.status}`}>
            {session.status === 'waiting' ? 'Ожидание' : session.status === 'active' ? 'Идёт квиз' : 'Завершён'}
          </span>
          <span className="role-badge">{isOrganizer ? 'Организатор' : 'Участник'}</span>
        </div>
        <div className="participants-count">👥 {participants.length} участников</div>
      </div>

      {notice && <div className="alert alert-error">{notice}</div>}

      <div className="room-layout">
        <div className="room-main">
          {session.status === 'waiting' && (
            <div className="waiting-screen">
              <h2>Ожидание участников</h2>
              <p className="room-code-display">{code}</p>
              <p className="text-muted">Поделитесь кодом комнаты с участниками</p>
              {isOrganizer ? (
                <button type="button" className="btn btn-primary btn-lg" onClick={startQuiz}>
                  Начать квиз
                </button>
              ) : (
                <p>Ожидайте начала квиза...</p>
              )}
            </div>
          )}

          {session.status === 'active' && currentQuestion && (
            <div className="question-screen">
              <div className="question-progress">
                <span>Вопрос {currentQuestion.index + 1} из {currentQuestion.total}</span>
                <span className={`timer ${timeLeft !== null && timeLeft <= 5 ? 'timer-urgent' : ''}`}>
                  {timeLeft !== null ? `${timeLeft}с` : `${currentQuestion.time_per_question}с`}
                </span>
              </div>

              {currentQuestion.type === 'image' && currentQuestion.image_url && (
                <img src={currentQuestion.image_url} alt="Вопрос" className="question-image" />
              )}
              {currentQuestion.text && <h2 className="question-text">{currentQuestion.text}</h2>}
              <p className="question-meta">
                {currentQuestion.choice_type === 'single' ? 'Выберите один ответ' : 'Выберите несколько ответов'}
                · {currentQuestion.points} {currentQuestion.points === 1 ? 'балл' : 'баллов'}
              </p>

              {isOrganizer ? (
                <div className="answer-options answer-options-preview">
                  {currentQuestion.options.map((opt) => (
                    <div key={opt.id} className="answer-option preview">
                      {opt.text}
                    </div>
                  ))}
                  <p className="text-muted organizer-hint">Вы организатор — ответы отмечают только участники</p>
                </div>
              ) : (
                <>
                  <div className="answer-options">
                    {currentQuestion.options.map((opt) => {
                      const id = String(opt.id);
                      const isSelected = selectedOptions.includes(id);
                      const isLocked = answered || timeExpired;
                      const correctIds = (answerResult?.correctOptionIds || []).map(String);
                      const isCorrectOption = isLocked && correctIds.includes(id);
                      const isWrongSelected = answered && isSelected && !correctIds.includes(id);
                      return (
                        <div
                          key={id}
                          role="button"
                          tabIndex={isLocked ? -1 : 0}
                          className={[
                            'answer-option',
                            isSelected && canAnswer ? 'selected' : '',
                            isLocked ? 'locked' : '',
                            isCorrectOption ? 'correct-answer' : '',
                            isWrongSelected ? 'wrong-selected' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => canAnswer && toggleOption(id)}
                          onKeyDown={(e) => {
                            if (canAnswer && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              toggleOption(id);
                            }
                          }}
                        >
                          {currentQuestion.choice_type === 'multiple' && (
                            <span className="checkbox">{isSelected ? '☑' : '☐'}</span>
                          )}
                          {opt.text}
                        </div>
                      );
                    })}
                  </div>

                  {canAnswer && (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={submitAnswer}
                      disabled={selectedOptions.length === 0}
                    >
                      Ответить
                    </button>
                  )}

                  {answerResult?.timedOut && (
                    <div className="answer-feedback wrong">
                      ⏱ Время вышло. Правильный ответ выделен зелёным
                    </div>
                  )}

                  {answerResult && !answerResult.timedOut && (
                    <div className={`answer-feedback ${answerResult.isCorrect ? 'correct' : 'wrong'}`}>
                      {answerResult.isCorrect
                        ? `✓ Верно! +${answerResult.pointsEarned} баллов`
                        : '✗ Неверно. Правильный ответ выделен зелёным'}
                    </div>
                  )}
                </>
              )}

              {isOrganizer && (
                <button type="button" className="btn btn-primary btn-lg" onClick={nextQuestion}>
                  {currentQuestion.index + 1 >= currentQuestion.total ? 'Завершить квиз' : 'Следующий вопрос'}
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="room-sidebar">
          <h3>Участники</h3>
          {participants.length === 0 ? (
            <p className="text-muted sidebar-empty">Пока никого нет</p>
          ) : (
            <ul className="participants-list">
              {participants.map((p) => (
                <li key={p.user_id} className={p.user_id === user.id ? 'current-user' : ''}>
                  <span>{p.name}</span>
                  <span className="participant-score">{p.score}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
