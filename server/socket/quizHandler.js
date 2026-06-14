import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'quiz-platform-secret-key-change-in-production';

function toIsoUtc(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('T')) return dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`;
  return `${dateStr.replace(' ', 'T')}Z`;
}

function getSessionState(sessionId) {
  const session = db.prepare(`
    SELECT s.*, q.title, q.time_per_question, q.organizer_id
    FROM quiz_sessions s
    JOIN quizzes q ON q.id = s.quiz_id
    WHERE s.id = ?
  `).get(sessionId);
  if (!session) return null;

  const participants = db.prepare(`
    SELECT sp.user_id, sp.score, u.name
    FROM session_participants sp
    JOIN users u ON u.id = sp.user_id
    WHERE sp.session_id = ?
    ORDER BY sp.score DESC, u.name ASC
  `).all(sessionId);

  const questions = db.prepare(
    'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index'
  ).all(session.quiz_id);

  let currentQuestion = null;
  if (session.current_question_index >= 0 && session.current_question_index < questions.length) {
    const q = questions[session.current_question_index];
    const options = db.prepare('SELECT id, text FROM options WHERE question_id = ?').all(q.id);
    currentQuestion = {
      index: session.current_question_index,
      total: questions.length,
      id: q.id,
      type: q.type,
      choice_type: q.choice_type,
      text: q.text,
      image_url: q.image_url,
      points: q.points,
      options,
      time_per_question: session.time_per_question,
      started_at: toIsoUtc(session.question_started_at),
    };
  }

  return { session, participants, questions, currentQuestion, organizerId: session.organizer_id };
}

function isQuestionTimeExpired(session) {
  if (!session.question_started_at) return false;
  const quiz = db.prepare('SELECT time_per_question FROM quizzes WHERE id = ?').get(session.quiz_id);
  const startedAt = Date.parse(toIsoUtc(session.question_started_at));
  if (!startedAt || !quiz?.time_per_question) return false;
  return Date.now() - startedAt > quiz.time_per_question * 1000;
}

function getCorrectOptionIds(questionId) {
  return db.prepare(
    'SELECT id FROM options WHERE question_id = ? AND is_correct = 1'
  ).all(questionId).map((o) => o.id);
}

function checkAnswer(questionId, selectedIds) {
  const correctOptions = getCorrectOptionIds(questionId);
  const sortedSelected = [...selectedIds].sort();
  const sortedCorrect = [...correctOptions].sort();

  if (sortedSelected.length !== sortedCorrect.length) return false;
  return sortedSelected.every((id, i) => id === sortedCorrect[i]);
}

function requireOrganizer(socket) {
  if (!socket.sessionId || !socket.isOrganizer) {
    socket.emit('action-denied', { message: 'Только организатор может выполнить это действие' });
    return false;
  }
  return true;
}

function broadcastParticipants(io, roomCode, sessionId) {
  const state = getSessionState(sessionId);
  if (!state) return;
  io.to(roomCode).emit('participants-updated', {
    participants: state.participants,
  });
}

export function setupQuizSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Требуется авторизация'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomCode }) => {
      const session = db.prepare(
        "SELECT * FROM quiz_sessions WHERE room_code = ? AND status != 'finished'"
      ).get(roomCode?.toUpperCase());

      if (!session) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }

      const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(session.quiz_id);
      const isOrganizer = quiz.organizer_id === socket.user.id;

      if (!isOrganizer) {
        const existing = db.prepare(
          'SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?'
        ).get(session.id, socket.user.id);

        if (!existing) {
          db.prepare(
            'INSERT INTO session_participants (id, session_id, user_id) VALUES (?, ?, ?)'
          ).run(uuid(), session.id, socket.user.id);
        }
      }

      socket.sessionId = session.id;
      socket.roomCode = session.room_code;
      socket.isOrganizer = isOrganizer;
      socket.join(session.room_code);

      const state = getSessionState(session.id);
      socket.emit('room-joined', {
        ...state,
        isOrganizer,
        userId: socket.user.id,
      });

      broadcastParticipants(io, session.room_code, session.id);
    });

    socket.on('start-quiz', () => {
      if (!requireOrganizer(socket)) return;

      db.prepare(
        "UPDATE quiz_sessions SET status = 'active', started_at = datetime('now'), current_question_index = 0, question_started_at = datetime('now') WHERE id = ?"
      ).run(socket.sessionId);

      const state = getSessionState(socket.sessionId);
      io.to(socket.roomCode).emit('quiz-started', state);
      io.to(socket.roomCode).emit('question-show', state.currentQuestion);
    });

    socket.on('next-question', () => {
      if (!requireOrganizer(socket)) return;

      const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(socket.sessionId);
      const questions = db.prepare(
        'SELECT id FROM questions WHERE quiz_id = ? ORDER BY order_index'
      ).all(session.quiz_id);

      const nextIndex = session.current_question_index + 1;
      if (nextIndex >= questions.length) {
        db.prepare(
          "UPDATE quiz_sessions SET status = 'finished', finished_at = datetime('now') WHERE id = ?"
        ).run(socket.sessionId);

        const leaderboard = db.prepare(`
          SELECT sp.score, u.name, u.id as user_id
          FROM session_participants sp
          JOIN users u ON u.id = sp.user_id
          WHERE sp.session_id = ?
          ORDER BY sp.score DESC, u.name ASC
        `).all(socket.sessionId);

        io.to(socket.roomCode).emit('quiz-finished', { leaderboard });
        return;
      }

      db.prepare(
        'UPDATE quiz_sessions SET current_question_index = ?, question_started_at = datetime(\'now\') WHERE id = ?'
      ).run(nextIndex, socket.sessionId);

      const state = getSessionState(socket.sessionId);
      io.to(socket.roomCode).emit('question-show', state.currentQuestion);
    });

    socket.on('submit-answer', ({ questionId, selectedOptionIds }) => {
      if (!socket.sessionId || socket.isOrganizer) return;

      const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(socket.sessionId);
      if (session.status !== 'active') return;

      const questions = db.prepare(
        'SELECT id FROM questions WHERE quiz_id = ? ORDER BY order_index'
      ).all(session.quiz_id);
      const currentQ = questions[session.current_question_index];
      if (!currentQ || currentQ.id !== questionId) return;

      const existing = db.prepare(
        'SELECT id FROM answers WHERE session_id = ? AND user_id = ? AND question_id = ?'
      ).get(socket.sessionId, socket.user.id, questionId);
      if (existing) return;

      if (isQuestionTimeExpired(session)) {
        socket.emit('answer-result', {
          isCorrect: false,
          pointsEarned: 0,
          correctOptionIds: getCorrectOptionIds(questionId),
          timedOut: true,
        });
        return;
      }

      const question = db.prepare('SELECT points FROM questions WHERE id = ?').get(questionId);
      const isCorrect = checkAnswer(questionId, selectedOptionIds || []);
      const pointsEarned = isCorrect ? question.points : 0;

      db.prepare(
        'INSERT INTO answers (id, session_id, user_id, question_id, selected_option_ids, is_correct, points_earned) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuid(), socket.sessionId, socket.user.id, questionId, JSON.stringify(selectedOptionIds || []), isCorrect ? 1 : 0, pointsEarned);

      if (pointsEarned > 0) {
        db.prepare(
          'UPDATE session_participants SET score = score + ? WHERE session_id = ? AND user_id = ?'
        ).run(pointsEarned, socket.sessionId, socket.user.id);
      }

      socket.emit('answer-result', {
        isCorrect,
        pointsEarned,
        correctOptionIds: getCorrectOptionIds(questionId),
      });
      broadcastParticipants(io, socket.roomCode, socket.sessionId);
    });

    socket.on('reveal-answers', ({ questionId }) => {
      if (!socket.sessionId || socket.isOrganizer) return;

      const session = db.prepare('SELECT * FROM quiz_sessions WHERE id = ?').get(socket.sessionId);
      if (session.status !== 'active' || !isQuestionTimeExpired(session)) return;

      const questions = db.prepare(
        'SELECT id FROM questions WHERE quiz_id = ? ORDER BY order_index'
      ).all(session.quiz_id);
      const currentQ = questions[session.current_question_index];
      if (!currentQ || currentQ.id !== questionId) return;

      const existing = db.prepare(
        'SELECT id FROM answers WHERE session_id = ? AND user_id = ? AND question_id = ?'
      ).get(socket.sessionId, socket.user.id, questionId);
      if (existing) return;

      socket.emit('answer-result', {
        isCorrect: false,
        pointsEarned: 0,
        correctOptionIds: getCorrectOptionIds(questionId),
        timedOut: true,
      });
    });

    socket.on('get-state', () => {
      if (!socket.sessionId) return;
      const state = getSessionState(socket.sessionId);
      socket.emit('room-state', { ...state, isOrganizer: socket.isOrganizer, userId: socket.user.id });
    });

    socket.on('disconnect', () => {
      if (socket.roomCode && socket.sessionId) {
        broadcastParticipants(io, socket.roomCode, socket.sessionId);
      }
    });
  });
}
