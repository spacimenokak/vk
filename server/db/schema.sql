CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('participant', 'organizer')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  organizer_id TEXT NOT NULL,
  time_per_question INTEGER DEFAULT 30,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('text', 'image')),
  choice_type TEXT NOT NULL CHECK(choice_type IN ('single', 'multiple')),
  text TEXT,
  image_url TEXT,
  points INTEGER DEFAULT 1,
  order_index INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  text TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  room_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'finished')),
  current_question_index INTEGER DEFAULT -1,
  question_started_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_option_ids TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  answered_at TEXT DEFAULT (datetime('now')),
  UNIQUE(session_id, user_id, question_id),
  FOREIGN KEY (session_id) REFERENCES quiz_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE INDEX IF NOT EXISTS idx_quizzes_organizer ON quizzes(organizer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room ON quiz_sessions(room_code);
