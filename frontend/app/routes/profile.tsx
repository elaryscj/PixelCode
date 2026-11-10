// app/routes/profile.tsx
// Comprehensive Cyberpunk Profile & Account Management Terminal
import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router";
import { FaUser, FaCamera, FaLock, FaTrash, FaSignOutAlt, FaShieldAlt, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { getCurrentUser, logoutUser, refreshUser } from "~/api/auth";
import { saveNickname } from "~/lib/nickname";
import { saveAvatar } from "~/lib/avatar";
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  deleteAccount,
  type ProfileResponse,
  type ProfileError,
} from "~/api/profile";

export default function ProfileRoute() {
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
      })
      .catch((err) => {
        setProfileError(err.message || "Failed to load profile.");
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
      saveNickname(updated.playerName);
      void refreshUser();
      setProfileSuccess("Profile updated successfully!");
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
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
      setAvatarError("Avatar file must be 2 MB or smaller.");
      return;
    }

    setAvatarUploading(true);
    try {
      const updated = await uploadAvatar(profile.id, file);
      setProfile(updated);
      saveAvatar(updated.avatarUrl);
      setProfileSuccess("Avatar uploaded successfully!");
    } catch (err: any) {
      setAvatarError(err.message || "Failed to upload avatar.");
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

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await changePassword(profile.id, {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setPasswordSuccess(res.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
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
      setDeleteError("Type DELETE in capital letters to confirm.");
      return;
    }
    if (!deleteAcknowledged) {
      setDeleteError("You must check the acknowledgment checkbox.");
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
      setDeleteError(err.message || "Failed to delete account.");
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
          INITIALIZING TERMINAL PROFILE...
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
      <header className="relative z-10 w-full px-8 py-5 border-b border-[#01E4FF]/40 flex items-center justify-between bg-[#040714]/80 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 border-2 border-pink px-4 py-1.5 text-xs text-pink uppercase hover:bg-pink/10 transition-colors"
        >
          &lt; MENU
        </Link>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2 text-[#01E4FF]">
            <FaShieldAlt className="text-sm" />
            <span>TERMINAL SECURITY</span>
          </div>
          <span className="text-gray-600">|</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-yellow hover:text-white transition-colors cursor-pointer text-xs uppercase"
          >
            <FaSignOutAlt />
            LOG OUT
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-8 max-w-[1100px] w-full mx-auto">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="text-[11px] text-[#01E4FF] tracking-widest uppercase mb-1">
            — SECURE USER PROFILE & SETTINGS —
          </div>
          <h1 className="text-yellow text-4xl sm:text-5xl tracking-wider text-glow-sm">
            TERMINAL IDENTITY
          </h1>
          <div className="text-[10px] text-gray-400 mt-1 uppercase">
            COMBATANT RECORD // MMR & CREDENTIALS
          </div>
        </div>

        {/* Grid of Profile Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full items-start">
          
          {/* Card 1: Identity & Avatar */}
          <div className="bg-[#070c1e]/90 border-2 border-[#01E4FF] p-6 shadow-[0_0_20px_rgba(1,228,255,0.15)] flex flex-col gap-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#01E4FF]/30">
              <span className="text-sm text-[#01E4FF]">&gt; COMBATANT_IDENTITY</span>
              <span className="text-[10px] px-2 py-0.5 bg-yellow/10 border border-yellow text-yellow uppercase">
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
                  className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] text-[#01E4FF]"
                >
                  <FaCamera className="text-lg mb-1" />
                  CHANGE
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
                <div className="text-xs text-gray-400 uppercase">CURRENT RATING</div>
                <div className="text-pink text-2xl tracking-widest font-bold">
                  MMR {profile?.mmr || 1500}
                </div>
                <div className="text-[9px] text-gray-500">
                  PNG, JPEG, WebP • MAX 2MB
                </div>
                {avatarUploading && (
                  <div className="text-[10px] text-yellow animate-pulse">
                    UPLOADING AVATAR...
                  </div>
                )}
                {avatarError && (
                  <div className="text-[10px] text-pink">[!] {avatarError}</div>
                )}
              </div>
            </div>

            {/* Form: Name & Email */}
            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-yellow tracking-wider uppercase">
                  PLAYER NAME / NICKNAME
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={16}
                  required
                  className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2 text-xs outline-none focus:border-glow-neon-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-yellow tracking-wider uppercase">
                    EMAIL ADDRESS
                  </label>
                  {profile?.emailVerified ? (
                    <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                      <FaCheckCircle /> VERIFIED
                    </span>
                  ) : profile?.email ? (
                    <span className="flex items-center gap-1 text-[9px] text-yellow">
                      <FaExclamationTriangle /> UNVERIFIED
                    </span>
                  ) : null}
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@example.com"
                  className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2 text-xs outline-none focus:border-glow-neon-sm"
                />
                {profile?.pendingEmail && (
                  <div className="text-[9px] text-yellow bg-yellow/10 border border-yellow/30 p-2 mt-1 leading-normal">
                    Pending verification link sent to: <strong>{profile.pendingEmail}</strong>
                  </div>
                )}
              </div>

              {profileError && (
                <div className="text-pink text-[10px] border border-pink/40 bg-pink/10 px-3 py-2">
                  [!] ERROR: {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="text-[#01E4FF] text-[10px] border border-[#01E4FF]/40 bg-[#01E4FF]/10 px-3 py-2">
                  [✓] {profileSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full py-3 bg-[#01E4FF] border-2 border-yellow text-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {profileSaving ? "SAVING CHANGES..." : "SAVE PROFILE"}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: Password & Danger Zone */}
          <div className="flex flex-col gap-8">
            
            {/* Card 2: Password Security */}
            <div className="bg-[#070c1e]/90 border-2 border-[#01E4FF] p-6 shadow-[0_0_20px_rgba(1,228,255,0.15)] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#01E4FF]/30">
                <span className="text-sm text-[#01E4FF] flex items-center gap-2">
                  <FaLock className="text-xs" /> &gt; CHANGE_PASSWORD
                </span>
                <span className="text-[9px] text-gray-400">6+ CHARACTERS</span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-yellow tracking-wider uppercase">
                    CURRENT PASSWORD
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2 text-xs outline-none focus:border-glow-neon-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-yellow tracking-wider uppercase">
                    NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2 text-xs outline-none focus:border-glow-neon-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-yellow tracking-wider uppercase">
                    CONFIRM NEW PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#02050f] border border-[#01E4FF] text-white px-3.5 py-2 text-xs outline-none focus:border-glow-neon-sm"
                  />
                </div>

                {passwordError && (
                  <div className="text-pink text-[10px] border border-pink/40 bg-pink/10 px-3 py-2">
                    [!] ERROR: {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="text-emerald-400 text-[10px] border border-emerald-400/40 bg-emerald-400/10 px-3 py-2">
                    [✓] {passwordSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="w-full py-3 bg-[#FE2C96] border-2 border-yellow text-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                >
                  {passwordSaving ? "UPDATING PASSWORD..." : "UPDATE PASSWORD"}
                </button>
              </form>
            </div>

            {/* Card 3: Danger Zone (Delete Account) */}
            <div className="bg-[#1a0510]/90 border-2 border-pink p-6 shadow-[0_0_20px_rgba(255,42,133,0.2)] flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-pink/30 text-pink">
                <span className="text-sm flex items-center gap-2">
                  <FaTrash className="text-xs" /> &gt; DANGER_ZONE
                </span>
                <span className="text-[9px] uppercase">PERMANENT ACTION</span>
              </div>

              <p className="text-[10px] text-gray-300 leading-relaxed font-sans">
                Deleting your account will permanently erase your username, MMR rating, avatar, and match history. This action cannot be reversed.
              </p>

              <form onSubmit={handleDeleteSubmit} className="flex flex-col gap-3">
                <label className="flex items-center gap-2 text-[10px] text-yellow cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteAcknowledged}
                    onChange={(e) => setDeleteAcknowledged(e.target.checked)}
                    className="accent-pink"
                  />
                  <span>I understand my combatant account will be destroyed.</span>
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-gray-400">
                    Type <strong className="text-pink">DELETE</strong> to confirm:
                  </span>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-[#02050f] border border-pink text-pink px-3.5 py-1.5 text-xs outline-none focus:border-glow-pink"
                  />
                </div>

                {deleteError && (
                  <div className="text-pink text-[10px] border border-pink/40 bg-pink/10 px-3 py-2">
                    [!] ERROR: {deleteError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={deleting || deleteConfirmation !== "DELETE" || !deleteAcknowledged}
                  className="w-full py-2.5 bg-red-600 border border-yellow text-white text-xs uppercase tracking-widest hover:bg-red-700 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? "DELETING..." : "DELETE ACCOUNT"}
                </button>
              </form>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-8 py-3.5 border-t border-[#01E4FF]/40 flex items-center justify-between text-[10px] text-[#01E4FF] bg-[#040714]/80">
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
