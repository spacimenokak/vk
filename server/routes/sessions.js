import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const existing = db.prepare('SELECT id FROM quiz_sessions WHERE room_code = ? AND status != ?').get(code, 'finished');
  if (existing) return generateRoomCode();
  return code;
}

router.post('/start', authMiddleware, requireRole('organizer'), (req, res) => {
  const { quiz_id } = req.body;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quiz_id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  const questions = db.prepare('SELECT id FROM questions WHERE quiz_id = ?').all(quiz_id);
  if (questions.length === 0) return res.status(400).json({ error: 'Добавьте вопросы в квиз' });

  const sessionId = uuid();
  const roomCode = generateRoomCode();
  db.prepare(
    'INSERT INTO quiz_sessions (id, quiz_id, room_code, status) VALUES (?, ?, ?, ?)'
  ).run(sessionId, quiz_id, roomCode, 'waiting');

  res.status(201).json({ session_id: sessionId, room_code: roomCode, quiz_id });
});

router.get('/history', authMiddleware, (req, res) => {
  if (req.user.role === 'organizer') {
    const sessions = db.prepare(`
      SELECT s.*, q.title as quiz_title, q.category,
        (SELECT COUNT(*) FROM session_participants WHERE session_id = s.id) as participants_count
      FROM quiz_sessions s
      JOIN quizzes q ON q.id = s.quiz_id
      WHERE q.organizer_id = ?
      ORDER BY COALESCE(s.started_at, s.id) DESC
    `).all(req.user.id);
    return res.json(sessions);
  }

  const sessions = db.prepare(`
    SELECT s.*, q.title as quiz_title, q.category, sp.score, sp.joined_at
    FROM session_participants sp
    JOIN quiz_sessions s ON s.id = sp.session_id
    JOIN quizzes q ON q.id = s.quiz_id
    WHERE sp.user_id = ?
    ORDER BY sp.joined_at DESC
  `).all(req.user.id);
  res.json(sessions);
});

router.get('/room/:code', authMiddleware, (req, res) => {
  const session = db.prepare(`
    SELECT s.*, q.title, q.description, q.category, q.time_per_question
    FROM quiz_sessions s
    JOIN quizzes q ON q.id = s.quiz_id
    WHERE s.room_code = ? AND s.status != 'finished'
  `).get(req.params.code.toUpperCase());

  if (!session) return res.status(404).json({ error: 'Комната не найдена или квиз завершён' });
  res.json(session);
});

export default router;
