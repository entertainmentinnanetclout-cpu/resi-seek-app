import type { CourseMatchSubject, TvetHighestLevel } from "@/lib/tvetCourseMatch";

export type RuleSubject = { label: string; aliases: string[]; min?: number; appliesTo?: TvetHighestLevel[] };
export type RuleGroup = { label: string; options: Array<{ aliases: string[]; min?: number }>; appliesTo?: TvetHighestLevel[] };
export type TvetRule = {
  accepted: TvetHighestLevel[];
  subjects: RuleSubject[];
  groups?: RuleGroup[];
  manual?: boolean;
  note?: string;
  source: string;
  year: number;
};

const TNC = "https://www.tnc.edu.za/programmes";
const TSC = "https://www.tsc.edu.za/programmes";
const G9: TvetHighestLevel[] = ["grade9","grade10","grade11","grade12","ncv4","n4","n5","n6"];
const G12: TvetHighestLevel[] = ["grade12","ncv4","n4","n5","n6"];
const english = (min?: number): RuleSubject => ({ label: "English", aliases: ["English Home Language","English First Additional Language","English FAL","English"], ...(min == null ? {} : { min }) });
const maths = (min?: number): RuleSubject => ({ label: "Mathematics", aliases: ["Mathematics","Technical Mathematics"], ...(min == null ? {} : { min }) });
const science = (min?: number): RuleSubject => ({ label: "Physical Science", aliases: ["Physical Sciences","Physical Science"], ...(min == null ? {} : { min }) });
const rule = (accepted: TvetHighestLevel[], subjects: RuleSubject[], extra: Partial<TvetRule> = {}): TvetRule => ({ accepted, subjects, groups: extra.groups ?? [], manual: extra.manual ?? false, note: extra.note, source: extra.source ?? TNC, year: 2026 });

export const normalizedSubject = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const markForAliases = (subjects: CourseMatchSubject[], aliases: string[]) => {
  const targets = aliases.map(normalizedSubject);
  let best: number | null = null;
  subjects.forEach((subject) => {
    const name = normalizedSubject(subject.name);
    const matches = targets.some((target) => name === target || (target === "english" && name.startsWith("english ")));
    if (matches && subject.mark > 0) best = best == null ? subject.mark : Math.max(best, subject.mark);
  });
  return best;
};

export const tncRule = (name: string, qualificationType: string): TvetRule => {
  const q = qualificationType.toLowerCase();
  if (q.includes("nated") && q.includes("n5")) {
    if (["Financial Management","Business Management"].includes(name)) return rule(G12,[english(40),{label:"Accounting",aliases:["Accounting"],min:30}]);
    if (["Art and Design","Clothing Production"].includes(name)) return rule(G12,[english(50)]);
    if (name === "Public Relations") return rule(G12,[english(50)],{note:"Computer or typing-related subjects at 30%+ are an advantage."});
    if (["Management Assistant","Legal Secretary"].includes(name)) return rule(G12,[english(40)],{note:"Computer or typing-related subjects at 30%+ are an advantage."});
    if (name === "Public Management") return rule(G12,[english(40)],{note:"A Business Studies-related subject at 30%+ is an advantage."});
    if (name === "Tourism") return rule(G12,[english(50),{label:"Tourism",aliases:["Tourism"],min:50}],{groups:[{label:"Accounting / Mathematics / Mathematical Literacy",options:[{aliases:["Accounting"],min:30},{aliases:["Mathematics","Technical Mathematics"],min:30},{aliases:["Mathematical Literacy","Maths Literacy"],min:30}]}]});
    if (name === "Hospitality & Catering Services") return rule(G12,[english(40)],{groups:[{label:"Consumer Studies / Home Economics / Hospitality Studies",options:[{aliases:["Consumer Studies"],min:40},{aliases:["Home Economics"],min:40},{aliases:["Hospitality Studies"],min:40}]}]});
  }
  if (q.includes("nated") && q.includes("n4")) {
    const scienceMin = ["Fitting","Boiler Making"].includes(name) ? 30 : 40;
    return rule(G12,[science(scienceMin)],{groups:[{label:"Mathematics / Technical Mathematics / Mathematical Literacy",options:[{aliases:["Mathematics","Technical Mathematics"],min:40},{aliases:["Mathematical Literacy","Maths Literacy"],min:40}]}]});
  }
  if (q.includes("nc(v)")) {
    if (["Electrical Infrastructure Construction","I.T and Computer Science","Engineering and Related Design","Civil Engineering and Building Construction"].includes(name)) return rule(G9,[maths(),english()],{manual:true,note:"The current TNC page requires these subjects to be passed but does not publish numeric percentages."});
    if (name === "Mechatronics") return rule(G9,[maths(),science()],{manual:true,note:"TNC requires Mathematics and Physical Science; numeric percentages are not published on the current page."});
    return rule(G9,[{label:"Social Science",aliases:["Social Science","Social Sciences"]},english()],{manual:true,note:"The current TNC page requires these subjects to be passed but does not publish numeric percentages."});
  }
  if (name === "Pre-learning Programme (PLP)") return rule(G9,[maths(),english()],{manual:true,note:"TNC lists Mathematics and English without numeric percentages on the current page."});
  return rule(G9,[],{manual:true,note:"Programme-level entry requirements require official TNC confirmation."});
};

export const tscRule = (name: string, qualificationType: string): TvetRule => {
  const q = qualificationType.toLowerCase();
  if (["Marketing L2–L4","Office Administration L2–L4"].includes(name)) return rule(G9,[maths(20),{label:"Economic & Management Sciences",aliases:["Economic and Management Sciences","Economic & Management Sciences","EMS"],min:40}],{source:TSC,manual:true,note:"TSC publishes Mathematics in a 20–30% range; the official route must confirm the applicable threshold."});
  if (name === "Civil & Construction L2–L3") return rule(G9,[maths(30),{label:"Natural Science",aliases:["Natural Sciences","Natural Science"],min:40}],{source:TSC});
  if (name === "Civil Engineering N4–N6") return rule(G12,[{...maths(),appliesTo:["grade12"]},{...science(),appliesTo:["grade12"]}],{source:TSC,manual:true,note:"Grade 12 applicants require Mathematics and Physical Sciences; NC(V) Level 4 is also an entry route. Numeric thresholds require official confirmation."});
  if (name === "Management Assistant N5–N6") return rule(G12,[],{source:TSC});
  if (name === "Natural Sciences — Electrical & Civil Engineering") return rule(["grade12"],[maths(30),{label:"Science",aliases:["Physical Sciences","Physical Science","Natural Sciences","Natural Science"],min:30}],{source:TSC,manual:true,note:"The current TSC page states 30% or 40% as required; the applicable threshold must be confirmed."});
  if (q.includes("nated") && (name.includes("Engineering") || name.includes("Mechanical"))) return rule(G12,[{...maths(),appliesTo:["grade12"]},{...science(),appliesTo:["grade12"]}],{source:TSC,manual:true,note:"Engineering subject requirements require official TSC confirmation."});
  if (q.includes("nated")) return rule(G12,[],{source:TSC,manual:true,note:"The programme is verified, but its complete numeric entry rule is not available in the captured official source."});
  if (q.includes("nc(v)")) return rule(G9,[],{source:TSC,manual:true,note:"Official TSC placement screening must confirm the programme-specific entry rule."});
  return rule(G9,[],{source:TSC,manual:true,note:"Occupational-programme entry requirements must be confirmed by TSC."});
};
