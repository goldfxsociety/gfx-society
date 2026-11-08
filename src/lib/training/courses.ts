import { createClient } from "@/lib/supabase/server";
import { CATALOG, type CatalogCourse } from "@/config/training";
import { capstoneAvailability, unfinishedLesson, type CapstoneAvailability } from "./continue";
import { getMembership, type Membership } from "./gate";
import { memberCourseState } from "./member-surface";

export type PayState =
  | "not_member"
  | "not_found"
  | "free"
  | "coming_soon"
  | "locked"
  | "closed"
  | "pending"
  | "approved"
  | "rejected"
  | "open";

export type PaymentInfo = {
  state: PayState;
  course_id?: string;
  price_php?: number;
  payment_code?: string;
  purchase_id?: string | null;
  reject_reason?: string | null;
  submitted_at?: string | null;
};

export type CardState =
  | "verify"
  | "free_new"
  | "free_progress"
  | "free_done"
  | "not_owned"
  | "pending"
  | "rejected"
  | "owned"
  | "coming_soon"
  | "locked"
  | "sales_closed";

export type LessonRow = {
  id: string;
  slug: string;
  title: string;
  sort: number;
  moduleSort: number;
  moduleTitle: string;
  moduleSlug: string;
  moduleGoal: string;
  completed: boolean;
  /** Has a progress row (quiz submitted or practice ticked) but is not completed. */
  started: boolean;
  /** A quiz score is recorded. No pass mark is set yet (spec §6 A1), so this means "quiz done", not "passed". */
  quizDone: boolean;
};

export type LessonState = "done" | "in_progress" | "not_started";
export const lessonState = (l: LessonRow): LessonState => (l.completed ? "done" : l.started ? "in_progress" : "not_started");

export type CourseView = {
  catalog: CatalogCourse;
  courseId: string | null;
  pricePhp: number;
  pay: PaymentInfo;
  state: CardState;
  lessons: LessonRow[];
  done: number;
  lastActivity: string | null;
  /** Visible capstone only. Absent when the member cannot read one, including no row. */
  capstone: CapstoneAvailability;
};

export async function getPaymentInfo(slug: string): Promise<PaymentInfo> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_payment_info", { p_course_slug: slug });
  if (error || !data) return { state: "not_found" };
  return data as PaymentInfo;
}

/** Lessons the caller can read (RLS: access + published) with own progress. */
export async function getLessons(courseId: string): Promise<{ lessons: LessonRow[]; lastActivity: string | null }> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("training_lessons")
    .select("id, slug, title, sort, training_modules!inner(sort, title, slug, learning_goal, course_id)")
    .eq("training_modules.course_id", courseId);
  const list = (rows ?? []) as unknown as {
    id: string;
    slug: string;
    title: string;
    sort: number;
    training_modules: { sort: number; title: string; slug: string; learning_goal: string | null };
  }[];
  if (list.length === 0) return { lessons: [], lastActivity: null };
  const { data: prog } = await supabase
    .from("training_progress")
    .select("lesson_id, completed_at, updated_at, quiz_score")
    .in(
      "lesson_id",
      list.map((l) => l.id),
    );
  const byId = new Map((prog ?? []).map((p) => [p.lesson_id as string, p]));
  const lessons = list
    .map((l) => ({
      id: l.id,
      slug: l.slug,
      title: l.title,
      sort: l.sort,
      moduleSort: l.training_modules.sort,
      moduleTitle: l.training_modules.title,
      moduleSlug: l.training_modules.slug,
      moduleGoal: l.training_modules.learning_goal ?? "",
      completed: Boolean(byId.get(l.id)?.completed_at),
      started: byId.has(l.id) && !byId.get(l.id)?.completed_at,
      quizDone: byId.get(l.id)?.quiz_score != null,
    }))
    .sort((a, b) => a.moduleSort - b.moduleSort || a.sort - b.sort);
  const lastActivity =
    (prog ?? []).map((p) => p.updated_at as string).sort().at(-1) ?? null;
  return { lessons, lastActivity };
}

function cardState(membership: Membership, pay: PaymentInfo, lessons: LessonRow[], done: number): CardState {
  // Lesson rows are loaded only for approved/free. `closed` still means content-ready sales shut.
  return memberCourseState(membership, pay.state, lessons.length, done);
}

export async function getCourseView(catalog: CatalogCourse, membership: Membership): Promise<CourseView> {
  // S8 = A: a removed member still gets 'approved' for a bought course from my_payment_info; anything else is not_member.
  const pay: PaymentInfo = await getPaymentInfo(catalog.slug);
  const courseId = pay.course_id ?? null;
  const readable = Boolean(courseId) && (pay.state === "approved" || pay.state === "free");
  const [lessonResult, capstoneStatus] =
    readable && courseId
      ? await Promise.all([getLessons(courseId), getCapstoneStatus(courseId)])
      : [{ lessons: [] as LessonRow[], lastActivity: null as string | null }, { exists: false, done: false }];
  const { lessons, lastActivity } = lessonResult;
  const done = lessons.filter((l) => l.completed).length;
  const capstone = capstoneAvailability(capstoneStatus);
  return {
    catalog,
    courseId,
    pricePhp: pay.price_php ?? 0,
    pay,
    state: cardState(membership, pay, lessons, done),
    lessons,
    done,
    lastActivity,
    capstone,
  };
}

export async function getAllCourseViews() {
  const { loggedIn, membership } = await getMembership();
  const views = await Promise.all(CATALOG.map((c) => getCourseView(c, membership)));
  return { loggedIn, membership, views };
}

export function findCatalog(slug: string): CatalogCourse | undefined {
  return CATALOG.find((c) => c.slug === slug);
}

/** First accessible lesson that is not completed. Undefined when all are complete — no lesson-one fallback. */
export function nextLesson(lessons: LessonRow[]): LessonRow | undefined {
  return unfinishedLesson(lessons);
}

export type ModuleGroup = { sort: number; slug: string; title: string; goal: string; lessons: LessonRow[]; done: number };

/** Lessons grouped by module, in course order. */
export function groupByModule(lessons: LessonRow[]): ModuleGroup[] {
  const out: ModuleGroup[] = [];
  for (const l of lessons) {
    let g = out.find((m) => m.sort === l.moduleSort);
    if (!g) out.push((g = { sort: l.moduleSort, slug: l.moduleSlug, title: l.moduleTitle, goal: l.moduleGoal, lessons: [], done: 0 }));
    g.lessons.push(l);
    if (l.completed) g.done++;
  }
  return out;
}

/** Capstone presence + own completion for a course (existing tables, RLS: access / own row). */
export async function getCapstoneStatus(courseId: string): Promise<{ exists: boolean; done: boolean }> {
  const supabase = await createClient();
  const [{ data: cap }, { data: prog }] = await Promise.all([
    supabase.from("training_capstones").select("course_id").eq("course_id", courseId).maybeSingle(),
    supabase.from("capstone_progress").select("completed_at").eq("course_id", courseId).maybeSingle(),
  ]);
  return { exists: Boolean(cap), done: Boolean(prog?.completed_at) };
}
