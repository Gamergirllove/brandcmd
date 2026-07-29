"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConnections } from "@/hooks/useAnalytics";
import { disconnectPlatform, fetchConnectUrl } from "@/lib/api";
import { PLATFORM_CONFIGS, type Platform } from "@/types";
import { Loader2, CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";

const MVP_PLATFORMS: { id: Platform; description: string }[] = [
  {
    id: "twitch",
    description: "Followers, subscribers, broadcasts, hours streamed, VOD views",
  },
  {
    id: "youtube",
    description: "Subscribers, views, likes, comments, daily watch analytics",
  },
];

/** Supported by the API and connectable once credentials are configured. */
const ADDITIONAL_PLATFORMS: { id: Platform; description: string }[] = [
  { id: "tiktok", description: "Followers, views, likes, trending content" },
  { id: "instagram", description: "Followers, reach, impressions, media engagement" },
  { id: "twitter", description: "Followers, impressions, likes, replies, reposts" },
  { id: "facebook", description: "Page followers, reach, post engagement" },
  { id: "linkedin", description: "Followers, impressions, post engagement" },
  { id: "pinterest", description: "Followers, pin impressions, saves" },
  { id: "snapchat", description: "Audience and story performance" },
];

/** No integration exists for these yet. */
const ROADMAP_PLATFORMS: Platform[] = ["discord", "kick"];

function ConnectPageInner() {
  const searchParams = useSearchParams();
  const { data: connections, isLoading, refetch } = useConnections();

  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [disconnecting, setDisconnecting] = useState<Platform | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // The backend bounces the OAuth callback back here with the result.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected) {
      const name = PLATFORM_CONFIGS[connected as Platform]?.name ?? connected;
      setMessage({ kind: "ok", text: `${name} connected.` });
      refetch();
    } else if (error) {
      setMessage({ kind: "error", text: error });
    }
  }, [searchParams, refetch]);

  const statusFor = (platform: Platform) =>
    connections.find((c) => c.platform === platform);

  async function handleConnect(platform: Platform) {
    setConnecting(platform);
    setMessage(null);
    try {
      window.location.href = await fetchConnectUrl(platform);
    } catch (err) {
      setMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : `Could not start the ${platform} connection. Please try again.`,
      });
      setConnecting(null);
    }
  }

  async function handleDisconnect(platform: Platform) {
    setDisconnecting(platform);
    try {
      await disconnectPlatform(platform);
      await refetch();
      setMessage({
        kind: "ok",
        text: `${PLATFORM_CONFIGS[platform].name} disconnected.`,
      });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Could not disconnect.",
      });
    } finally {
      setDisconnecting(null);
    }
  }

  const connectedList = connections.filter((c) => c.connected);
  const available = [...MVP_PLATFORMS, ...ADDITIONAL_PLATFORMS].filter((p) => {
    const status = statusFor(p.id);
    return status?.configured && !status.connected;
  });
  const unconfigured = [...MVP_PLATFORMS, ...ADDITIONAL_PLATFORMS].filter(
    (p) => !statusFor(p.id)?.configured
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          Connected Platforms
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Connect your creator accounts to start tracking analytics.
        </p>
      </div>

      {message && (
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
          style={
            message.kind === "ok"
              ? {
                  background: "var(--success-wash)",
                  border: "1px solid rgba(61,186,110,0.3)",
                  color: "var(--success)",
                }
              : {
                  background: "var(--danger-wash)",
                  border: "1px solid rgba(224,69,69,0.3)",
                  color: "var(--danger)",
                }
          }
        >
          {message.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl"
              style={{ background: "var(--surface-2)" }}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Connected */}
          {connectedList.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--success)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Connected
                </h2>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "var(--success-wash)",
                    border: "1px solid rgba(61,186,110,0.2)",
                    color: "var(--success)",
                  }}
                >
                  {connectedList.length} active
                </span>
              </div>
              <div className="space-y-2">
                {connectedList.map((connection) => {
                  const config = PLATFORM_CONFIGS[connection.platform];
                  return (
                    <div
                      key={connection.platform}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{
                        background: "var(--brand-wash)",
                        border: "1px solid var(--brand)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                          style={{ background: config.color }}
                        >
                          {config.name[0]}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: "var(--text)" }}>
                            {config.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1" style={{ color: "var(--success)" }}>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "var(--success)" }}
                              />
                              Connected
                            </span>
                            {connection.username && (
                              <span style={{ color: "var(--text-dim)" }}>· @{connection.username}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect(connection.platform)}
                        disabled={disconnecting === connection.platform}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                        style={{
                          border: "1px solid var(--line-strong)",
                          color: "var(--text-muted)",
                          background: "transparent",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = "rgba(224,69,69,0.4)";
                          e.currentTarget.style.color = "var(--danger)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = "var(--line-strong)";
                          e.currentTarget.style.color = "var(--text-muted)";
                        }}
                      >
                        {disconnecting === connection.platform ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Disconnect"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Available to connect */}
          {available.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
                {connectedList.length > 0 ? "Available to connect" : "Connect a platform"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {available.map((p) => {
                  const config = PLATFORM_CONFIGS[p.id];
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl p-4"
                      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
                          style={{ background: config.color }}
                        >
                          {config.name[0]}
                        </div>
                        <p className="font-semibold" style={{ color: "var(--text)" }}>
                          {config.name}
                        </p>
                      </div>
                      <p className="mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
                        {p.description}
                      </p>
                      <button
                        onClick={() => handleConnect(p.id)}
                        disabled={connecting === p.id}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors disabled:opacity-60"
                        style={{ background: "var(--brand)", color: "#000" }}
                        onMouseOver={(e) =>
                          !connecting && (e.currentTarget.style.background = "var(--brand-light)")
                        }
                        onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
                      >
                        {connecting === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        Connect {config.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Supported by the API, but this deployment has no credentials for them */}
          {unconfigured.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
                Needs OAuth credentials
              </h2>
              <p className="mb-3 text-xs" style={{ color: "var(--text-dim)" }}>
                These integrations are built and ready — add the platform&apos;s client ID and
                secret to the backend environment to enable them.
              </p>
              <div className="flex flex-wrap gap-2">
                {unconfigured.map((p) => {
                  const config = PLATFORM_CONFIGS[p.id];
                  return (
                    <span
                      key={p.id}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                      style={{
                        background: "var(--bg)",
                        border: "1px solid var(--line)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: config.color, opacity: 0.6 }}
                      />
                      {config.name}
                    </span>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Roadmap */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
          On the roadmap
        </h2>
        <div className="flex flex-wrap gap-2">
          {ROADMAP_PLATFORMS.map((id) => {
            const config = PLATFORM_CONFIGS[id];
            return (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  color: "var(--text-dim)",
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: config.color, opacity: 0.6 }}
                />
                {config.name}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function ConnectPage() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole
  // route into client-side rendering at build time.
  return (
    <Suspense fallback={null}>
      <ConnectPageInner />
    </Suspense>
  );
}
