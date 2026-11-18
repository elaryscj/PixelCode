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
  /** online card payment is connected (Freedom Pay): pay and get access at once */
  onlinePayment?: boolean;
};

export const teacherStatus = () => api<TeacherStatus>("/teacher/status");
export const startTeacherTrial = () => api<TeacherStatus>("/teacher/trial", { method: "POST" });
export const requestTeacherPlan = (body: { plan: "MONTH" | "YEAR"; school: string; contact: string; note: string }) =>
  api<TeacherStatus>("/teacher/request", { method: "POST", body: JSON.stringify(body) });

/** Starts an online payment; send the browser to redirectUrl (Freedom Pay's payment page). */
export const startCheckout = (plan: "MONTH" | "YEAR") =>
  api<{ redirectUrl: string; orderId: string }>("/payments/checkout", { method: "POST", body: JSON.stringify({ plan }) });
export const paymentStatus = (orderId: string) =>
  api<{ status: "PENDING" | "PAID" | "FAILED"; plan: string }>(`/payments/${encodeURIComponent(orderId)}`);
