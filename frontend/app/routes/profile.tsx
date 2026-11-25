// app/routes/profile.tsx
// Comprehensive Cyberpunk Profile & Account Management Terminal
import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { ClientOnly } from "~/lib/currentUser";
import ScreenLoading from "~/components/ScreenLoading";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { FaUser, FaCamera, FaLock, FaTrash, FaSignOutAlt, FaShieldAlt, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { getCurrentUser, logoutUser, refreshUser, updateStoredToken } from "~/api/auth";
import { saveNickname } from "~/lib/nickname";
import { saveAvatar } from "~/lib/avatar";
import {
  fetchProfile,
  resendVerification,
  updateProfile,
  uploadAvatar,
  changePassword,
  deleteAccount,
  type ProfileResponse,
  type ProfileError,
} from "~/api/profile";

function ProfileRouteScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Nickname & Email state
  const [playerName, setPlayerName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  // "send the confirmation link again": idle -> sending -> sent
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");

  // Avatar state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Delete state
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  // Load profile on mount
  useEffect(() => {
    if (!currentUser?.id) {
      navigate("/login", { replace: true });
      return;
    }

    fetchProfile(currentUser.id)
      .then((data) => {
        setProfile(data);
        saveAvatar(data.avatarUrl);
        setPlayerName(data.playerName);
        setEmail(data.email || "");
        void refreshUser(); // keeps the menu's "confirm your e-mail" reminder in step
      })
      .catch((err) => {
        setProfileError(err.message || t("pf_err_load"));
      })
      .finally(() => setLoading(false));
  }, [currentUser?.id, navigate]);

  // Handle Profile Update (Name & Email)
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setProfileError(null);
    setProfileSuccess(null);
    setProfileSaving(true);

    try {
      const updated = await updateProfile(profile.id, {
        playerName: playerName.trim(),
        email: email.trim() || undefined,
      });
      setProfile(updated);
      if (updated.email !== profile.email) setResend("idle");
      saveNickname(updated.playerName);
      void refreshUser();
      setProfileSuccess(t("pf_saved"));
    } catch (err: any) {
      setProfileError(err.message || t("pf_err_save"));
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Avatar Upload
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setAvatarError(null);

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError(t("pf_avatar_size"));
      return;
    }

    setAvatarUploading(true);
    try {
      const updated = await uploadAvatar(profile.id, file);
      setProfile(updated);
      saveAvatar(updated.avatarUrl);
      setProfileSuccess(t("pf_avatar_ok"));
    } catch (err: any) {
      setAvatarError(err.message || t("pf_avatar_err"));
    } finally {
      setAvatarUploading(false);
    }
  };

  // Handle Password Change
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8 || newPassword.length > 72) {
      setPasswordError(t("pf_pw_len"));
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError(t("pf_pw_mix"));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t("pf_pw_match"));
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await changePassword(profile.id, {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      // other sessions are signed out by the server; this one continues with the fresh token
      if (res.token) updateStoredToken(res.token);
      setPasswordSuccess(t("pf_pw_ok"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setPasswordError(err.message || t("pf_pw_err"));
    } finally {
      setPasswordSaving(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setDeleteError(null);

    if (deleteConfirmation !== "DELETE") {
      setDeleteError(t("pf_del_type"));
      return;
    }
    if (!deleteAcknowledged) {
      setDeleteError(t("pf_del_ack"));
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount(profile.id, {
        confirmation: deleteConfirmation,
        acknowledged: deleteAcknowledged,
      });
      logoutUser();
      navigate("/login", { replace: true });
    } catch (err: any) {
      setDeleteError(err.message || t("pf_del_err"));
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040714] text-white flex items-center justify-center font-pixel">
        <div className="text-yellow text-xl tracking-widest animate-pulse">
          {t("loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#040714] text-white flex flex-col justify-between select-none overflow-x-hidden font-pixel">
      {/* Background Grid */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(1, 228, 255, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(1, 228, 255, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="star-background pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-5 border-b border-[#01E4FF]/40 flex items-center justify-between gap-3 bg-[#040714]/80 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10 transition-colors"
        >
          &lt; {t("menu")}
        </Link>

        <div className="flex items-center gap-4 text-xs">
          <Link to="/results" className="flex items-center gap-2 text-[#01E4FF] hover:text-white uppercase">
            <FaShieldAlt className="text-sm" />
            <span>{t("menu_results")}</span>
          </Link>
          <span className="text-gray-600">|</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-yellow hover:text-white transition-colors cursor-pointer text-xs uppercase"
          >
            <FaSignOutAlt />
            {t("log_out").toUpperCase()}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8 max-w-[1100px] w-full mx-auto">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-yellow text-4xl sm:text-5xl tracking-wider text-glow-sm">
            {t("pf_title")}
          </h1>
          <div className="text-xs text-gray-400 mt-2 uppercase">
            {t("pf_subtitle")}
          </div>
        </div>

        {/* Grid of Profile Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full items-start">
          
          {/* Card 1: Identity & Avatar */}
          <div className="bg-[#070c1e]/90 border-2 border-[#01E4FF] p-6 shadow-[0_0_20px_rgba(1,228,255,0.15)] flex flex-col gap-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#01E4FF]/30">
              <span className="text-sm text-[#01E4FF]">&gt; {t("menu_profile")}</span>
              <span className="text-xs px-2 py-0.5 bg-yellow/10 border border-yellow text-yellow uppercase">
                {profile?.rankTitle || "CODE RUNNER"}
              </span>
            </div>

            {/* Avatar Section */}
            <div className="flex items-center gap-6">
              <div className="relative group">
                <div className="w-24 h-24 border-2 border-pink bg-[#02050f] flex items-center justify-center overflow-hidden shadow-[0_0_12px_rgba(254,44,150,0.4)]">
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FaUser className="text-4xl text-pink" />
                  )}
                </div>

                {/* Upload overlay */}
                <label
                  htmlFor="avatar-upload"
                  className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[11px] text-[#01E4FF]"
                >
                  <FaCamera className="text-lg mb-1" />
                  {t("pf_change")}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={avatarUploading}
                />
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <div className="text-xs text-gray-400 uppercase">{t("pf_current_rating")}</div>
                <div className="text-pink text-2xl tracking-widest font-bold">
                  MMR {profile?.mmr || 1500}
                </div>
                <div className="text-[11px] text-gray-500">
                  {t("pf_avatar_hint")}
                </div>
                {avatarUploading && (
                  <div className="text-xs text-yellow animate-pulse">
                    {t("pf_uploading")}
                  </div>
                )}
                {avatarError && (
                  <div className="text-xs text-pink">[!] {avatarError}</div>
                )}
              </div>
            </div>

            {/* Form: Name & Email */}
            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-yellow tracking-wider uppercase">
                  {t("pf_nickname")}
                </label>
                <input
                  dir="ltr"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={16}
                  required
                  className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 text-sm outline-none focus:border-glow-neon-sm"
                />
                <span className="font-sans text-[11px] text-gray-400">
                  {t("pf_nickname_hint")}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-yellow tracking-wider uppercase">
                    {t("pf_email")}
                  </label>
                  {profile?.emailVerified ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <FaCheckCircle /> {t("pf_verified")}
                    </span>
                  ) : profile?.email ? (
                    <span className="flex items-center gap-1 text-[11px] text-yellow">
                      <FaExclamationTriangle /> {t("pf_unverified")}
                    </span>
                  ) : null}
                </div>
                <input
                  dir="ltr"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 text-sm outline-none focus:border-glow-neon-sm"
                />
                <span className="font-sans text-[11px] text-gray-400">
                  {t("pf_email_hint")}
                </span>
                {profile?.email && !profile.emailVerified && (
                  <div className="font-sans text-[11px] text-yellow bg-yellow/10 border border-yellow/30 p-2 mt-1 leading-normal flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-[12rem]">
                      {resend === "sent" ? t("pf_resent", { email: profile.email }) : t("pf_confirm_hint")}
                    </span>
                    {resend !== "sent" && (
                      <button
                        type="button"
                        disabled={resend === "sending"}
                        onClick={() => {
                          setResend("sending");
                          setProfileError(null);
                          resendVerification(profile.id)
                            .then((r) => {
                              setResend("sent");
                              if (!r.sent) void refreshUser();
                            })
                            .catch((err) => {
                              setResend("idle");
                              setProfileError(err.message || t("pf_err_save"));
                            });
                        }}
                        className="font-pixel text-[10px] uppercase px-2 py-1 border border-yellow text-yellow hover:bg-yellow hover:text-black disabled:opacity-50"
                      >
                        {t("pf_resend")}
                      </button>
                    )}
                  </div>
                )}
                {profile?.pendingEmail && (
                  <div className="text-[11px] text-yellow bg-yellow/10 border border-yellow/30 p-2 mt-1 leading-normal">
                    {t("pf_pending")} <strong>{profile.pendingEmail}</strong>
                  </div>
                )}
              </div>

              {profileError && (
                <div className="text-pink text-xs border border-pink/40 bg-pink/10 px-3 py-2">
                  [!] {t("error").toUpperCase()}: {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="text-[#01E4FF] text-xs border border-[#01E4FF]/40 bg-[#01E4FF]/10 px-3 py-2">
                  [✓] {profileSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full py-3 bg-[#01E4FF] border-2 border-yellow text-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {profileSaving ? t("pf_saving") : t("pf_save")}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Password & Danger Zone */}
          <div className="flex flex-col gap-8">
            
            {/* Card 2: Password Security */}
            <div className="bg-[#070c1e]/90 border-2 border-[#01E4FF] p-6 shadow-[0_0_20px_rgba(1,228,255,0.15)] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#01E4FF]/30">
                <span className="text-sm text-[#01E4FF] flex items-center gap-2">
                  <FaLock className="text-xs" /> &gt; {t("pf_change_pw")}
                </span>
                <span className="text-[11px] text-gray-400">{t("pf_pw_rule")}</span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-yellow tracking-wider uppercase">
                    {t("pf_current_pw")}
                  </label>
                  <input
                    dir="ltr"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 text-sm outline-none focus:border-glow-neon-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-yellow tracking-wider uppercase">
                    {t("pf_new_pw")}
                  </label>
                  <input
                    dir="ltr"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 text-sm outline-none focus:border-glow-neon-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-yellow tracking-wider uppercase">
                    {t("pf_confirm_pw")}
                  </label>
                  <input
                    dir="ltr"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2.5 text-sm outline-none focus:border-glow-neon-sm"
                  />
                </div>

                {passwordError && (
                  <div className="text-pink text-xs border border-pink/40 bg-pink/10 px-3 py-2">
                    [!] {t("error").toUpperCase()}: {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="text-emerald-400 text-xs border border-emerald-400/40 bg-emerald-400/10 px-3 py-2">
                    [✓] {passwordSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full py-3 bg-[#FE2C96] border-2 border-yellow text-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                >
                  {passwordSaving ? t("pf_pw_updating") : t("pf_pw_update")}
                </button>
              </form>
            </div>

            {/* Card 3: Danger Zone (Delete Account) */}
            <div className="bg-[#1a0510]/90 border-2 border-pink p-6 shadow-[0_0_20px_rgba(255,42,133,0.2)] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-pink/30 text-pink">
                <span className="text-sm flex items-center gap-2">
                  <FaTrash className="text-xs" /> &gt; {t("pf_delete_title")}
                </span>
                <span className="text-[11px] uppercase">{t("pf_cannot_undo")}</span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed font-sans">
                {t("pf_delete_warn")}
              </p>

              {!showDelete ? (
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="w-full py-2.5 border border-pink text-pink text-xs uppercase tracking-widest hover:bg-pink/10 transition-colors cursor-pointer"
                >
                  {t("pf_delete_open")}
                </button>
              ) : (
              <form onSubmit={handleDeleteSubmit} className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-xs text-yellow cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteAcknowledged}
                    onChange={(e) => setDeleteAcknowledged(e.target.checked)}
                    className="accent-pink"
                  />
                  <span>{t("pf_delete_ack")}</span>
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-400">
                    {t("pf_delete_type_a")} <strong className="text-pink">DELETE</strong> {t("pf_delete_type_b")}
                  </span>
                  <input
                    dir="ltr"
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-[#02050f] border border-pink text-pink px-3.5 py-2 text-sm outline-none focus:border-glow-pink"
                  />
                </div>

                {deleteError && (
                  <div className="text-pink text-xs border border-pink/40 bg-pink/10 px-3 py-2">
                    [!] {t("error").toUpperCase()}: {deleteError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={deleting || deleteConfirmation !== "DELETE" || !deleteAcknowledged}
                  className="w-full py-2.5 bg-red-600 border border-yellow text-white text-xs uppercase tracking-widest hover:bg-red-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? t("pf_deleting") : t("pf_delete_forever")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(false);
                    setDeleteConfirmation("");
                    setDeleteAcknowledged(false);
                    setDeleteError(null);
                  }}
                  className="text-xs text-gray-400 hover:text-white uppercase cursor-pointer"
                >
                  {t("cancel")}
                </button>
              </form>
              )}
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-8 py-3.5 border-t border-[#01E4FF]/40 flex items-center justify-between text-xs text-[#01E4FF] bg-[#040714]/80">
        <div>
          <span className="text-yellow">CLIENT VERSION v1.4.2-BETA</span>
          <span className="mx-3 text-gray-600">|</span>
          <span className="text-gray-400">SYSTEM_ENCRYPTION: ACTIVE (AES_256)</span>
        </div>
        <div className="text-gray-400">SECURE TERMINAL NODE: KZ-ALA-01</div>
      </footer>
    </div>
  );
}

export default function ProfileRoute() {
  return <ClientOnly fallback={<ScreenLoading />}>{() => <ProfileRouteScreen />}</ClientOnly>;
}
