// app/api/teacher.ts — teacher mode as a product: status, free trial, subscription request (TeacherController).
import { api } from "./http";

export type TeacherStatus = {
  /** has (or had) teacher mode: past lessons stay readable */
  teacher: boolean;
  /** may create and start lessons right now */
  active: boolean;
  /** end of the trial / subscription (ms); null = no end */
  until: number | null;
  unlimited: boolean;
  trialAvailable: boolean;
  trialDays: number;
  priceMonth: number;
  priceYear: number;
  currency: string;
  requestPending: boolean;
};

export const teacherStatus = () => api<TeacherStatus>("/teacher/status");
export const startTeacherTrial = () => api<TeacherStatus>("/teacher/trial", { method: "POST" });
export const requestTeacherPlan = (body: { plan: "MONTH" | "YEAR"; school: string; contact: string; note: string }) =>
  api<TeacherStatus>("/teacher/request", { method: "POST", body: JSON.stringify(body) });
