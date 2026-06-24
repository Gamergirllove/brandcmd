"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, ExternalLink, Check } from "lucide-react";
import { CreatorType, GoalType, type OnboardingData } from "@/types";

const TOTAL_STEPS = 5;

const CREATOR_TYPES: { type: CreatorType; label: string; emoji: string }[] = [
  { type: CreatorType.Gaming, label: "Gaming", emoji: "🎮" },
  { type: CreatorType.Music, label: "Music", emoji: "🎵" },
  { type: CreatorType.Lifestyle, label: "Lifestyle / IRL", emoji: "✨" },
  { type: CreatorType.TechEducation, label: "Tech / Education", emoji: "💻" },
  { type: CreatorType.ArtDesign, label: "Art / Design", emoji: "🎨" },
  { type: CreatorType.Other, label: "Other", emoji: "🌟" },
];

const GOAL_TYPES: { type: GoalType; label: string; platform: string }[] = [
  { type: GoalType.TwitchFollowers, label: "Reach X Twitch followers", platform: "Twitch" },
  { type: GoalType.TwitchAvgViewers, label: "Hit X avg viewers on Twitch", platform: "Twitch" },
  { type: GoalType.YouTubeSubscribers, label: "Reach X YouTube subscribers", platform: "YouTube" },
  { type: GoalType.YouTubeMonthlyViews, label: "Reach X monthly YouTube views", platform: "YouTube" },
];

/** HUD corner brackets */
function HudCorners() {
  const cornerStyle = (pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties => ({
    position: "absolute",
    width: "12px",
    height: "12px",
    borderColor: "#8B9C3A",
    borderStyle: "solid",
    opacity: 0.5,
    ...(pos === "tl" && { top: 8, left: 8, borderWidth: "1px 0 0 1px" }),
    ...(pos === "tr" && { top: 8, right: 8, borderWidth: "1px 1px 0 0" }),
    ...(pos === "bl" && { bottom: 8, left: 8, borderWidth: "0 0 1px 1px" }),
    ...(pos === "br" && { bottom: 8, right: 8, borderWidth: "0 1px 1px 0" }),
  });
  return (
    <>
      <div style={cornerStyle("tl")} />
      <div style={cornerStyle("tr")} />
      <div style={cornerStyle("bl")} />
      <div style={cornerStyle("br")} />
    </>
  );
}

function ProgressSteps({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center gap-2 mb-2">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === current ? "32px" : "12px",
              background:
                i < current ? "#8B9C3A" : i === current ? "#A8BA48" : "#2A2A34",
            }}
          />
        ))}
      </div>
      <p className="text-center text-[10px] uppercase tracking-widest" style={{ color: "#555560" }}>
        Step {current + 1} of {total}
      </p>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-8"
      style={{
        background: "#111115",
        border: "1px solid #363640",
        position: "relative",
      }}
    >
      <HudCorners />
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0A0A0C",
  border: "1px solid #363640",
  color: "#E8E8E8",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "14px",
  outline: "none",
};

function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
      style={{ background: "#8B9C3A", color: "#000" }}
      onMouseOver={(e) =>
        !(disabled || loading) && (e.currentTarget.style.background = "#A8BA48")
      }
      onMouseOut={(e) => (e.currentTarget.style.background = "#8B9C3A")}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OnboardingData>({
    creatorHandle: "",
    displayName: "",
    creatorType: null,
    twitchConnected: false,
    youtubeConnected: false,
    goalType: null,
    goalTargetValue: null,
  });

  function update(patch: Partial<OnboardingData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  async function handleConnect(platform: "twitch" | "youtube") {
    setConnectingPlatform(platform);
    setConnectError(null);
    try {
      const res = await fetch(`/api/connect/${platform}/url`);
      if (!res.ok) throw new Error("Failed to get URL");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setConnectError(`Could not connect to ${platform}. Skip and connect later.`);
      setConnectingPlatform(null);
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.auth.updateUser({
          data: {
            full_name: formData.displayName,
            creator_handle: formData.creatorHandle,
            creator_type: formData.creatorType,
          },
        });

        if (formData.goalType && formData.goalTargetValue) {
          const platformMap: Record<GoalType, "twitch" | "youtube"> = {
            [GoalType.TwitchFollowers]: "twitch",
            [GoalType.TwitchAvgViewers]: "twitch",
            [GoalType.YouTubeSubscribers]: "youtube",
            [GoalType.YouTubeMonthlyViews]: "youtube",
          };

          await supabase.from("goals").insert({
            user_id: user.id,
            type: formData.goalType,
            target_value: formData.goalTargetValue,
            current_value: 0,
            platform: platformMap[formData.goalType],
            completed: false,
          });
        }

        await supabase
          .from("profiles")
          .upsert({ id: user.id, onboarding_complete: true });
      }
    } catch {
      // Best-effort
    } finally {
      setSubmitting(false);
      router.push("/dashboard");
    }
  }

  // ─── Step 0: Welcome ─────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <>
        <ProgressSteps current={0} total={TOTAL_STEPS} />
        <StepCard>
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "#E8E8E8" }}>
            Welcome to BrandCMD
          </h1>
          <p className="mb-6" style={{ color: "#888896" }}>
            Your creator command center. Setup takes under 2 minutes.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "#888896" }}>
                Creator handle
              </label>
              <input
                type="text"
                placeholder="e.g. tasha_creates"
                value={formData.creatorHandle}
                onChange={(e) => update({ creatorHandle: e.target.value })}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "#888896" }}>
                Display name
              </label>
              <input
                type="text"
                placeholder="e.g. Tasha Creates"
                value={formData.displayName}
                onChange={(e) => update({ displayName: e.target.value })}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              />
            </div>
          </div>
          <div className="mt-6">
            <PrimaryButton
              onClick={next}
              disabled={!formData.creatorHandle.trim() || !formData.displayName.trim()}
            >
              Continue →
            </PrimaryButton>
          </div>
        </StepCard>
      </>
    );
  }

  // ─── Step 1: Creator Type ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <>
        <ProgressSteps current={1} total={TOTAL_STEPS} />
        <StepCard>
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "#E8E8E8" }}>
            What kind of creator are you?
          </h1>
          <p className="mb-6" style={{ color: "#888896" }}>
            We&apos;ll tailor your dashboard to your content type.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CREATOR_TYPES.map((ct) => {
              const selected = formData.creatorType === ct.type;
              return (
                <button
                  key={ct.type}
                  type="button"
                  onClick={() => update({ creatorType: ct.type })}
                  className="relative flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all"
                  style={{
                    border: selected ? "1px solid #8B9C3A" : "1px solid #2A2A34",
                    background: selected ? "rgba(74,84,32,0.2)" : "#0A0A0C",
                  }}
                  onMouseOver={(e) => {
                    if (!selected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#8B9C3A";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,84,32,0.1)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!selected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A34";
                      (e.currentTarget as HTMLButtonElement).style.background = "#0A0A0C";
                    }
                  }}
                >
                  {selected && (
                    <span
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: "#8B9C3A" }}
                    >
                      <Check className="h-3 w-3" style={{ color: "#000" }} />
                    </span>
                  )}
                  <span className="text-2xl">{ct.emoji}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: selected ? "#A8BA48" : "#888896" }}
                  >
                    {ct.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-6">
            <PrimaryButton onClick={next} disabled={!formData.creatorType}>
              Continue →
            </PrimaryButton>
          </div>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm"
              style={{ color: "#555560" }}
            >
              ← Back
            </button>
          </div>
        </StepCard>
      </>
    );
  }

  // ─── Step 2: Connect Twitch ──────────────────────────────────────────────
  if (step === 2) {
    return (
      <>
        <ProgressSteps current={2} total={TOTAL_STEPS} />
        <StepCard>
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "#E8E8E8" }}>
            Connect your Twitch
          </h1>
          <p className="mb-6" style={{ color: "#888896" }}>
            Pull in followers, subscribers, stream stats, and more.
          </p>

          <div
            className="mb-4 rounded-xl p-5"
            style={{ border: "1px solid #2A2A34", background: "#0A0A0C" }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
                style={{ background: "#9146FF" }}
              >
                T
              </div>
              <div>
                <p className="font-semibold" style={{ color: "#E8E8E8" }}>Twitch</p>
                <p className="text-xs" style={{ color: "#555560" }}>
                  Followers · subscribers · chat stats · stream analytics
                </p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "#555560" }}>
              BrandCMD never posts or modifies your content. Read-only access only.
            </p>
          </div>

          {connectError && (
            <p className="mb-3 text-sm" style={{ color: "#E04545" }}>{connectError}</p>
          )}

          <PrimaryButton
            onClick={() => handleConnect("twitch")}
            loading={connectingPlatform === "twitch"}
          >
            <ExternalLink className="h-4 w-4" />
            Connect Twitch →
          </PrimaryButton>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm"
              style={{ color: "#555560" }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={next}
              className="text-sm underline"
              style={{ color: "#555560" }}
            >
              Skip for now
            </button>
          </div>
        </StepCard>
      </>
    );
  }

  // ─── Step 3: Connect YouTube ─────────────────────────────────────────────
  if (step === 3) {
    return (
      <>
        <ProgressSteps current={3} total={TOTAL_STEPS} />
        <StepCard>
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "#E8E8E8" }}>
            Connect your YouTube
          </h1>
          <p className="mb-6" style={{ color: "#888896" }}>
            Track subscribers, views, watch time, and top videos.
          </p>

          <div
            className="mb-4 rounded-xl p-5"
            style={{ border: "1px solid #2A2A34", background: "#0A0A0C" }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
                style={{ background: "#FF0000" }}
              >
                Y
              </div>
              <div>
                <p className="font-semibold" style={{ color: "#E8E8E8" }}>YouTube</p>
                <p className="text-xs" style={{ color: "#555560" }}>
                  Subscribers · views · watch time · revenue estimates
                </p>
              </div>
            </div>
            <p className="text-xs" style={{ color: "#555560" }}>
              BrandCMD never posts or modifies your content. Read-only access only.
            </p>
          </div>

          {connectError && (
            <p className="mb-3 text-sm" style={{ color: "#E04545" }}>{connectError}</p>
          )}

          <PrimaryButton
            onClick={() => handleConnect("youtube")}
            loading={connectingPlatform === "youtube"}
          >
            <ExternalLink className="h-4 w-4" />
            Connect YouTube via Google →
          </PrimaryButton>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm"
              style={{ color: "#555560" }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={next}
              className="text-sm underline"
              style={{ color: "#555560" }}
            >
              Skip for now
            </button>
          </div>
        </StepCard>
      </>
    );
  }

  // ─── Step 4: First Goal ──────────────────────────────────────────────────
  if (step === 4) {
    return (
      <>
        <ProgressSteps current={4} total={TOTAL_STEPS} />
        <StepCard>
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "#E8E8E8" }}>
            Set your first goal
          </h1>
          <p className="mb-6" style={{ color: "#888896" }}>
            BrandCMD will auto-complete this goal when you hit your target.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "#888896" }}>
                Goal type
              </label>
              <select
                value={formData.goalType ?? ""}
                onChange={(e) =>
                  update({ goalType: e.target.value ? (e.target.value as GoalType) : null })
                }
                style={{ ...inputStyle, cursor: "pointer" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
              >
                <option value="" style={{ background: "#111115" }}>Select a goal…</option>
                {GOAL_TYPES.map((g) => (
                  <option key={g.type} value={g.type} style={{ background: "#111115" }}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.goalType && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: "#888896" }}>
                  Target
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1000"
                  value={formData.goalTargetValue ?? ""}
                  onChange={(e) =>
                    update({
                      goalTargetValue: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#8B9C3A")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#363640")}
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            <PrimaryButton
              onClick={handleFinish}
              loading={submitting}
              disabled={
                submitting ||
                (formData.goalType !== null && !formData.goalTargetValue)
              }
            >
              Launch my dashboard →
            </PrimaryButton>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-sm"
              style={{ color: "#555560" }}
            >
              ← Back
            </button>
            {!formData.goalType && (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="text-sm underline"
                style={{ color: "#555560" }}
              >
                Skip and go to dashboard
              </button>
            )}
          </div>
        </StepCard>
      </>
    );
  }

  return null;
}
