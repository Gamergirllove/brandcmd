"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getConnectedPlatforms, disconnectPlatform } from "@/hooks/useAnalytics";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_CONFIGS, type Platform } from "@/types";
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
        background: danger ? "rgba(224,69,69,0.05)" : "#111115",
        border: danger ? "1px solid rgba(224,69,69,0.2)" : "1px solid #2A2A34",
      }}
    >
      <div
        className="mb-4 pb-3"
        style={{ borderBottom: "1px solid #2A2A34" }}
      >
        <h2
          className="font-semibold"
          style={{ color: danger ? "#E04545" : "#E8E8E8" }}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm" style={{ color: "#888896" }}>
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
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
      style={{ background: checked ? "#8B9C3A" : "#2A2A34" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

const inputStyle = {
  background: "#0A0A0C",
  border: "1px solid #363640",
  color: "#E8E8E8",
  width: "100%",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "14px",
  outline: "none",
};

export default function SettingsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [creatorHandle, setCreatorHandle] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [connectedPlatforms, setConnectedPlatforms] = useState<Platform[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<Platform | null>(null);
  const [disconnectingAll, setDisconnectingAll] = useState(false);

  const [notifWeeklyReport, setNotifWeeklyReport] = useState(true);
  const [notifGoalComplete, setNotifGoalComplete] = useState(true);
  const [notifMilestone, setNotifMilestone] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? "");
      setDisplayName(data.user?.user_metadata?.full_name ?? "");
      setCreatorHandle(data.user?.user_metadata?.creator_handle ?? "");
    });

    getConnectedPlatforms().then((platforms) => {
      setConnectedPlatforms(platforms);
      setLoadingPlatforms(false);
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName, creator_handle: creatorHandle },
    });

    if (error) {
      setProfileError(error.message);
    } else {
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
    setSavingProfile(false);
  }

  async function handleDisconnectPlatform(platform: Platform) {
    setDisconnectingPlatform(platform);
    try {
      await disconnectPlatform(platform);
      setConnectedPlatforms((prev) => prev.filter((p) => p !== platform));
    } catch {
      // ignore
    } finally {
      setDisconnectingPlatform(null);
    }
  }

  async function handleDisconnectAll() {
    setDisconnectingAll(true);
    await Promise.allSettled(connectedPlatforms.map(disconnectPlatform));
    setConnectedPlatforms([]);
    setDisconnectingAll(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    if (confirmDelete !== userEmail) return;
    setDeletingAccount(true);
    await Promise.allSettled(connectedPlatforms.map(disconnectPlatform));
    await supabase.auth.signOut();
    router.replace("/");
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
            style={{
              background: "#4A5420",
              border: "1px solid #8B9C3A",
              color: "#A8BA48",
            }}
          >
            {userInitials}
          </div>
          <div>
            <p className="font-medium" style={{ color: "#E8E8E8" }}>
              {displayName || "Creator"}
            </p>
            {creatorHandle && (
              <p className="text-sm" style={{ color: "#888896" }}>@{creatorHandle}</p>
            )}
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "#18181E",
                border: "1px solid #363640",
                color: "#555560",
              }}
            >
              Free plan
            </span>
          </div>
        </div>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="displayName" style={{ color: "#888896" }}>Display name</Label>
              <input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creatorHandle" style={{ color: "#888896" }}>Creator handle</Label>
              <input
                id="creatorHandle"
                value={creatorHandle}
                onChange={(e) => setCreatorHandle(e.target.value)}
                placeholder="tasha_creates"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" style={{ color: "#888896" }}>Email</Label>
            <input
              id="email"
              value={userEmail}
              disabled
              style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }}
            />
            <p className="text-xs" style={{ color: "#555560" }}>
              Email changes require re-authentication. Contact support.
            </p>
          </div>
          {profileError && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#E04545" }}>
              <AlertCircle className="h-4 w-4" /> {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#3DBA6E" }}>
              <CheckCircle2 className="h-4 w-4" /> Profile saved.
            </div>
          )}
          <button
            type="submit"
            disabled={savingProfile}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60"
            style={{ background: "#8B9C3A", color: "#000" }}
            onMouseOver={(e) => !savingProfile && (e.currentTarget.style.background = "#A8BA48")}
            onMouseOut={(e) => (e.currentTarget.style.background = "#8B9C3A")}
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
              style={{ color: "#555560" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#E04545")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#555560")}
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
          <p className="py-4 text-center text-sm" style={{ color: "#555560" }}>
            No platforms connected.{" "}
            <a
              href="/connect"
              className="font-medium hover:underline"
              style={{ color: "#8B9C3A" }}
            >
              Connect one
            </a>
            .
          </p>
        ) : (
          <ul style={{ borderTop: "1px solid #2A2A34" }}>
            {connectedPlatforms.map((platform) => {
              const config = PLATFORM_CONFIGS[platform];
              return (
                <li
                  key={platform}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: "1px solid #1A1A22" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ background: config.color }}
                    >
                      {config.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#E8E8E8" }}>
                        {config.name}
                      </p>
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: "#3DBA6E" }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: "#3DBA6E" }}
                        />
                        Connected
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnectPlatform(platform)}
                    disabled={disconnectingPlatform === platform}
                    className="text-xs disabled:opacity-50 transition-colors"
                    style={{ color: "#555560" }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#E04545")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#555560")}
                  >
                    {disconnectingPlatform === platform ? (
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
          {[
            {
              label: "Weekly report email",
              description: "Auto-generated summary every Monday",
              value: notifWeeklyReport,
              onChange: setNotifWeeklyReport,
            },
            {
              label: "Goal completion alert",
              description: "When you hit a goal target",
              value: notifGoalComplete,
              onChange: setNotifGoalComplete,
            },
            {
              label: "New milestone alert",
              description: "Follower and subscriber milestones",
              value: notifMilestone,
              onChange: setNotifMilestone,
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "#E8E8E8" }}>
                  {item.label}
                </p>
                <p className="text-xs" style={{ color: "#555560" }}>
                  {item.description}
                </p>
              </div>
              <Toggle checked={item.value} onChange={item.onChange} />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Session */}
      <SectionCard title="Session" description="Manage your active session.">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            border: "1px solid #363640",
            color: "#888896",
            background: "transparent",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "rgba(224,69,69,0.4)";
            e.currentTarget.style.color = "#E04545";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "#363640";
            e.currentTarget.style.color = "#888896";
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
            <Label htmlFor="confirmDelete" style={{ color: "#888896" }}>
              Type your email{" "}
              <span
                className="font-mono text-xs"
                style={{ color: "#555560" }}
              >
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
              onFocus={(e) => (e.currentTarget.style.borderColor = "#E04545")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
            />
          </div>
          <button
            disabled={confirmDelete !== userEmail || deletingAccount}
            onClick={handleDeleteAccount}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ background: "#E04545" }}
            onMouseOver={(e) =>
              confirmDelete === userEmail && (e.currentTarget.style.background = "#c73b3b")
            }
            onMouseOut={(e) => (e.currentTarget.style.background = "#E04545")}
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
