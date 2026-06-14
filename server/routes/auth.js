import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import db from '../db/database.js';
import { signToken, authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  if (!['participant', 'organizer'].includes(role)) {
    return res.status(400).json({ error: 'Некорректная роль' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const id = uuid();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email, password_hash, name, role);

  const user = { id, email, name, role };
  res.status(201).json({ user, token: signToken(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, token: signToken(safeUser) });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(user);
});

export default router;
