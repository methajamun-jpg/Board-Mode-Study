import accountancy from './accountancy.json';
import businessStudies from './business-studies.json';
import economics from './economics.json';
import english from './english.json';
import physicalEducation from './physical-education.json';
import type { Chapter, StudyFlashcard, StudyQuestion, SubjectData, SubjectId } from './types';

export const subjectCatalog: SubjectData[] = [
  accountancy,
  economics,
  businessStudies,
  english,
  physicalEducation,
] as SubjectData[];

export const subjects = subjectCatalog.map(({ id, name, short, color }) => ({ id, name, short, color }));

export const subjectById = Object.fromEntries(subjectCatalog.map((subject) => [subject.id, subject])) as Record<SubjectId, SubjectData>;

export type CatalogFlashcard = StudyFlashcard & {
  subjectId: SubjectId;
  subject: string;
  chapterId: string;
  chapter: string;
};

export type CatalogQuestion = StudyQuestion & {
  subjectId: SubjectId;
  subject: string;
  chapterId: string;
  chapter: string;
};

export const allChapters = subjectCatalog.flatMap((subject) =>
  subject.chapters.map((chapter) => ({ ...chapter, subjectId: subject.id, subject: subject.name, color: subject.color })),
);

export const allFlashcards: CatalogFlashcard[] = subjectCatalog.flatMap((subject) =>
  subject.chapters.flatMap((chapter) =>
    chapter.flashcards.map((card) => ({ ...card, subjectId: subject.id, subject: subject.name, chapterId: chapter.id, chapter: chapter.title })),
  ),
);

export const allQuestions: CatalogQuestion[] = subjectCatalog.flatMap((subject) =>
  subject.chapters.flatMap((chapter) =>
    chapter.questions.map((question) => ({ ...question, subjectId: subject.id, subject: subject.name, chapterId: chapter.id, chapter: chapter.title })),
  ),
);

export const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());