// app/api/profile.ts
// Client for ProfileController (/api/profile/*) - every call carries the login token
import { api } from "./http";

export type ProfileResponse = {
  id: number;
  playerName: string;
  email: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  mmr: number;
  rankTitle: string;
  avatarUrl: string | null;
};

export type ProfileError = {
  message: string;
  field?: string | null;
};

export const fetchProfile = (userId: number) => api<ProfileResponse>(`/profile/${userId}`);

export const updateProfile = (userId: number, data: { playerName: string; email?: string }) =>
  api<ProfileResponse>(`/profile/${userId}`, { method: "PUT", body: JSON.stringify(data) });

/** Shrinks the picture to 128x128 in the browser and stores it as a small data URL. */
function toAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("This file is not an image"));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not process the image"));
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatar(userId: number, file: File): Promise<ProfileResponse> {
  const avatar = await toAvatarDataUrl(file);
  return api<ProfileResponse>(`/profile/${userId}/avatar`, { method: "PUT", body: JSON.stringify({ avatar }) });
}

export const changePassword = (
  userId: number,
  data: { currentPassword: string; newPassword: string; confirmNewPassword: string },
) => api<{ message: string }>(`/profile/${userId}/password`, { method: "PUT", body: JSON.stringify(data) });

export const verifyEmailToken = (token: string) =>
  api<{ message: string }>(`/profile/email/verify?token=${encodeURIComponent(token)}`);

export const deleteAccount = (userId: number, data: { confirmation: string; acknowledged: boolean }) =>
  api<{ message: string }>(`/profile/${userId}`, { method: "DELETE", body: JSON.stringify(data) });
