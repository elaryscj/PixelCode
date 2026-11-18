// app/api/lessons.ts — teacher mode (LessonController). Teachers use their login; students have no account
// and send the token they got when joining (kept in this browser, per lesson code).
import { api } from "./http";
import type { DoorChallenge, SubmitResult } from "./game";

export type LessonStatus = "LOBBY" | "RUNNING" | "ENDED";

export type LessonSummary = {
  code: string;
  title: string;
  mapId: number;
  durationMinutes: number;
  status: LessonStatus;
  createdAt: number;
  startsAt: number | null;
  endsAt: number | null;
  serverTime: number;
  students?: number;
};

export type CatalogTask = { id: number; title: string; difficulty: "EASY" | "MEDIUM" | "HARD"; description: string };

export type DoorCell = {
  door: number;
  attempts: number;
  state: "LOCKED" | "WORKING" | "STUCK" | "SOLVED";
  /** SOLVED: time spent on it; WORKING / STUCK: time since the task was opened */
  seconds?: number;
  atSecond?: number;
};

export type BoardRow = {
  id: number;
  name: string;
  place: number;
  unlocked: number;
  finishedSeconds: number | null;
  online: boolean;
  falls: number;
  doors: DoorCell[];
};

export type Board = LessonSummary & {
  doors: { id: number; title: string; difficulty: string }[];
  students: BoardRow[];
};

export type StudentWork = {
  id: number;
  name: string;
  submissions: {
    door: number;
    passed: boolean;
    passedCount: number;
    total: number;
    error: string | null;
    atSecond: number;
    code: string;
  }[];
};

export type StudentState = LessonSummary & {
  name: string;
  unlocked: number;
  finished: boolean;
  finishedSeconds: number | null;
  token?: string;
};

const enc = encodeURIComponent;

// ---------------------------------------------------------------- teacher

export const myLessons = () => api<LessonSummary[]>("/lessons");
export const lessonCatalog = () => api<CatalogTask[]>("/lessons/catalog");
export const createLesson = (body: { title: string; mapId: number; challengeIds: number[]; durationMinutes: number }) =>
  api<LessonSummary>("/lessons", { method: "POST", body: JSON.stringify(body) });
export const lessonBoard = (code: string) => api<Board>(`/lessons/${enc(code)}/board`);
export const studentWork = (code: string, id: number) => api<StudentWork>(`/lessons/${enc(code)}/students/${id}`);
export const startLesson = (code: string) => api<LessonSummary>(`/lessons/${enc(code)}/start`, { method: "POST" });
export const endLesson = (code: string) => api<LessonSummary>(`/lessons/${enc(code)}/end`, { method: "POST" });

// ---------------------------------------------------------------- student

const tokenKey = (code: string) => `pixelcode.lesson.${code.toUpperCase()}`;

export function lessonToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

export function forgetLesson(code: string) {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    /* storage blocked: nothing to forget */
  }
}

const student = (code: string) => ({ "X-Lesson-Token": lessonToken(code) ?? "" });

export async function joinLesson(code: string, name: string): Promise<StudentState> {
  const s = await api<StudentState>(`/lessons/${enc(code)}/join`, { method: "POST", body: JSON.stringify({ name }) });
  try {
    if (s.token) localStorage.setItem(tokenKey(code), s.token);
  } catch {
    /* private mode: the student just cannot rejoin after closing the tab */
  }
  return s;
}

export const lessonMe = (code: string, falls?: number) =>
  api<StudentState>(`/lessons/${enc(code)}/me${falls != null ? `?falls=${falls}` : ""}`, { headers: student(code) });

export const openLessonDoor = (code: string, door: number) =>
  api<DoorChallenge>(`/lessons/${enc(code)}/doors/${door}/open`, { method: "POST", headers: student(code) });

export const submitLessonDoor = (code: string, door: number, source: string) =>
  api<SubmitResult>(`/lessons/${enc(code)}/doors/${door}/submit`, {
    method: "POST",
    headers: student(code),
    body: JSON.stringify({ code: source }),
  });

export const finishLesson = (code: string) =>
  api<StudentState>(`/lessons/${enc(code)}/finish`, { method: "POST", headers: student(code) });
