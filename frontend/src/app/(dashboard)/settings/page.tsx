"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useConnections, useProfile } from "@/hooks/useAnalytics";
import { deleteAccount, disconnectPlatform, updateProfile } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_CONFIGS, type NotificationPrefs, type Platform } from "@/types";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  LogOut,
  Link2Off,
} from "lucide-react";

function SectionCard({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: danger ? "var(--danger-wash)" : "var(--surface)",
        border: danger ? "1px solid rgba(224,69,69,0.2)" : "1px solid var(--line)",
      }}
    >
      <div className="mb-4 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h2 className="font-semibold" style={{ color: danger ? "var(--danger)" : "var(--text)" }}>
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: checked ? "var(--brand)" : "var(--line)" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

const inputStyle = {
  background: "var(--bg)",
  border: "1px solid var(--line-strong)",
  color: "var(--text)",
  width: "100%",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "14px",
  outline: "none",
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: profile, isLoading: loadingProfile, refetch: refetchProfile } = useProfile();
  const {
    data: connections,
    isLoading: loadingPlatforms,
    refetch: refetchConnections,
  } = useConnections();

  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [disconnectingPlatform, setDisconnectingPlatform] = useState<Platform | null>(null);
  const [disconnectingAll, setDisconnectingAll] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPrefs>({
    weeklyReport: true,
    goalComplete: true,
    milestone: false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
  }, []);

  // Seed the form once the profile lands.
  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName ?? "");
    setCreatorHandle(profile.creatorHandle ?? "");
    setPrefs(profile.notificationPrefs);
  }, [profile]);

  const connectedPlatforms = connections.filter((c) => c.connected);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      await updateProfile({ displayName, creatorHandle });
      await refetchProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePrefs(next: NotificationPrefs) {
    const previous = prefs;
    setPrefs(next); // optimistic — revert below if the write fails
    setSavingPrefs(true);
    try {
      await updateProfile({ notificationPrefs: next });
    } catch {
      setPrefs(previous);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleDisconnectPlatform(platform: Platform) {
    setDisconnectingPlatform(platform);
    try {
      await disconnectPlatform(platform);
      await refetchConnections();
    } finally {
      setDisconnectingPlatform(null);
    }
  }

  async function handleDisconnectAll() {
    setDisconnectingAll(true);
    await Promise.allSettled(
      connectedPlatforms.map((c) => disconnectPlatform(c.platform))
    );
    await refetchConnections();
    setDisconnectingAll(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    if (confirmDelete !== userEmail) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      router.replace("/");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete your account."
      );
      setDeletingAccount(false);
    }
  }

  const userInitials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : userEmail.slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Creator Profile */}
      <SectionCard title="Creator Profile" description="Your public creator identity.">
        <div className="mb-5 flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: "var(--brand-dim)", border: "1px solid var(--brand)", color: "var(--brand-light)" }}
          >
            {userInitials}
          </div>
          <div>
            <p className="font-medium" style={{ color: "var(--text)" }}>
              {displayName || "Creator"}
            </p>
            {creatorHandle && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                @{creatorHandle}
              </p>
            )}
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line-strong)", color: "var(--text-dim)" }}
            >
              Free plan
            </span>
          </div>
        </div>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="displayName" style={{ color: "var(--text-muted)" }}>
                Display name
              </Label>
              <input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                disabled={loadingProfile}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creatorHandle" style={{ color: "var(--text-muted)" }}>
                Creator handle
              </Label>
              <input
                id="creatorHandle"
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                placeholder="tasha_creates"
                disabled={loadingProfile}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" style={{ color: "var(--text-muted)" }}>
              Email
            </Label>
            <input
              id="email"
              value={userEmail}
              disabled
              style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }}
            />
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              Email changes require re-authentication. Contact support.
            </p>
          </div>
          {profileError && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--danger)" }}>
              <AlertCircle className="h-4 w-4" /> {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--success)" }}>
              <CheckCircle2 className="h-4 w-4" /> Profile saved.
            </div>
          )}
          <button
            type="submit"
            disabled={savingProfile || loadingProfile}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60"
            style={{ background: "var(--brand)", color: "#000" }}
            onMouseOver={(e) => !savingProfile && (e.currentTarget.style.background = "var(--brand-light)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
          >
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </form>
      </SectionCard>

      {/* Connected Platforms */}
      <SectionCard
        title="Connected Platforms"
        description="Platforms you've linked to your account."
      >
        <div className="mb-3 flex items-center justify-between">
          <span />
          {connectedPlatforms.length > 0 && (
            <button
              onClick={handleDisconnectAll}
              disabled={disconnectingAll}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: "var(--text-dim)" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--danger)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
            >
              {disconnectingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2Off className="h-3.5 w-3.5" />
              )}
              Disconnect all
            </button>
          )}
        </div>
        {loadingPlatforms ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : connectedPlatforms.length === 0 ? (
          <p className="py-4 text-center text-sm" style={{ color: "var(--text-dim)" }}>
            No platforms connected.{" "}
            <a href="/connect" className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
              Connect one
            </a>
            .
          </p>
        ) : (
          <ul style={{ borderTop: "1px solid var(--line)" }}>
            {connectedPlatforms.map((connection) => {
              const config = PLATFORM_CONFIGS[connection.platform];
              return (
                <li
                  key={connection.platform}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid var(--surface-3)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ background: config.color }}
                    >
                      {config.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                        {config.name}
                      </p>
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--success)" }}>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "var(--success)" }}
                        />
                        {connection.username ? `@${connection.username}` : "Connected"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnectPlatform(connection.platform)}
                    disabled={disconnectingPlatform === connection.platform}
                    className="text-xs disabled:opacity-50 transition-colors"
                    style={{ color: "var(--text-dim)" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--danger)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                  >
                    {disconnectingPlatform === connection.platform ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Disconnect"
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Notifications */}
      <SectionCard
        title="Notification Preferences"
        description="Choose what emails you receive from BrandCMD."
      >
        <div className="space-y-4">
          {(
            [
              {
                key: "weeklyReport",
                label: "Weekly report email",
                description: "Auto-generated summary every Monday",
              },
              {
                key: "goalComplete",
                label: "Goal completion alert",
                description: "When you hit a goal target",
              },
              {
                key: "milestone",
                label: "New milestone alert",
                description: "Follower and subscriber milestones",
              },
            ] as const
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {item.label}
                </p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {item.description}
                </p>
              </div>
              <Toggle
                checked={prefs[item.key]}
                disabled={savingPrefs || loadingProfile}
                onChange={(value) => savePrefs({ ...prefs, [item.key]: value })}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Session */}
      <SectionCard title="Session" description="Manage your active session.">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{ border: "1px solid var(--line-strong)", color: "var(--text-muted)", background: "transparent" }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "rgba(224,69,69,0.4)";
            e.currentTarget.style.color = "var(--danger)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "var(--line-strong)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </SectionCard>

      {/* Danger Zone */}
      <SectionCard
        title="Danger Zone"
        description="Permanently delete your account and all data. This cannot be undone."
        danger
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="confirmDelete" style={{ color: "var(--text-muted)" }}>
              Type your email{" "}
              <span className="font-mono text-xs" style={{ color: "var(--text-dim)" }}>
                {userEmail}
              </span>{" "}
              to confirm
            </Label>
            <input
              id="confirmDelete"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={userEmail}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--danger)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
            />
          </div>
          {deleteError && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--danger)" }}>
              <AlertCircle className="h-4 w-4" /> {deleteError}
            </div>
          )}
          <button
            disabled={confirmDelete !== userEmail || deletingAccount}
            onClick={handleDeleteAccount}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: "var(--danger)" }}
            onMouseOver={(e) =>
              confirmDelete === userEmail && (e.currentTarget.style.background = "var(--danger-strong)")
            }
            onMouseOut={(e) => (e.currentTarget.style.background = "var(--danger)")}
          >
            {deletingAccount ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete my account
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
