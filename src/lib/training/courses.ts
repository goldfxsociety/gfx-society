import { createClient } from "@/lib/supabase/server";
import { CATALOG, type CatalogCourse } from "@/config/training";
import { getMembership, type Membership } from "./gate";

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
  | "locked";

export type LessonRow = {
  id: string;
  slug: string;
  title: string;
  sort: number;
  moduleSort: number;
  moduleTitle: string;
  completed: boolean;
};

export type CourseView = {
  catalog: CatalogCourse;
  courseId: string | null;
  pricePhp: number;
  pay: PaymentInfo;
  state: CardState;
  lessons: LessonRow[];
  done: number;
  lastActivity: string | null;
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
    .select("id, slug, title, sort, training_modules!inner(sort, title, course_id)")
    .eq("training_modules.course_id", courseId);
  const list = (rows ?? []) as unknown as {
    id: string;
    slug: string;
    title: string;
    sort: number;
    training_modules: { sort: number; title: string };
  }[];
  if (list.length === 0) return { lessons: [], lastActivity: null };
  const { data: prog } = await supabase
    .from("training_progress")
    .select("lesson_id, completed_at, updated_at")
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
      completed: Boolean(byId.get(l.id)?.completed_at),
    }))
    .sort((a, b) => a.moduleSort - b.moduleSort || a.sort - b.sort);
  const lastActivity =
    (prog ?? []).map((p) => p.updated_at as string).sort().at(-1) ?? null;
  return { lessons, lastActivity };
}

function cardState(membership: Membership, pay: PaymentInfo, lessons: LessonRow[], done: number): CardState {
  if (membership === "none") return "verify";
  switch (pay.state) {
    case "approved":
      return "owned";
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "locked":
      return "locked";
    case "open":
      return "not_owned";
    case "free":
      if (lessons.length === 0) return "coming_soon"; // B11: no published lessons yet
      if (done === 0) return "free_new";
      return done >= lessons.length ? "free_done" : "free_progress";
    default:
      return "coming_soon"; // not_found (draft), coming_soon, closed
  }
}

export async function getCourseView(catalog: CatalogCourse, membership: Membership): Promise<CourseView> {
  const pay: PaymentInfo = membership === "none" ? { state: "not_member" } : await getPaymentInfo(catalog.slug);
  const courseId = pay.course_id ?? null;
  const { lessons, lastActivity } =
    courseId && (pay.state === "approved" || pay.state === "free") ? await getLessons(courseId) : { lessons: [], lastActivity: null };
  const done = lessons.filter((l) => l.completed).length;
  return {
    catalog,
    courseId,
    pricePhp: pay.price_php ?? 0,
    pay,
    state: cardState(membership, pay, lessons, done),
    lessons,
    done,
    lastActivity,
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

/** Next lesson to open: first not-completed, else first. */
export function nextLesson(lessons: LessonRow[]): LessonRow | undefined {
  return lessons.find((l) => !l.completed) ?? lessons[0];
}
