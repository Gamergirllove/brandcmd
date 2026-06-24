"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnalytics, getConnectedPlatforms } from "@/hooks/useAnalytics";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import type { Platform } from "@/types";

const MVP_PLATFORMS = [
  {
    id: "twitch" as Platform,
    name: "Twitch",
    color: "#9146FF",
    description: "Followers, subscribers, avg viewers, hours streamed, chat stats",
  },
  {
    id: "youtube" as Platform,
    name: "YouTube",
    color: "#FF0000",
    description: "Subscribers, views, watch time, revenue estimates, top videos",
  },
];

const RELEASE_2_PLATFORMS = [
  {
    id: "tiktok",
    name: "TikTok",
    color: "#555560",
    description: "Followers, views, likes, trending content analytics",
  },
  {
    id: "discord",
    name: "Discord",
    color: "#555560",
    description: "Server members, activity, growth trends, engagement",
  },
  {
    id: "kick",
    name: "Kick.com",
    color: "#555560",
    description: "Stream metrics, followers, subscriber analytics",
  },
];

const FUTURE_PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "#E1306C" },
  { id: "twitter", name: "Twitter / X", color: "#1DA1F2" },
  { id: "pinterest", name: "Pinterest", color: "#E60023" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2" },
  { id: "facebook", name: "Facebook", color: "#1877F2" },
];

async function getConnectUrl(platform: string): Promise<string> {
  const res = await fetch(`/api/connect/${platform}/url`);
  if (!res.ok) throw new Error("Failed to get connect URL");
  const json = await res.json();
  return json.url;
}

export default function ConnectPage() {
  const { data, refetch } = useAnalytics({ days: 1 });
  const [connectedSet, setConnectedSet] = useState<Set<Platform>>(new Set());
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const loadConnected = useCallback(async () => {
    setLoading(true);
    const connected = await getConnectedPlatforms();
    setConnectedSet(new Set(connected));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConnected();
  }, [loadConnected]);

  async function handleConnect(platformId: string) {
    setConnecting(platformId);
    setConnectError(null);
    try {
      const url = await getConnectUrl(platformId);
      window.location.href = url;
    } catch {
      setConnectError(`Could not start ${platformId} connection. Please try again.`);
      setConnecting(null);
    }
  }

  async function handleDisconnect(platform: Platform) {
    try {
      await fetch(`/api/connect/${platform}`, { method: "DELETE" });
      setConnectedSet((prev) => {
        const next = new Set(prev);
        next.delete(platform);
        return next;
      });
      refetch();
    } catch {
      // ignore
    }
  }

  const connectedCount = connectedSet.size;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#E8E8E8" }}>
          Connected Platforms
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#888896" }}>
          Connect your creator accounts to start tracking analytics.
        </p>
      </div>

      {connectError && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            background: "rgba(224,69,69,0.08)",
            border: "1px solid rgba(224,69,69,0.3)",
            color: "#E04545",
          }}
        >
          {connectError}
        </div>
      )}

      {/* Connected section */}
      {connectedCount > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: "#3DBA6E" }} />
            <h2 className="text-sm font-semibold" style={{ color: "#E8E8E8" }}>Connected</h2>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "rgba(61,186,110,0.1)",
                border: "1px solid rgba(61,186,110,0.2)",
                color: "#3DBA6E",
              }}
            >
              {connectedCount} active
            </span>
          </div>
          <div className="space-y-2">
            {MVP_PLATFORMS.filter((p) => connectedSet.has(p.id)).map((p) => {
              const metrics = data?.platforms.find((pm) => pm.platform === p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    background: "rgba(74,84,32,0.1)",
                    border: "1px solid #8B9C3A",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ background: p.color }}
                    >
                      {p.name[0]}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: "#E8E8E8" }}>{p.name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1" style={{ color: "#3DBA6E" }}>
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "#3DBA6E" }}
                          />
                          Connected
                        </span>
                        {metrics && (
                          <span style={{ color: "#555560" }}>
                            · {metrics.followers.toLocaleString()} followers
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(p.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ border: "1px solid #363640", color: "#888896", background: "transparent" }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "rgba(224,69,69,0.4)";
                      e.currentTarget.style.color = "#E04545";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "#363640";
                      e.currentTarget.style.color = "#888896";
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* MVP — available to connect */}
      {MVP_PLATFORMS.some((p) => !connectedSet.has(p.id)) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "#E8E8E8" }}>
            {connectedCount > 0 ? "Available to connect" : "Connect a platform"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MVP_PLATFORMS.filter((p) => !connectedSet.has(p.id)).map((p) => (
              <div
                key={p.id}
                className="rounded-xl p-4"
                style={{ background: "#111115", border: "1px solid #2A2A34" }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white"
                    style={{ background: p.color }}
                  >
                    {p.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: "#E8E8E8" }}>{p.name}</p>
                  </div>
                </div>
                <p className="mb-4 text-xs" style={{ color: "#888896" }}>{p.description}</p>
                <button
                  onClick={() => handleConnect(p.id)}
                  disabled={connecting === p.id}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold transition-colors disabled:opacity-60"
                  style={{ background: "#8B9C3A", color: "#000" }}
                  onMouseOver={(e) =>
                    !connecting && (e.currentTarget.style.background = "#A8BA48")
                  }
                  onMouseOut={(e) => (e.currentTarget.style.background = "#8B9C3A")}
                >
                  {connecting === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  Connect {p.name}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Release 2 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "#555560" }}>
          Coming in Release 2
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {RELEASE_2_PLATFORMS.map((p) => (
            <div
              key={p.id}
              className="rounded-xl p-4"
              style={{ background: "#111115", border: "1px solid #2A2A34", opacity: 0.7 }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ background: "#18181E", border: "1px solid #2A2A34" }}
                >
                  {p.name[0]}
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    background: "#18181E",
                    border: "1px solid #2A2A34",
                    color: "#555560",
                  }}
                >
                  Coming soon
                </span>
              </div>
              <p className="mb-1 text-sm font-semibold" style={{ color: "#888896" }}>{p.name}</p>
              <p className="text-xs" style={{ color: "#555560" }}>{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Future */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "#555560" }}>
          Future platforms
        </h2>
        <div className="flex flex-wrap gap-2">
          {FUTURE_PLATFORMS.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
              style={{
                background: "#0A0A0C",
                border: "1px solid #2A2A34",
                color: "#555560",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color, opacity: 0.6 }}
              />
              {p.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
