export type SubjectId =
  | 'accountancy'
  | 'economics'
  | 'business-studies'
  | 'english'
  | 'physical-education';

export type QuestionType = 'MCQ' | 'Short' | 'Long' | 'Numerical';

export type StudyQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

export type StudyFlashcard = {
  id: string;
  front: string;
  back: string;
};

export type Chapter = {
  id: string;
  title: string;
  weight: 'High' | 'Medium' | 'Foundation';
  estimatedMinutes: number;
  topics: string[];
  flashcards: StudyFlashcard[];
  questions: StudyQuestion[];
};

export type SubjectData = {
  id: SubjectId;
  name: string;
  short: string;
  color: string;
  chapters: Chapter[];
};