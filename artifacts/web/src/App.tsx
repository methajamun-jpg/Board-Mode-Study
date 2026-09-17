import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Flame,
  Gauge,
  Home,
  Layers3,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  Zap,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  allChapters,
  allFlashcards,
  allQuestions,
  subjectById,
  subjects,
  todayLabel,
  type CatalogFlashcard,
  type CatalogQuestion,
} from '@/data/catalog';
import type { Chapter, QuestionType, SubjectId } from '@/data/types';

type Setter<T> = Dispatch<SetStateAction<T>>;
type Confidence = 'New' | 'Again' | 'Review soon' | 'Easy';
type SessionMode = 'theory' | 'flashcards' | 'MCQ' | 'Short' | 'Numerical';

type PlanItem = {
  id: string;
  chapterId: string;
  subjectId: SubjectId;
  subject: string;
  chapter: string;
  focus: string;
  minutes: number;
  done: boolean;
};

type PlanDay = {
  id: string;
  date: string;
  label: string;
  minutes: number;
  items: PlanItem[];
};

type UserFlashcard = CatalogFlashcard & {
  confidence: Confidence;
  due: boolean;
  interval: string;
  reviews: number;
};

type Mistake = {
  id: string;
  questionId: string;
  prompt: string;
  subjectId: SubjectId;
  subject: string;
  chapterId: string;
  chapter: string;
  type: QuestionType;
  answer: string;
  explanation: string;
};

type Preferences = {
  selectedSubjectIds: SubjectId[];
  target: string;
  hours: number;
};

type ProgressMap = Record<string, number>;
type QuizScore = { correct: number; attempted: number };

const queryClient = new QueryClient();
const subjectIds = subjects.map((subject) => subject.id);
const dayMs = 24 * 60 * 60 * 1000;

function dateInputPlus(days: number) {
  const date = new Date(Date.now() + days * dayMs);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return 'Choose a date';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`board-mode-v2-${key}`);
      return saved ? JSON.parse(saved) as T : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    localStorage.setItem(`board-mode-v2-${key}`, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function makeDefaultProgress(): ProgressMap {
  const seed = [54, 36, 62, 48, 41, 28, 56, 33, 72, 38];
  return Object.fromEntries(allChapters.map((chapter, index) => [chapter.id, seed[index] ?? 26]));
}

const defaultPreferences: Preferences = {
  selectedSubjectIds: ['accountancy', 'economics', 'business-studies'],
  target: dateInputPlus(14),
  hours: 2.5,
};

const defaultProgress = makeDefaultProgress();

function makeFlashcardState(): UserFlashcard[] {
  return allFlashcards.map((card, index) => ({
    ...card,
    confidence: 'New',
    due: index < 8,
    interval: 'new',
    reviews: 0,
  }));
}

function createSchedule(preferences: Preferences, progress: ProgressMap): PlanDay[] {
  const selected = preferences.selectedSubjectIds.length ? preferences.selectedSubjectIds : subjectIds.slice(0, 2);
  const targetDate = new Date(`${preferences.target || dateInputPlus(14)}T12:00:00`);
  const requestedDays = Math.ceil((targetDate.getTime() - Date.now()) / dayMs) + 1;
  const dayCount = Math.max(1, Math.min(14, requestedDays));
  const chapters = allChapters
    .filter((chapter) => selected.includes(chapter.subjectId))
    .sort((a, b) => (progress[a.id] ?? 0) - (progress[b.id] ?? 0));
  const days = Math.max(1, Math.min(dayCount, chapters.length));
  const chaptersPerDay = Math.max(1, Math.ceil(chapters.length / days));
  const focusLabels = ['theory + notes', 'flashcard recall', 'PYQ application'];

  return Array.from({ length: days }, (_, index) => {
    const items = chapters.slice(index * chaptersPerDay, (index + 1) * chaptersPerDay).map((chapter, itemIndex) => ({
      id: `${chapter.id}-${index}`,
      chapterId: chapter.id,
      subjectId: chapter.subjectId,
      subject: chapter.subject,
      chapter: chapter.title,
      focus: focusLabels[(index + itemIndex) % focusLabels.length],
      minutes: Math.round(chapter.estimatedMinutes / Math.max(1, chaptersPerDay)),
      done: (progress[chapter.id] ?? 0) >= 100,
    }));
    return {
      id: `day-${index}`,
      date: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : `Day ${index + 1}`,
      label: formatDate(new Date(Date.now() + index * dayMs).toISOString().slice(0, 10)),
      minutes: Math.round(preferences.hours * 60),
      items,
    };
  });
}

function getSubjectProgress(subjectId: SubjectId, progress: ProgressMap) {
  const chapters = subjectById[subjectId].chapters;
  return Math.round(chapters.reduce((sum, chapter) => sum + (progress[chapter.id] ?? 0), 0) / chapters.length);
}

function Brand() {
  return <Link to="/" className="brand-mark" data-testid="link-brand"><span className="brand-symbol">B</span><span>board mode</span></Link>;
}

const navItems = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/planner', label: 'Planner', icon: CalendarDays },
  { href: '/session', label: 'Session', icon: TimerReset },
  { href: '/flashcards', label: 'Cards', icon: Layers3 },
  { href: '/quiz', label: 'PYQ', icon: Brain },
];

function Navigation() {
  const { pathname } = useLocation();
  return <>
    <aside className="desktop-nav">
      <Brand />
      <nav className="desktop-links">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} to={href} className={`desktop-link ${pathname === href ? 'active' : ''}`}><Icon size={16} /><span>{label}</span></Link>)}
        <Link to="/progress" className={`desktop-link ${pathname === '/progress' ? 'active' : ''}`}><Gauge size={16} /><span>Progress</span></Link>
      </nav>
      <div className="desktop-foot"><span className="eyebrow">CBSE · CLASS XII</span><br />A quieter way to get exam-ready.</div>
    </aside>
    <nav className="bottom-nav">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} to={href} className={`bottom-link ${pathname === href ? 'active' : ''}`}><Icon size={17} /><span>{label}</span></Link>)}
      <Link to="/progress" className={`bottom-link ${pathname === '/progress' ? 'active' : ''}`}><Gauge size={17} /><span>Progress</span></Link>
    </nav>
  </>;
}

function AppShell({ children }: { children: ReactNode }) {
  return <div className="app-frame"><Navigation /><main className="page-wrap"><div className="mobile-top"><Brand /><span className="pill"><span className="status-dot" />Focus mode</span></div>{children}</main></div>;
}

function PageHead({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <header className="page-head reveal"><div className="welcome-row"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div></header>;
}

function SubjectRow({ subjectId, progress }: { subjectId: SubjectId; progress: number }) {
  const subject = subjectById[subjectId];
  return <div className="subject-row"><span className="subject-chip" style={{ background: subject.color }}>{subject.short}</span><div><div className="subject-name">{subject.name}</div><div className="subject-detail">{progress >= 70 ? 'Strong pace' : progress >= 50 ? 'In motion' : 'Needs attention'}</div></div><span className="subject-percent" style={{ color: subject.color }}>{progress}%</span><div className="subject-bar"><span style={{ width: `${progress}%`, background: subject.color }} /></div></div>;
}

function Dashboard({ plan, progress, mistakes, sessions, preferences, onToggleTask }: { plan: PlanDay[]; progress: ProgressMap; mistakes: Mistake[]; sessions: number; preferences: Preferences; onToggleTask: (id: string) => void }) {
  const today = plan[0];
  const allTasks = plan.flatMap((day) => day.items);
  const done = allTasks.filter((item) => item.done).length;
  const overall = Math.round(allChapters.reduce((sum, chapter) => sum + (progress[chapter.id] ?? 0), 0) / allChapters.length);
  const weakChapter = [...allChapters].sort((a, b) => (progress[a.id] ?? 0) - (progress[b.id] ?? 0))[0];

  return <><PageHead eyebrow={todayLabel} title="Make today count." subtitle="A real board for the chapters, cards and questions that move you toward exam day." action={<div className="date-stamp">{overall}%<br />READY</div>} /><div className="grid dashboard-grid">
    <section className="surface today-card reveal"><div className="today-kicker">Today’s board</div><h2>{today ? `${today.items.length} focused move${today.items.length === 1 ? '' : 's'} before lunch.` : 'Set your runway first.'}</h2><p>{today ? `Start with ${today.items[0]?.chapter ?? 'your next chapter'} while your attention is fresh.` : 'Choose subjects, a target date and daily hours to generate your syllabus.'}</p><div className="today-footer"><div className="today-progress"><div className="progress-line"><span style={{ width: `${allTasks.length ? (done / allTasks.length) * 100 : 0}%` }} /></div><small>{done} of {allTasks.length} tasks complete · {sessions} sessions logged</small></div><span className="progress-number">{overall}%</span></div></section>
    <section className="quick-grid reveal"><Link to="/session" className="quick-action"><Play className="quick-icon" size={18} /><span>Next up</span><strong>Start session</strong></Link><Link to="/flashcards" className="quick-action"><Layers3 className="quick-icon teal-text" size={18} /><span>{plan.flatMap((day) => day.items).length + 2} cards due</span><strong>Review cards</strong></Link><Link to="/quiz" className="quick-action"><Brain className="quick-icon coral-text" size={18} /><span>{allQuestions.length} questions</span><strong>Take a PYQ</strong></Link><Link to="/planner" className="quick-action"><CalendarDays className="quick-icon" size={18} /><span>Target date</span><strong>{formatDate(preferences.target)}</strong></Link></section>
    <section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Your subjects</h2><span className="section-meta">syllabus completion</span></div><Link to="/progress" className="button button-ghost">View all <ChevronRight size={14} /></Link></div><div className="subjects-list">{subjects.map((subject) => <SubjectRow key={subject.id} subjectId={subject.id} progress={getSubjectProgress(subject.id, progress)} />)}</div></section>
    <section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Today’s plan</h2><span className="section-meta">tap to check off</span></div><Link to="/planner" className="button button-ghost">Edit <ChevronRight size={14} /></Link></div><div className="stack">{today?.items.map((item) => <button type="button" className={`plan-item ${item.done ? 'done' : ''}`} key={item.id} onClick={() => onToggleTask(item.id)}><span className="plan-check">{item.done && <Check size={12} />}</span><span className="plan-copy"><strong>{item.chapter}</strong><small>{item.focus} · {item.minutes} min</small></span><span className="section-meta" style={{ color: subjectById[item.subjectId].color }}>{subjectById[item.subjectId].short}</span></button>)}</div></section>
    <section className="surface surface-pad wide reveal"><div className="section-head"><div><h2 className="section-title">Weak chapter to lift</h2><span className="section-meta">adaptive priority</span></div><span className="pill"><Target size={13} /> {weakChapter ? `${progress[weakChapter.id] ?? 0}% touched` : 'Start planning'}</span></div>{weakChapter ? <div className="weak-feature"><div><strong>{weakChapter.title}</strong><span>{weakChapter.subject} · {weakChapter.weight} weight · {weakChapter.estimatedMinutes} min</span></div><Link to="/session" className="button button-quiet">Study now <ChevronRight size={14} /></Link></div> : null}{mistakes.length > 0 && <div className="activity-row"><span className="activity-dot" style={{ background: 'hsl(var(--accent))' }} /><div className="activity-copy">Mistake Bank is holding <strong>{mistakes.length} questions</strong><span>Use a second pass to turn misses into marks.</span></div><Link to="/progress" className="section-meta">OPEN</Link></div>}</section>
  </div></>;
}

function Planner({ preferences, setPreferences, plan, progress, onGenerate, onToggleTask }: { preferences: Preferences; setPreferences: Setter<Preferences>; plan: PlanDay[]; progress: ProgressMap; onGenerate: () => void; onToggleTask: (id: string) => void }) {
  const toggleSubject = (subjectId: SubjectId) => setPreferences((current) => ({ ...current, selectedSubjectIds: current.selectedSubjectIds.includes(subjectId) ? current.selectedSubjectIds.filter((id) => id !== subjectId) : [...current.selectedSubjectIds, subjectId] }));
  const scheduledChapters = new Set(plan.flatMap((day) => day.items.map((item) => item.chapterId)));
  return <><PageHead eyebrow="Your syllabus, in motion" title="Crash planner" subtitle="Choose your subjects, give yourself a runway, and Board Mode will distribute real chapters into achievable days." /><div className="grid planner-layout"><section className="surface surface-pad reveal"><div className="form-grid"><div><label className="field-label">Subjects in this sprint <span className="field-note">{preferences.selectedSubjectIds.length}/5 chosen</span></label><div className="subject-select-grid">{subjects.map((subject) => <button type="button" key={subject.id} className={`subject-toggle ${preferences.selectedSubjectIds.includes(subject.id) ? 'selected' : ''}`} onClick={() => toggleSubject(subject.id)}><span><span style={{ color: subject.color, marginRight: 8 }}>●</span>{subject.name}</span><span className="check">{preferences.selectedSubjectIds.includes(subject.id) && <Check size={12} />}</span></button>)}</div></div><div><label className="field-label" htmlFor="target-date">Target completion date</label><input id="target-date" className="text-input" type="date" value={preferences.target} onChange={(event) => setPreferences((current) => ({ ...current, target: event.target.value }))} /></div><div><label className="field-label" htmlFor="study-hours">Daily study hours <span className="field-note">focused time only</span></label><div className="range-row"><input id="study-hours" className="range-input" type="range" min="1" max="8" step=".5" value={preferences.hours} onChange={(event) => setPreferences((current) => ({ ...current, hours: Number(event.target.value) }))} /><span className="range-value">{preferences.hours} hrs</span></div></div><div className="planner-callout"><Sparkles size={15} /><span>The schedule prioritises chapters with the lowest completion first, then rotates theory, recall and PYQ practice.</span></div><button type="button" className="button button-primary" onClick={onGenerate}><Sparkles size={15} /> Generate chapter schedule</button></div></section><section className="plan-list stack reveal"><div className="section-head"><div><h2 className="section-title">Adaptive syllabus</h2><span className="section-meta">{scheduledChapters.size} chapters mapped · {preferences.hours}h / day</span></div><span className="pill"><Target size={13} /> {formatDate(preferences.target)}</span></div>{plan.map((day) => <div className="plan-day" key={day.id}><div className="plan-day-head"><div><div className="plan-day-name">{day.date}</div><div className="plan-day-date">{day.label}</div></div><span className="plan-time">{Math.floor(day.minutes / 60)}h {day.minutes % 60 ? `${day.minutes % 60}m` : ''}</span></div>{day.items.map((item) => <button type="button" className={`plan-item ${item.done ? 'done' : ''}`} key={item.id} onClick={() => onToggleTask(item.id)}><span className="plan-check">{item.done && <Check size={12} />}</span><span className="plan-copy"><strong>{item.chapter}</strong><small>{item.subject} · {item.focus}</small></span><span className="section-meta" style={{ color: subjectById[item.subjectId].color }}>{progress[item.chapterId] ?? 0}%</span></button>)}</div>)}</section></div></>;
}

function QuestionRunner({ question, onMistake, onCorrect, onNext, compact = false }: { question: CatalogQuestion; onMistake?: (question: CatalogQuestion) => void; onCorrect?: () => void; onNext?: () => void; compact?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [checked, setChecked] = useState(false);
  const isCorrect = question.type === 'MCQ' ? selected === question.answer : answerText.trim().toLowerCase().includes(question.answer.toLowerCase());
  const checkAnswer = () => {
    if (checked) {
      onNext?.();
      return;
    }
    setChecked(true);
    if (isCorrect) onCorrect?.();
    else onMistake?.(question);
  };
  return <section className={`surface quiz-card ${compact ? 'compact-question' : ''}`}><div className="question-type">{question.type} · {question.subject}<span className="question-number">{question.chapter}</span></div><div className="question-text">{question.prompt}</div>{question.options.length ? <div className="answer-grid">{question.options.map((option) => <button type="button" key={option} className={`answer-option ${selected === option ? 'selected' : ''} ${checked && option === question.answer ? 'correct' : ''} ${checked && selected === option && selected !== question.answer ? 'incorrect' : ''}`} onClick={() => !checked && setSelected(option)}><span className="option-letter">{String.fromCharCode(65 + question.options.indexOf(option))}</span>{option}</button>)}</div> : <textarea className="answer-field" value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder={question.type === 'Numerical' ? 'Write your working and final answer…' : 'Draft your answer in key points…'} disabled={checked} />}{checked && <div className={`feedback ${isCorrect ? 'good' : 'bad'}`}><span>{isCorrect ? <Check size={16} /> : <CircleAlert size={16} />}</span><span><strong>{isCorrect ? 'Good recall.' : 'Saved to Mistake Bank.'}</strong><br />{question.explanation}</span></div>}<div className="quiz-footer"><span className="section-meta">{checked ? (isCorrect ? 'added to your wins' : 'keep this one visible') : 'no timer · think clearly'}</span><button type="button" className="button button-primary" onClick={checkAnswer} disabled={!checked && ((question.type === 'MCQ' && !selected) || (question.type !== 'MCQ' && !answerText.trim()))}>{checked ? <>Next question <ChevronRight size={15} /></> : <>Check answer <Check size={15} /></>}</button></div></section>;
}

function Session({ plan, flashcards, setFlashcards, seconds, setSeconds, sessions, onFinish, onMistake, onCompleteChapter }: { plan: PlanDay[]; flashcards: UserFlashcard[]; setFlashcards: Setter<UserFlashcard[]>; seconds: number; setSeconds: Setter<number>; sessions: number; onFinish: (chapterId: string) => void; onMistake: (question: CatalogQuestion) => void; onCompleteChapter: (chapterId: string) => void }) {
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<SessionMode>('theory');
  const [flipped, setFlipped] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const currentChapter = allChapters.find((chapter) => chapter.id === plan[0]?.items[0]?.chapterId) ?? allChapters[0];
  const chapterQuestions = allQuestions.filter((question) => question.chapterId === currentChapter.id && (mode === 'MCQ' || mode === 'Short' || mode === 'Numerical' ? question.type === mode : true));
  const sessionQuestions = chapterQuestions.length ? chapterQuestions : allQuestions.filter((question) => question.type === mode);
  const currentQuestion = sessionQuestions[questionIndex % Math.max(1, sessionQuestions.length)];
  const currentCard = currentChapter.flashcards[cardIndex % currentChapter.flashcards.length];
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [running, setSeconds]);
  const finish = () => { setRunning(false); onFinish(currentChapter.id); setSeconds(0); };
  const rateSessionCard = (confidence: Confidence) => {
    const interval = confidence === 'Again' ? '10 min' : confidence === 'Review soon' ? 'tomorrow' : '4 days';
    setFlashcards((current) => current.map((card) => card.id === currentCard.id ? { ...card, confidence, interval, due: confidence === 'Again', reviews: card.reviews + 1 } : card));
    setFlipped(false);
    setCardIndex((index) => index + 1);
  };
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  const modes: { id: SessionMode; label: string; icon: ReactNode }[] = [{ id: 'theory', label: 'Theory', icon: <BookOpen size={14} /> }, { id: 'flashcards', label: 'Cards', icon: <Layers3 size={14} /> }, { id: 'MCQ', label: 'MCQs', icon: <Brain size={14} /> }, { id: 'Short', label: 'Short', icon: <ListChecks size={14} /> }, { id: 'Numerical', label: 'Numerical', icon: <Target size={14} /> }];
  return <><PageHead eyebrow="One chapter, five ways in" title="Study session" subtitle="Move through theory, recall and exam practice without leaving the chapter you are building." /><div className="grid session-layout"><section className="surface session-shell reveal"><div className="session-label">{running ? 'In focus' : seconds ? 'Paused' : 'Ready when you are'}</div><div className={`timer ${running ? 'running' : ''}`}>{mins}:{secs}</div><div className="session-caption">{currentChapter.title} · {currentChapter.subject}</div><div className="session-actions"><button type="button" className="button button-primary" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pause' : 'Start focus'}</button>{seconds > 0 && <button type="button" className="button button-quiet" onClick={finish}><Check size={15} /> Finish</button>}</div></section><div className="stack"><div className="session-stat-grid reveal"><div className="session-stat"><strong>{sessions}</strong><span>sessions logged</span></div><div className="session-stat"><strong>{Math.floor(seconds / 60)}m</strong><span>this session</span></div><div className="session-stat"><strong>{currentChapter.weight}</strong><span>chapter weight</span></div></div><section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Study modes</h2><span className="section-meta">{currentChapter.title}</span></div><Clock3 size={17} className="teal-text" /></div><div className="mode-tabs">{modes.map((item) => <button type="button" key={item.id} className={`mode-tab ${mode === item.id ? 'active' : ''}`} onClick={() => { setMode(item.id); setFlipped(false); setQuestionIndex(0); }}>{item.icon}{item.label}</button>)}</div>{mode === 'theory' && <div className="mode-panel"><div className="section-meta">CORE THEORY</div><ul className="topic-list">{currentChapter.topics.map((topic) => <li key={topic}><span className="topic-check"><Check size={12} /></span>{topic}</li>)}</ul><button type="button" className="button button-primary" onClick={() => onCompleteChapter(currentChapter.id)}>Mark chapter touched <Check size={15} /></button></div>}{mode === 'flashcards' && <div className="mode-panel session-card-panel"><div className={`session-flip-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((value) => !value)}><div className="session-card-face"><span className="section-meta">{currentChapter.subject} · card {cardIndex + 1}</span><strong>{currentCard.front}</strong><small>tap to reveal</small></div><div className="session-card-face session-card-back"><span className="section-meta">RECALL NOTE</span><strong>{currentCard.back}</strong><small>how did that feel?</small></div></div><div className="confidence-row"><button type="button" className="confidence-button hard" onClick={() => rateSessionCard('Again')}>Again<br /><span>10 min</span></button><button type="button" className="confidence-button review" onClick={() => rateSessionCard('Review soon')}>Review<br /><span>tomorrow</span></button><button type="button" className="confidence-button easy" onClick={() => rateSessionCard('Easy')}>Easy<br /><span>4 days</span></button></div></div>}{(mode === 'MCQ' || mode === 'Short' || mode === 'Numerical') && currentQuestion && <div className="mode-panel"><QuestionRunner key={currentQuestion.id} question={currentQuestion} onMistake={onMistake} onNext={() => setQuestionIndex((index) => index + 1)} compact /></div>}</section><div className="planner-callout"><Sparkles size={15} /><span>Finish with one line of recall. It makes tomorrow’s restart easier.</span></div></div></div></>;
}

function Flashcards({ flashcards, setFlashcards }: { flashcards: UserFlashcard[]; setFlashcards: Setter<UserFlashcard[]> }) {
  const dueCards = flashcards.filter((card) => card.due);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = dueCards[index % Math.max(1, dueCards.length)];
  const rate = (confidence: Confidence) => {
    if (!card) return;
    const interval = confidence === 'Again' ? '10 min' : confidence === 'Review soon' ? 'tomorrow' : '4 days';
    setFlashcards((current) => current.map((item) => item.id === card.id ? { ...item, confidence, interval, due: confidence === 'Again', reviews: item.reviews + 1 } : item));
    setFlipped(false);
    setIndex((current) => current + 1);
  };
  return <><PageHead eyebrow="Recall beats rereading" title="Flashcards" subtitle="A spaced repetition shelf built from the same chapters you are studying today." action={<span className="pill"><Layers3 size={13} /> {dueCards.length} due now</span>} /><div className="flash-layout stack"><section className="flashcard-wrap reveal">{card ? <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((value) => !value)}><div className="flash-face"><div className="flash-top"><span>{card.subject} · {card.chapter}</span><span>tap to flip</span></div><div className="flash-content">{card.front}</div><div className="flash-bottom"><span>Card {index + 1} of {Math.max(1, dueCards.length)}</span><RotateCcw size={15} /></div></div><div className="flash-face flash-back"><div className="flash-top"><span>Recall note</span><span>{card.confidence}</span></div><div className="flash-content">{card.back}</div><div className="flash-bottom"><span>Next interval · {card.interval}</span><span className="teal-text">flip back</span></div></div></div> : <div className="surface empty-state"><Check size={25} /><strong>All caught up.</strong><p>Your due cards are clear. Come back for another pass tomorrow.</p></div>}</section>{card && <section className="reveal"><div className="section-head"><h2 className="section-title">Set the next interval</h2><span className="section-meta">saved automatically</span></div><div className="confidence-row"><button type="button" className="confidence-button hard" onClick={() => rate('Again')}><strong>Again</strong><br /><span>10 min</span></button><button type="button" className="confidence-button review" onClick={() => rate('Review soon')}><strong>Review</strong><br /><span>tomorrow</span></button><button type="button" className="confidence-button easy" onClick={() => rate('Easy')}><strong>Easy</strong><br /><span>4 days</span></button></div></section>}<section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Card shelf</h2><span className="section-meta">{flashcards.length} prompts from your syllabus</span></div><span className="pill">{flashcards.filter((item) => !item.due).length} stable</span></div>{flashcards.map((item) => <div className="activity-row" key={item.id}><span className="activity-dot" style={{ background: subjectById[item.subjectId].color, boxShadow: `0 0 0 4px ${subjectById[item.subjectId].color}18` }} /><div className="activity-copy">{item.front}<span>{item.subject} · {item.chapter} · next: {item.interval}</span></div>{item.due ? <span className="section-meta accent-text">due</span> : <Check size={14} className="teal-text" />}</div>)}</section></div></>;
}

function Quiz({ mistakes, score, setScore, onMistake }: { mistakes: Mistake[]; score: QuizScore; setScore: Setter<QuizScore>; onMistake: (question: CatalogQuestion) => void }) {
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [type, setType] = useState<QuestionType | 'All'>('All');
  const [questionIndex, setQuestionIndex] = useState(0);
  const chapters = subjectFilter === 'all' ? allChapters : allChapters.filter((chapter) => chapter.subjectId === subjectFilter);
  const filtered = allQuestions.filter((question) => (subjectFilter === 'all' || question.subjectId === subjectFilter) && (chapterFilter === 'all' || question.chapterId === chapterFilter) && (type === 'All' || question.type === type));
  const question = filtered[questionIndex % Math.max(1, filtered.length)];
  const resetFilters = () => { setQuestionIndex(0); };
  const handleCorrect = () => setScore((current) => ({ correct: current.correct + 1, attempted: current.attempted + 1 }));
  const handleMistake = (value: CatalogQuestion) => { setScore((current) => ({ ...current, attempted: current.attempted + 1 })); onMistake(value); };
  return <><PageHead eyebrow="Chapter-wise previous year practice" title="PYQ quiz" subtitle="Filter by subject and chapter, then make the mark scheme familiar one question at a time." action={<div className="score-block"><strong>{score.correct}/{score.attempted}</strong><span>running score</span></div>} /><div className="quiz-layout stack"><section className="surface surface-pad reveal"><div className="filter-grid"><label className="field-label">Subject<select className="select-input" value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value as SubjectId | 'all'); setChapterFilter('all'); resetFilters(); }}><option value="all">All subjects</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label><label className="field-label">Chapter<select className="select-input" value={chapterFilter} onChange={(event) => { setChapterFilter(event.target.value); resetFilters(); }}><option value="all">All chapters</option>{chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</select></label></div><div className="quiz-tabs">{(['All', 'MCQ', 'Short', 'Long', 'Numerical'] as const).map((tab) => <button type="button" key={tab} className={`quiz-tab ${type === tab ? 'active' : ''}`} onClick={() => { setType(tab); resetFilters(); }}>{tab}</button>)}</div></section>{question ? <QuestionRunner key={question.id} question={question} onMistake={handleMistake} onCorrect={handleCorrect} onNext={() => setQuestionIndex((current) => current + 1)} /> : <div className="surface empty-state"><CircleAlert size={25} /><strong>No questions match that filter.</strong><p>Choose a broader chapter or subject to keep practicing.</p></div>}<section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Mistake Bank</h2><span className="section-meta">{mistakes.length} questions waiting for a second pass</span></div><Link to="/progress" className="button button-ghost">Review all <ChevronRight size={14} /></Link></div>{mistakes.slice(-3).map((mistake) => <div className="mistake-row" key={mistake.id}><span className="mistake-index">!</span><div className="mistake-copy"><div className="mistake-question">{mistake.prompt}</div><div className="mistake-meta">{mistake.subject} · {mistake.chapter} · {mistake.type}</div></div></div>)}</section></div></>;
}

function Progress({ progress, mistakes, setMistakes, sessions, streak }: { progress: ProgressMap; mistakes: Mistake[]; setMistakes: Setter<Mistake[]>; sessions: number; streak: number }) {
  const overall = Math.round(allChapters.reduce((sum, chapter) => sum + (progress[chapter.id] ?? 0), 0) / allChapters.length);
  const weakChapters = [...allChapters].filter((chapter) => (progress[chapter.id] ?? 0) < 60).sort((a, b) => (progress[a.id] ?? 0) - (progress[b.id] ?? 0));
  const removeMistake = (id: string) => setMistakes((current) => current.filter((mistake) => mistake.id !== id));
  return <><PageHead eyebrow="The long view" title="Progress" subtitle="See the full syllabus, find your weak chapters, and turn every miss into a useful next move." /><div className="grid progress-layout"><div className="stats-grid"><div className="metric-card reveal"><Flame size={17} className="coral-text" /><span className="metric-value">{streak.toString().padStart(2, '0')}</span><span className="metric-label">day streak</span></div><div className="metric-card reveal"><Clock3 size={17} className="teal-text" /><span className="metric-value">{sessions}</span><span className="metric-label">sessions logged</span></div><div className="metric-card reveal"><Trophy size={17} className="accent-text" /><span className="metric-value">{overall}%</span><span className="metric-label">syllabus complete</span></div><div className="metric-card streak-card reveal"><Zap size={17} className="coral-text" /><span className="metric-value">{mistakes.length}</span><span className="metric-label">weak spots saved</span></div></div><section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Subject pulse</h2><span className="section-meta">completion by syllabus</span></div><Gauge size={17} className="accent-text" /></div><div className="subjects-list">{subjects.map((subject) => <SubjectRow subjectId={subject.id} progress={getSubjectProgress(subject.id, progress)} key={subject.id} />)}</div></section><section className="surface surface-pad reveal"><div className="section-head"><div><h2 className="section-title">Weak chapters</h2><span className="section-meta">prioritised by completion</span></div><Target size={17} className="accent-text" /></div><div className="weak-list">{weakChapters.slice(0, 5).map((chapter) => <div className="weak-item" key={chapter.id}><div><strong>{chapter.title}</strong><span>{chapter.subject} · {chapter.weight} weight</span></div><span className="subject-percent" style={{ color: chapter.color }}>{progress[chapter.id] ?? 0}%</span></div>)}</div></section><section className="surface surface-pad reveal" style={{ gridColumn: '1 / -1' }}><div className="section-head"><div><h2 className="section-title">Mistake Bank</h2><span className="section-meta">saved incorrect questions</span></div><CircleAlert size={17} className="coral-text" /></div>{mistakes.length ? mistakes.map((mistake) => <div className="mistake-row" key={mistake.id}><span className="mistake-index">!</span><div className="mistake-copy"><div className="mistake-question">{mistake.prompt}</div><div className="mistake-meta">{mistake.subject} · {mistake.chapter} · answer cue: {mistake.answer}</div></div><button type="button" className="button button-quiet" onClick={() => removeMistake(mistake.id)}>Clear</button></div>) : <div className="empty-state"><Check size={26} /><strong>Nothing hiding here.</strong><p>Answer a PYQ incorrectly and it will appear here for a calmer second look.</p><Link to="/quiz" className="button button-primary" style={{ marginTop: 17 }}>Try a question</Link></div>}</section></div></>;
}

function Router() {
  const [preferences, setPreferences] = usePersisted<Preferences>('preferences', defaultPreferences);
  const [progress, setProgress] = usePersisted<ProgressMap>('progress', defaultProgress);
  const [plan, setPlan] = usePersisted<PlanDay[]>('plan', createSchedule(defaultPreferences, defaultProgress));
  const [flashcards, setFlashcards] = usePersisted<UserFlashcard[]>('flashcards', makeFlashcardState());
  const [mistakes, setMistakes] = usePersisted<Mistake[]>('mistakes', []);
  const [seconds, setSeconds] = usePersisted('session-seconds', 0);
  const [sessions, setSessions] = usePersisted('sessions-completed', 12);
  const [streak] = usePersisted('streak', 7);
  const [score, setScore] = usePersisted<QuizScore>('quiz-score', { correct: 8, attempted: 10 });
  const { pathname } = useLocation();

  const toggleTask = (id: string) => {
    setPlan((current) => current.map((day) => ({ ...day, items: day.items.map((item) => item.id === id ? { ...item, done: !item.done } : item) })));
    const task = plan.flatMap((day) => day.items).find((item) => item.id === id);
    if (task) setProgress((current) => ({ ...current, [task.chapterId]: task.done ? Math.max(0, (current[task.chapterId] ?? 0) - 20) : Math.min(100, (current[task.chapterId] ?? 0) + 20) }));
  };
  const completeChapter = (chapterId: string) => setProgress((current) => ({ ...current, [chapterId]: 100 }));
  const finishSession = (chapterId: string) => {
    setSessions((current) => current + 1);
    setProgress((current) => ({ ...current, [chapterId]: Math.min(100, Math.max(current[chapterId] ?? 0, (current[chapterId] ?? 0) + 12)) }));
    setPlan((current) => current.map((day, dayIndex) => dayIndex === 0 ? { ...day, items: day.items.map((item, itemIndex) => itemIndex === 0 ? { ...item, done: true } : item) } : day));
  };
  const addMistake = (question: CatalogQuestion) => setMistakes((current) => current.some((mistake) => mistake.questionId === question.id) ? current : [...current, { id: `${question.id}-${Date.now()}`, questionId: question.id, prompt: question.prompt, subjectId: question.subjectId, subject: question.subject, chapterId: question.chapterId, chapter: question.chapter, type: question.type, answer: question.answer, explanation: question.explanation }]);
  const generatePlan = () => setPlan(createSchedule(preferences, progress));
  const currentPlan = useMemo(() => plan.length ? plan : createSchedule(preferences, progress), [plan, preferences, progress]);

  return <AppShell><ErrorBoundary resetKey={pathname}><Routes><Route path="/" element={<Dashboard plan={currentPlan} progress={progress} mistakes={mistakes} sessions={sessions} preferences={preferences} onToggleTask={toggleTask} />} /><Route path="/planner" element={<Planner preferences={preferences} setPreferences={setPreferences} plan={currentPlan} progress={progress} onGenerate={generatePlan} onToggleTask={toggleTask} />} /><Route path="/session" element={<Session plan={currentPlan} flashcards={flashcards} setFlashcards={setFlashcards} seconds={seconds} setSeconds={setSeconds} sessions={sessions} onFinish={finishSession} onMistake={addMistake} onCompleteChapter={completeChapter} />} /><Route path="/flashcards" element={<Flashcards flashcards={flashcards} setFlashcards={setFlashcards} />} /><Route path="/quiz" element={<Quiz mistakes={mistakes} score={score} setScore={setScore} onMistake={addMistake} />} /><Route path="/progress" element={<Progress progress={progress} mistakes={mistakes} setMistakes={setMistakes} sessions={sessions} streak={streak} />} /><Route path="*" element={<Dashboard plan={currentPlan} progress={progress} mistakes={mistakes} sessions={sessions} preferences={preferences} onToggleTask={toggleTask} />} /></Routes></ErrorBoundary></AppShell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></BrowserRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;