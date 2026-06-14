import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quizzes.js';
import sessionRoutes from './routes/sessions.js';
import { setupQuizSocket } from './socket/quizHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:4173'], credentials: true },
});

const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use((err, _req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const clientDist = join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

setupQuizSocket(io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} уже занят. Закройте другой процесс или задайте PORT=3002`);
    process.exit(1);
  }
  throw err;
});
