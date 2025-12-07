import { get } from '@/lib/request';

export interface Grade {
  id: number;
  name: string;
  level: number;
}

export interface Lesson {
  id: number;
  title: string;
  type: string;
  mediaUrl?: string | null;
  order: number;
  progress?: {
    status: string;
    progress: number;
    lastAccessedAt?: string | null;
    completedAt?: string | null;
  } | null;
  status: string;
}

export interface Exercise {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  type: string;
  points: number;
  timeLimit?: number | null;
  order: number;
  attempt?: {
    score?: number | null;
    totalPoints: number;
    isCompleted: boolean;
    status?: string; // draft, submitted, completed
    completedAt?: string | null;
  } | null;
  status: string;
}

export interface Section {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  lessons: Lesson[];
  exercises: Exercise[];
}

export interface Chapter {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  sections: Section[];
  progress?: {
    status: string;
    progress: number;
    completedSections?: number;
    totalSections?: number;
    completedExercises?: number;
    totalExercises?: number;
    correctQuestions?: number;
    totalQuestions?: number;
    lastAccessedAt?: string | null;
    completedAt?: string | null;
  } | null;
}

export interface Subject {
  id: number;
  name: string;
  description?: string | null;
  grade: Grade;
  chapters: Chapter[];
}

export interface SubjectListItem {
  id: number;
  name: string;
  description?: string | null;
  order: number;
  gradeId: number;
}

export const subjectRepository = {
  /**
   * Get all subjects for a grade
   */
  async getSubjects(gradeId?: number): Promise<{ subjects: SubjectListItem[] }> {
    const url = gradeId ? `/api/subjects?gradeId=${gradeId}` : '/api/subjects';
    return get<{ subjects: SubjectListItem[] }>(url);
  },

  /**
   * Get subject by ID with full curriculum and progress
   */
  async getSubjectById(id: number): Promise<{ subject: Subject }> {
    return get<{ subject: Subject }>(`/api/subjects/${id}`);
  },
};

