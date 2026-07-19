import {
  completeLearningLesson,
  enrollFreeLearningCourse,
  getLearningCourse,
  listLearningCourses,
} from '@flove/supabase';
import { supabase } from '@/lib/supabase';

export const learningCoursesQueryKey = (userId?: string) => ['learning-courses', userId ?? 'signed-out'] as const;
export const learningCourseQueryKey = (userId: string | undefined, slug: string) => (
  ['learning-course', userId ?? 'signed-out', slug] as const
);

export function newCourseEnrollmentRequestId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `course_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadLearningCourses() {
  return listLearningCourses(supabase);
}

export function loadLearningCourse(slug: string) {
  return getLearningCourse(supabase, slug);
}

export function enrollInFreeCourse(courseId: string, clientRequestId: string) {
  return enrollFreeLearningCourse(supabase, courseId, clientRequestId);
}

export function finishLearningLesson(input: {
  courseId: string;
  lessonId: string;
  selectedAnswer: number;
  reflection?: string;
}) {
  return completeLearningLesson(supabase, input);
}
