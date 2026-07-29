"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnections } from "@/hooks/useAnalytics";
import { createGoal, fetchConnectUrl, updateProfile } from "@/lib/api";
import {
  CreatorType,
  GOAL_LABELS,
  GOAL_PLATFORMS,
  GoalType,
  type OnboardingData,
} from "@/types";
import { Loader2, ExternalLink, Check, AlertCircle } from "lucide-react";

const TOTAL_STEPS = 5;

// Where the OAuth callback returns to, and which step to resume on.
const RETURN_PATH = "/onboarding";
const STEP_FOR_PLATFORM: Record<string, number> = { twitch: 2, youtube: 3 };

const CREATOR_TYPES: { type: CreatorType; label: string; emoji: string }[] = [
  { type: CreatorType.Gaming, label: "Gaming", emoji: "🎮" },
  { type: CreatorType.Music, label: "Music", emoji: "🎵" },
  { type: CreatorType.Lifestyle, label: "Lifestyle / IRL", emoji: "✨" },
  { type: CreatorType.TechEducation, label: "Tech / Education", emoji: "💻" },
  { type: CreatorType.ArtDesign, label: "Art / Design", emoji: "🎨" },
  { type: CreatorType.Other, label: "Other", emoji: "🌟" },
];

const GOAL_TYPES = Object.values(GoalType);

/** HUD corner brackets */
function HudCorners() {
  const cornerStyle = (pos: "tl" | "tr" | "bl" | "br"): React.CSSProperties => ({
    position: "absolute",
    width: "12px",
    height: "12px",
    borderColor: "var(--brand)",
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
              background: i < current ? "var(--brand)" : i === current ? "var(--brand-light)" : "var(--line)",
            }}
          />
        ))}
      </div>
      <p
        className="text-center text-[10px] uppercase tracking-widest"
        style={{ color: "var(--text-dim)" }}
      >
        Step {current + 1} of {total}
      </p>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-8"
      style={{ background: "var(--surface)", border: "1px solid var(--line-strong)", position: "relative" }}
    >
      <HudCorners />
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--line-strong)",
  color: "var(--text)",
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
      style={{ background: "var(--brand)", color: "#000" }}
      onMouseOver={(e) => !(disabled || loading) && (e.currentTarget.style.background = "var(--brand-light)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Shared markup for the two "connect a platform" steps. */
function ConnectStep({
  platform,
  title,
  blurb,
  metrics,
  color,
  letter,
  buttonLabel,
  connected,
  connecting,
  error,
  onConnect,
  onBack,
  onNext,
}: {
  platform: "twitch" | "youtube";
  title: string;
  blurb: string;
  metrics: string;
  color: string;
  letter: string;
  buttonLabel: string;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <StepCard>
      <h1 className="mb-1 text-2xl font-bold" style={{ color: "var(--text)" }}>
        {title}
      </h1>
      <p className="mb-6" style={{ color: "var(--text-muted)" }}>
        {blurb}
      </p>

      <div
        className="mb-4 rounded-xl p-5"
        style={{
          border: connected ? "1px solid var(--brand)" : "1px solid var(--line)",
          background: connected ? "var(--brand-wash)" : "var(--bg)",
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ background: color }}
          >
            {letter}
          </div>
          <div className="flex-1">
            <p className="font-semibold" style={{ color: "var(--text)" }}>
              {title.replace("Connect your ", "")}
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              {metrics}
            </p>
          </div>
          {connected && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: "var(--success-wash)",
                border: "1px solid rgba(61,186,110,0.25)",
                color: "var(--success)",
              }}
            >
              <Check className="h-3 w-3" /> Connected
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          BrandCMD never posts or modifies your content. Read-only access only.
        </p>
      </div>

      {error && (
        <p className="mb-3 flex items-center gap-1.5 text-sm" style={{ color: "var(--danger)" }}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {connected ? (
        <PrimaryButton onClick={onNext}>Continue →</PrimaryButton>
      ) : (
        <PrimaryButton onClick={onConnect} loading={connecting}>
          <ExternalLink className="h-4 w-4" />
          {buttonLabel}
        </PrimaryButton>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-sm" style={{ color: "var(--text-dim)" }}>
          ← Back
        </button>
        {!connected && (
          <button
            type="button"
            onClick={onNext}
            className="text-sm underline"
            style={{ color: "var(--text-dim)" }}
          >
            Skip for now
          </button>
        )}
      </div>
    </StepCard>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: connections, refetch: refetchConnections } = useConnections();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OnboardingData>({
    creatorHandle: "",
    displayName: "",
    creatorType: null,
    twitchConnected: false,
    youtubeConnected: false,
    goalType: null,
    goalTargetValue: null,
  });

  // Returning from an OAuth round trip: resume on the step we left from.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected && STEP_FOR_PLATFORM[connected] !== undefined) {
      setStep(STEP_FOR_PLATFORM[connected]);
      refetchConnections();
    } else if (error) {
      setConnectError(error);
    }
  }, [searchParams, refetchConnections]);

  const isConnected = (platform: string) =>
    connections.some((c) => c.platform === platform && c.connected);

  function update(patch: Partial<OnboardingData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleConnect(platform: "twitch" | "youtube") {
    setConnectingPlatform(platform);
    setConnectError(null);
    try {
      window.location.href = await fetchConnectUrl(platform, RETURN_PATH);
    } catch (err) {
      setConnectError(
        err instanceof Error
          ? err.message
          : `Could not connect to ${platform}. Skip and connect later.`
      );
      setConnectingPlatform(null);
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    setFinishError(null);

    try {
      await updateProfile({
        displayName: formData.displayName,
        creatorHandle: formData.creatorHandle,
        creatorType: formData.creatorType ?? undefined,
        onboardingComplete: true,
      });

      if (formData.goalType && formData.goalTargetValue) {
        await createGoal({
          type: formData.goalType,
          platform: GOAL_PLATFORMS[formData.goalType],
          targetValue: formData.goalTargetValue,
        });
      }
    } catch (err) {
      // Don't strand the user in the wizard — but do tell them what failed,
      // since the profile save is what marks onboarding complete.
      setFinishError(
        err instanceof Error ? err.message : "Could not save your setup. Please try again."
      );
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  // ─── Step 0: Welcome ─────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <>
        <ProgressSteps current={0} total={TOTAL_STEPS} />
        <StepCard>
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "var(--text)" }}>
            Welcome to BrandCMD
          </h1>
          <p className="mb-6" style={{ color: "var(--text-muted)" }}>
            Your creator command center. Setup takes under 2 minutes.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Creator handle
              </label>
              <input
                type="text"
                placeholder="e.g. tasha_creates"
                value={formData.creatorHandle}
                onChange={(e) => update({ creatorHandle: e.target.value })}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Display name
              </label>
              <input
                type="text"
                placeholder="e.g. Tasha Creates"
                value={formData.displayName}
                onChange={(e) => update({ displayName: e.target.value })}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
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
          <h1 className="mb-1 text-2xl font-bold" style={{ color: "var(--text)" }}>
            What kind of creator are you?
          </h1>
          <p className="mb-6" style={{ color: "var(--text-muted)" }}>
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
                    border: selected ? "1px solid var(--brand)" : "1px solid var(--line)",
                    background: selected ? "var(--brand-wash-strong)" : "var(--bg)",
                  }}
                  onMouseOver={(e) => {
                    if (!selected) {
                      e.currentTarget.style.borderColor = "var(--brand)";
                      e.currentTarget.style.background = "var(--brand-wash)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!selected) {
                      e.currentTarget.style.borderColor = "var(--line)";
                      e.currentTarget.style.background = "var(--bg)";
                    }
                  }}
                >
                  {selected && (
                    <span
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: "var(--brand)" }}
                    >
                      <Check className="h-3 w-3" style={{ color: "#000" }} />
                    </span>
                  )}
                  <span className="text-2xl">{ct.emoji}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: selected ? "var(--brand-light)" : "var(--text-muted)" }}
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
            <button type="button" onClick={back} className="text-sm" style={{ color: "var(--text-dim)" }}>
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
        <ConnectStep
          platform="twitch"
          title="Connect your Twitch"
          blurb="Pull in followers, subscribers, stream stats, and more."
          metrics="Followers · subscribers · broadcasts · VOD views"
          color="var(--twitch)"
          letter="T"
          buttonLabel="Connect Twitch →"
          connected={isConnected("twitch")}
          connecting={connectingPlatform === "twitch"}
          error={connectError}
          onConnect={() => handleConnect("twitch")}
          onBack={back}
          onNext={next}
        />
      </>
    );
  }

  // ─── Step 3: Connect YouTube ─────────────────────────────────────────────
  if (step === 3) {
    return (
      <>
        <ProgressSteps current={3} total={TOTAL_STEPS} />
        <ConnectStep
          platform="youtube"
          title="Connect your YouTube"
          blurb="Track subscribers, views, likes and comments."
          metrics="Subscribers · views · likes · comments"
          color="var(--youtube)"
          letter="Y"
          buttonLabel="Connect YouTube via Google →"
          connected={isConnected("youtube")}
          connecting={connectingPlatform === "youtube"}
          error={connectError}
          onConnect={() => handleConnect("youtube")}
          onBack={back}
          onNext={next}
        />
      </>
    );
  }

  // ─── Step 4: First Goal ──────────────────────────────────────────────────
  return (
    <>
      <ProgressSteps current={4} total={TOTAL_STEPS} />
      <StepCard>
        <h1 className="mb-1 text-2xl font-bold" style={{ color: "var(--text)" }}>
          Set your first goal
        </h1>
        <p className="mb-6" style={{ color: "var(--text-muted)" }}>
          BrandCMD will auto-complete this goal when you hit your target.
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Goal type
            </label>
            <select
              value={formData.goalType ?? ""}
              onChange={(e) =>
                update({ goalType: e.target.value ? (e.target.value as GoalType) : null })
              }
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
            >
              <option value="" style={{ background: "var(--surface)" }}>
                Select a goal…
              </option>
              {GOAL_TYPES.map((type) => (
                <option key={type} value={type} style={{ background: "var(--surface)" }}>
                  {GOAL_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {formData.goalType && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Target
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1000"
                value={formData.goalTargetValue ?? ""}
                onChange={(e) =>
                  update({ goalTargetValue: e.target.value ? Number(e.target.value) : null })
                }
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--line-strong)")}
              />
            </div>
          )}
        </div>

        {finishError && (
          <p className="mt-4 flex items-center gap-1.5 text-sm" style={{ color: "var(--danger)" }}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            {finishError}
          </p>
        )}

        <div className="mt-6">
          <PrimaryButton
            onClick={handleFinish}
            loading={submitting}
            disabled={
              submitting || (formData.goalType !== null && !formData.goalTargetValue)
            }
          >
            Launch my dashboard →
          </PrimaryButton>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={back} className="text-sm" style={{ color: "var(--text-dim)" }}>
            ← Back
          </button>
          {!formData.goalType && (
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="text-sm underline"
              style={{ color: "var(--text-dim)" }}
            >
              Skip and go to dashboard
            </button>
          )}
        </div>
      </StepCard>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
