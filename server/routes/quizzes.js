import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

function getQuizWithQuestions(quizId) {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) return null;

  const questions = db.prepare(
    'SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index'
  ).all(quizId);

  const questionsWithOptions = questions.map((q) => {
    const options = db.prepare('SELECT id, text, is_correct FROM options WHERE question_id = ?').all(q.id);
    return { ...q, options };
  });

  return { ...quiz, questions: questionsWithOptions };
}

router.get('/', authMiddleware, (req, res) => {
  if (req.user.role === 'organizer') {
    const quizzes = db.prepare(
      'SELECT * FROM quizzes WHERE organizer_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    return res.json(quizzes);
  }
  res.json([]);
});

router.get('/:id', authMiddleware, (req, res) => {
  const quiz = getQuizWithQuestions(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (req.user.role !== 'organizer' || quiz.organizer_id !== req.user.id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(quiz);
});

router.post('/', authMiddleware, requireRole('organizer'), (req, res) => {
  const { title, description, category, time_per_question, questions } = req.body;
  if (!title) return res.status(400).json({ error: 'Укажите название квиза' });

  const quizId = uuid();
  db.prepare(
    'INSERT INTO quizzes (id, title, description, category, organizer_id, time_per_question) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(quizId, title, description || '', category || 'Общее', req.user.id, time_per_question || 30);

  if (Array.isArray(questions)) {
    const insertQuestion = db.prepare(
      'INSERT INTO questions (id, quiz_id, type, choice_type, text, image_url, points, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertOption = db.prepare(
      'INSERT INTO options (id, question_id, text, is_correct) VALUES (?, ?, ?, ?)'
    );

    questions.forEach((q, idx) => {
      const qId = uuid();
      insertQuestion.run(
        qId, quizId, q.type || 'text', q.choice_type || 'single',
        q.text || '', q.image_url || null, q.points || 1, idx
      );
      (q.options || []).forEach((opt) => {
        insertOption.run(uuid(), qId, opt.text, opt.is_correct ? 1 : 0);
      });
    });
  }

  res.status(201).json(getQuizWithQuestions(quizId));
});

router.put('/:id', authMiddleware, requireRole('organizer'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  const { title, description, category, time_per_question, questions } = req.body;
  db.prepare(
    'UPDATE quizzes SET title = ?, description = ?, category = ?, time_per_question = ? WHERE id = ?'
  ).run(title || quiz.title, description ?? quiz.description, category ?? quiz.category, time_per_question ?? quiz.time_per_question, req.params.id);

  if (Array.isArray(questions)) {
    const oldQuestions = db.prepare('SELECT id FROM questions WHERE quiz_id = ?').all(req.params.id);
    oldQuestions.forEach((q) => {
      db.prepare('DELETE FROM options WHERE question_id = ?').run(q.id);
    });
    db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(req.params.id);

    const insertQuestion = db.prepare(
      'INSERT INTO questions (id, quiz_id, type, choice_type, text, image_url, points, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const insertOption = db.prepare(
      'INSERT INTO options (id, question_id, text, is_correct) VALUES (?, ?, ?, ?)'
    );

    questions.forEach((q, idx) => {
      const qId = uuid();
      insertQuestion.run(
        qId, req.params.id, q.type || 'text', q.choice_type || 'single',
        q.text || '', q.image_url || null, q.points || 1, idx
      );
      (q.options || []).forEach((opt) => {
        insertOption.run(uuid(), qId, opt.text, opt.is_correct ? 1 : 0);
      });
    });
  }

  res.json(getQuizWithQuestions(req.params.id));
});

function deleteQuizCascade(quizId) {
  const sessions = db.prepare('SELECT id FROM quiz_sessions WHERE quiz_id = ?').all(quizId);
  for (const { id: sessionId } of sessions) {
    db.prepare('DELETE FROM answers WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM session_participants WHERE session_id = ?').run(sessionId);
  }
  db.prepare(
    'DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE quiz_id = ?)'
  ).run(quizId);
  db.prepare('DELETE FROM quiz_sessions WHERE quiz_id = ?').run(quizId);
  db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
}

router.delete('/:id', authMiddleware, requireRole('organizer'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Квиз не найден' });
  if (quiz.organizer_id !== req.user.id) return res.status(403).json({ error: 'Нет доступа' });

  try {
    db.exec('BEGIN IMMEDIATE');
    deleteQuizCascade(req.params.id);
    db.exec('COMMIT');
    res.json({ success: true });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Не удалось удалить квиз' });
  }
});

export default router;
