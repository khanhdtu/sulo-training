import { get, post } from '@/lib/request';

export interface StartChapterResponse {
  progress: {
    id: number;
    status: string;
    progress: number;
    completedSections: number;
    totalSections: number;
    lastAccessedAt: string | null;
  };
}

export interface ExerciseQuestion {
  id: number;
  question: string;
  options: any; // JSONB - array for multiple choice
  points: number;
  order: number;
  hint: string | null;
}

export interface ChapterExercise {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  points: number;
  timeLimit: number | null;
  order: number;
  sectionId: number;
  sectionName: string;
  questions: ExerciseQuestion[];
  attempt: {
    exerciseId: number;
    isCompleted: boolean;
    score: number | null;
    totalPoints: number;
    completedAt: string | null;
  } | null;
  isCompleted: boolean;
}

export interface ChapterResponse {
  chapter: {
    id: number;
    name: string;
    description: string | null;
    order: number;
    subject: {
      id: number;
      name: string;
      gradeId: number;
      grade: {
        id: number;
        name: string;
        level: number;
      };
    };
  };
  exercises: ChapterExercise[];
  currentExercise: ChapterExercise | null;
  currentExerciseIndex: number | null;
  totalExercises: number;
  completedExercises: number;
  chapterProgress: {
    status: string;
    progress: number;
    completedSections: number;
    totalSections: number;
  } | null;
}

export const chapterRepository = {
  /**
   * Start learning a chapter (create progress record)
   */
  async startChapter(chapterId: number): Promise<StartChapterResponse> {
    return post<StartChapterResponse>(`/api/chapters/${chapterId}/start`, {});
  },

  /**
   * Get chapter with exercises
   */
  async getChapterById(chapterId: number): Promise<ChapterResponse> {
    return get<ChapterResponse>(`/api/chapters/${chapterId}`);
  },
};

