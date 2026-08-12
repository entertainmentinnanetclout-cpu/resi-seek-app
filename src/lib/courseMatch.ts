import { supabase } from "@/integrations/supabase/client";

export interface CourseMatchSubject {
  name: string;
  mark: number;
}

export type CourseMatchStatus =
  | "eligible"
  | "academic_minimum_selection_required"
  | "eligible_with_conditional_curriculum_check"
  | "not_eligible_aps"
  | "not_eligible_subject";

export interface CourseMatchResult {
  programme_id: string;
  programme_requirement_id: string;
  qualification_code: string;
  programme_name: string;
  qualification_type: string;
  faculty_or_school: string | null;
  aps_required: number;
  match_status: CourseMatchStatus;
  subject_match_summary: {
    aps_pass?: boolean;
    required_subjects_pass?: boolean;
    alternative_groups_pass?: boolean;
    unmet_conditional_count?: number;
    selection_rule_count?: number;
  };
  missing_requirements: Array<Record<string, unknown>>;
  matched_requirements: Array<Record<string, unknown>>;
  selection_rules: Array<{
    rule_type?: string;
    label?: string | null;
    detail?: string;
    qa_status?: string;
  }>;
  official_url: string | null;
  entry_route: string;
}

export const runUnisaCourseMatch = async (
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
): Promise<CourseMatchResult[]> => {
  const { data, error } = await (supabase as any).rpc("course_match_unisa", {
    p_student_aps: studentAps,
    p_subjects: subjects,
    p_include_non_matches: includeNonMatches,
  });

  if (error) throw error;
  return (data ?? []) as CourseMatchResult[];
};

export const saveUnisaCourseMatch = async (
  studentAps: number,
  subjects: CourseMatchSubject[],
  fullName?: string | null,
): Promise<string | null> => {
  const { data, error } = await (supabase as any).rpc("save_unisa_course_match", {
    p_student_aps: studentAps,
    p_subjects: subjects,
    p_full_name: fullName ?? null,
  });

  if (error) throw error;
  return (data as string | null) ?? null;
};

export const nscAchievementLevel = (mark: number): number => {
  if (mark >= 80) return 7;
  if (mark >= 70) return 6;
  if (mark >= 60) return 5;
  if (mark >= 50) return 4;
  if (mark >= 40) return 3;
  if (mark >= 30) return 2;
  return mark > 0 ? 1 : 0;
};

/**
 * Guidance-only APS estimate used to prefill the Course Match APS field.
 * It sums the six strongest non-Life-Orientation NSC achievement levels.
 * The field remains editable because institutions can use different scoring
 * and UNISA's final selection process is broader than this academic estimate.
 */
export const estimateAcademicAps = (subjects: CourseMatchSubject[]): number => {
  return subjects
    .filter((subject) => {
      const normalized = subject.name.trim().toLowerCase();
      return subject.mark > 0 && !normalized.includes("life orientation");
    })
    .map((subject) => nscAchievementLevel(subject.mark))
    .sort((a, b) => b - a)
    .slice(0, 6)
    .reduce((total, level) => total + level, 0);
};
