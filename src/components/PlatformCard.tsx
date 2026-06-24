"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { connectPlatform, disconnectPlatform } from "@/hooks/useAnalytics";
import { PLATFORM_CONFIGS, type Platform, type PlatformMetrics } from "@/types";
import { formatNumber } from "@/lib/utils";
import {
  Users,
  Eye,
  Heart,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

interface PlatformCardProps {
  platform: Platform;
  metrics?: PlatformMetrics;
  isLoading?: boolean;
  onStatusChange?: () => void;
}

function PlatformIcon({ platform }: { platform: Platform }) {
  const config = PLATFORM_CONFIGS[platform];
  return (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
      style={{ backgroundColor: config.color, color: config.textColor }}
      aria-label={config.name}
    >
      {config.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function PlatformCard({
  platform,
  metrics,
  isLoading = false,
  onStatusChange,
}: PlatformCardProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = PLATFORM_CONFIGS[platform];
  const connected = metrics?.connected ?? false;

  async function handleConnect() {
    setActionLoading(true);
    setError(null);
    try {
      await connectPlatform(platform);
      onStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisconnect() {
    setActionLoading(true);
    setError(null);
    try {
      await disconnectPlatform(platform);
      onStatusChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div
        className="h-1 w-full"
        style={{ backgroundColor: config.color }}
        aria-hidden
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <PlatformIcon platform={platform} />
            <div>
              <p className="font-semibold">{config.name}</p>
              {metrics?.username && (
                <p className="text-sm text-muted-foreground">
                  @{metrics.username}
                </p>
              )}
              <div className="mt-1">
                {connected ? (
                  <Badge variant="success" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <XCircle className="h-3 w-3" />
                    Not connected
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="shrink-0"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={actionLoading}
              className="shrink-0 text-white"
              style={{ backgroundColor: config.color }}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-destructive">{error}</p>
        )}

        {connected && metrics && (
          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
            <div className="flex flex-col items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {formatNumber(metrics.followers)}
              </span>
              <span className="text-xs text-muted-foreground">Followers</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {formatNumber(metrics.views)}
              </span>
              <span className="text-xs text-muted-foreground">Views</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {formatNumber(metrics.likes)}
              </span>
              <span className="text-xs text-muted-foreground">Likes</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
