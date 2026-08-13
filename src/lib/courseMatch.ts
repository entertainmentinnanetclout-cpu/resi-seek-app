import { supabase } from "@/integrations/supabase/client";
import { saveProgrammeCheckHistory } from "@/lib/courseMatchHistory";

export interface CourseMatchSubject {
  name: string;
  mark: number;
}

export type CourseMatchInstitution = "tut" | "unisa" | "up";

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
    tut_rule_scope?: string;
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

export interface InstitutionCourseMatchResult extends CourseMatchResult {
  institution: CourseMatchInstitution;
}

type CourseMatchRpc = "course_match_tut" | "course_match_unisa" | "course_match_up";
type SaveCourseMatchRpc = "save_tut_course_match" | "save_unisa_course_match" | "save_up_course_match";

const MATCH_RPCS: Record<CourseMatchInstitution, CourseMatchRpc> = {
  tut: "course_match_tut",
  unisa: "course_match_unisa",
  up: "course_match_up",
};

const SAVE_RPCS: Record<CourseMatchInstitution, SaveCourseMatchRpc> = {
  tut: "save_tut_course_match",
  unisa: "save_unisa_course_match",
  up: "save_up_course_match",
};

const runRpc = async (
  rpcName: CourseMatchRpc,
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
): Promise<CourseMatchResult[]> => {
  const { data, error } = await (supabase as any).rpc(rpcName, {
    p_student_aps: studentAps,
    p_subjects: subjects,
    p_include_non_matches: includeNonMatches,
  });

  if (error) throw error;
  return (data ?? []) as CourseMatchResult[];
};

const saveRpc = async (
  rpcName: SaveCourseMatchRpc,
  studentAps: number,
  subjects: CourseMatchSubject[],
  fullName?: string | null,
): Promise<string | null> => {
  const { data, error } = await (supabase as any).rpc(rpcName, {
    p_student_aps: studentAps,
    p_subjects: subjects,
    p_full_name: fullName ?? null,
  });

  if (error) throw error;
  return (data as string | null) ?? null;
};

export const runTutCourseMatch = (
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
) => runRpc("course_match_tut", studentAps, subjects, includeNonMatches);

export const saveTutCourseMatch = (
  studentAps: number,
  subjects: CourseMatchSubject[],
  fullName?: string | null,
) => saveRpc("save_tut_course_match", studentAps, subjects, fullName);

export const runUnisaCourseMatch = (
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
) => runRpc("course_match_unisa", studentAps, subjects, includeNonMatches);

export const saveUnisaCourseMatch = (
  studentAps: number,
  subjects: CourseMatchSubject[],
  fullName?: string | null,
) => saveRpc("save_unisa_course_match", studentAps, subjects, fullName);

export const runUpCourseMatch = (
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
) => runRpc("course_match_up", studentAps, subjects, includeNonMatches);

export const saveUpCourseMatch = (
  studentAps: number,
  subjects: CourseMatchSubject[],
  fullName?: string | null,
) => saveRpc("save_up_course_match", studentAps, subjects, fullName);

export const runCourseMatch = (
  institution: CourseMatchInstitution,
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
) => runRpc(MATCH_RPCS[institution], studentAps, subjects, includeNonMatches);

export const runCourseMatchAcross = async (
  institutions: CourseMatchInstitution[],
  studentAps: number,
  subjects: CourseMatchSubject[],
  includeNonMatches = false,
): Promise<InstitutionCourseMatchResult[]> => {
  const batches = await Promise.all(
    institutions.map(async (institution) => {
      const rows = await runCourseMatch(institution, studentAps, subjects, includeNonMatches);
      return rows.map((row) => ({
        ...row,
        match_status:
          subjects.length === 0 &&
          row.match_status === "not_eligible_subject" &&
          row.subject_match_summary?.aps_pass
            ? "eligible_with_conditional_curriculum_check"
            : row.match_status,
        institution,
      }));
    }),
  );

  const results = batches.flat();
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    try {
      await saveProgrammeCheckHistory({
        userId: authData.user.id,
        institutionType: "university",
        scope: institutions.map((institution) => institution.toUpperCase()),
        highestGrade: "Grade 12 / NSC",
        aps: studentAps,
        subjects,
        results: results.map((row) => ({
          programme_id: row.programme_id,
          programme_requirement_id: row.programme_requirement_id,
          status: row.match_status,
          aps_required: row.aps_required,
          summary: row.subject_match_summary,
          missing: row.missing_requirements,
          matched: row.matched_requirements,
          context: {
            institution: row.institution,
            qualification_code: row.qualification_code,
            programme_name: row.programme_name,
            qualification_type: row.qualification_type,
            faculty_or_school: row.faculty_or_school,
            official_url: row.official_url,
            entry_route: row.entry_route,
          },
        })),
      });
    } catch (historyError) {
      console.warn("University Course Match results could not be added to history", historyError);
    }
  }

  return results;
};

export const saveCourseMatch = (
  institution: CourseMatchInstitution,
  studentAps: number,
  subjects: CourseMatchSubject[],
  fullName?: string | null,
) => saveRpc(SAVE_RPCS[institution], studentAps, subjects, fullName);

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
 * The field remains editable because institutions can apply additional
 * programme-specific scoring, ranking and selection rules.
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