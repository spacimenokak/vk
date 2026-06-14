import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const CATEGORIES = ['Общее', 'Наука', 'История', 'Спорт', 'Кино', 'Музыка', 'IT', 'География'];
const emptyQuestion = () => ({
  type: 'text',
  choice_type: 'single',
  text: '',
  image_url: '',
  points: 1,
  options: [
    { text: '', is_correct: true },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ],
});

export default function QuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Общее');
  const [timePerQuestion, setTimePerQuestion] = useState('30');
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.getQuiz(id)
      .then((quiz) => {
        setTitle(quiz.title);
        setDescription(quiz.description || '');
        setCategory(quiz.category || 'Общее');
        setTimePerQuestion(String(quiz.time_per_question || 30));
        setQuestions(
          quiz.questions.length > 0
            ? quiz.questions.map((q) => ({
                type: q.type,
                choice_type: q.choice_type,
                text: q.text || '',
                image_url: q.image_url || '',
                points: q.points || 1,
                options: q.options.map((o) => ({ text: o.text, is_correct: Boolean(o.is_correct) })),
              }))
            : [emptyQuestion()]
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateQuestion = (idx, field, value) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIdx, oIdx, field, value) => {
    const updated = [...questions];
    const opts = [...updated[qIdx].options];
    if (field === 'is_correct' && updated[qIdx].choice_type === 'single') {
      opts.forEach((o, i) => { opts[i] = { ...o, is_correct: i === oIdx }; });
    } else {
      opts[oIdx] = { ...opts[oIdx], [field]: value };
    }
    updated[qIdx] = { ...updated[qIdx], options: opts };
    setQuestions(updated);
  };

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);

  const removeQuestion = (idx) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const addOption = (qIdx) => {
    const updated = [...questions];
    updated[qIdx].options.push({ text: '', is_correct: false });
    setQuestions(updated);
  };

  const handleImageUpload = (qIdx, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateQuestion(qIdx, 'image_url', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) return setError('Укажите название квиза');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.type === 'text' && !q.text.trim()) return setError(`Вопрос ${i + 1}: введите текст`);
      if (q.type === 'image' && !q.image_url) return setError(`Вопрос ${i + 1}: загрузите изображение`);
      if (!q.options.some((o) => o.is_correct)) return setError(`Вопрос ${i + 1}: отметьте правильный ответ`);
      if (q.options.some((o) => !o.text.trim())) return setError(`Вопрос ${i + 1}: заполните все варианты`);
    }

    setSaving(true);
    try {
      const seconds = parseInt(timePerQuestion, 10);
      if (!seconds || seconds < 10 || seconds > 120) {
        return setError('Время на вопрос: от 10 до 120 секунд');
      }
      const data = { title, description, category, time_per_question: seconds, questions };
      if (isEdit) {
        await api.updateQuiz(id, data);
      } else {
        await api.createQuiz(data);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-screen">Загрузка...</div>;

  return (
    <div className="editor">
      <div className="editor-header">
        <h1>{isEdit ? 'Редактирование квиза' : 'Создание квиза'}</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="editor-section">
        <h2>Основные настройки</h2>
        <div className="form-row">
          <div className="form-group flex-2">
            <label>Название</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название квиза" />
          </div>
          <div className="form-group">
            <label>Категория</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Время на вопрос (сек)</label>
            <input
              type="text"
              inputMode="numeric"
              value={timePerQuestion}
              onChange={(e) => setTimePerQuestion(e.target.value.replace(/\D/g, ''))}
              placeholder="30"
            />
          </div>
        </div>
        <div className="form-group">
          <label>Описание</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Краткое описание квиза" />
        </div>
      </section>

      <section className="editor-section">
        <div className="section-header">
          <h2>Вопросы ({questions.length})</h2>
          <button className="btn btn-outline btn-sm" onClick={addQuestion}>+ Добавить вопрос</button>
        </div>

        {questions.map((q, qIdx) => (
          <div key={qIdx} className="question-card">
            <div className="question-card-header">
              <span className="question-number">Вопрос {qIdx + 1}</span>
              <div className="question-controls">
                <select value={q.type} onChange={(e) => updateQuestion(qIdx, 'type', e.target.value)}>
                  <option value="text">Текстовый</option>
                  <option value="image">С изображением</option>
                </select>
                <select value={q.choice_type} onChange={(e) => updateQuestion(qIdx, 'choice_type', e.target.value)}>
                  <option value="single">Один ответ</option>
                  <option value="multiple">Несколько ответов</option>
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  value={String(q.points)}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    updateQuestion(qIdx, 'points', v === '' ? '' : Math.min(10, Math.max(1, parseInt(v, 10))));
                  }}
                  onBlur={() => {
                    if (!q.points || q.points < 1) updateQuestion(qIdx, 'points', 1);
                  }}
                  className="points-input" title="Баллы"
                />
                {questions.length > 1 && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(qIdx)}>✕</button>
                )}
              </div>
            </div>

            {q.type === 'text' ? (
              <input
                className="question-text-input"
                value={q.text}
                onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
                placeholder="Текст вопроса"
              />
            ) : (
              <div className="image-upload">
                {q.image_url ? (
                  <div className="image-preview">
                    <img src={q.image_url} alt="Вопрос" />
                    <button className="btn btn-ghost btn-sm" onClick={() => updateQuestion(qIdx, 'image_url', '')}>Удалить</button>
                  </div>
                ) : (
                  <label className="upload-label">
                    📷 Загрузить изображение
                    <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(qIdx, e)} />
                  </label>
                )}
                <input
                  value={q.text}
                  onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
                  placeholder="Подпись к изображению (необязательно)"
                />
              </div>
            )}

            <div className="options-list">
              {q.options.map((opt, oIdx) => (
                <div key={oIdx} className="option-row">
                  <input
                    type={q.choice_type === 'single' ? 'radio' : 'checkbox'}
                    name={`q-${qIdx}`}
                    checked={opt.is_correct}
                    onChange={() => updateOption(qIdx, oIdx, 'is_correct', true)}
                  />
                  <input
                    value={opt.text}
                    onChange={(e) => updateOption(qIdx, oIdx, 'text', e.target.value)}
                    placeholder={`Вариант ${oIdx + 1}`}
                  />
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => addOption(qIdx)}>+ Вариант</button>
            </div>
          </div>
        ))}
      </section>

      <div className="editor-actions">
        <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>Отмена</button>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить квиз'}
        </button>
      </div>
    </div>
  );
}
