"use client";

import { useState } from "react";
import Link from "next/link";
import { useConnections, useGoals } from "@/hooks/useAnalytics";
import { createGoal, deleteGoal, updateGoal } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import {
  GOAL_LABELS,
  GOAL_PLATFORMS,
  GoalType,
  PLATFORM_CONFIGS,
  type Goal,
} from "@/types";
import { Loader2, Plus, Target, Trash2, Check, AlertCircle, X } from "lucide-react";

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

function GoalCard({
  goal,
  onDelete,
  onEdit,
  busy,
}: {
  goal: Goal;
  onDelete: () => void;
  onEdit: (target: number) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(String(goal.targetValue));

  const config = PLATFORM_CONFIGS[goal.platform];
  const label = GOAL_LABELS[goal.type] ?? goal.type;
  const pct = Math.min(goal.progressPct, 100);

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--surface)",
        border: goal.completed ? "1px solid var(--brand)" : "1px solid var(--line)",
        borderLeft: `2px solid ${config.color}`,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: config.color }}
          >
            {config.name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {label.replace("X", formatNumber(goal.targetValue))}
            </p>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              {config.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {goal.completed && (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--success-wash)",
                border: "1px solid rgba(61,186,110,0.25)",
                color: "var(--success)",
              }}
            >
              <Check className="h-3 w-3" /> Done
            </span>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete goal"
            className="transition-colors disabled:opacity-50"
            style={{ color: "var(--text-dim)" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "var(--danger)")}
            onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span style={{ color: "var(--text)" }}>
          <span className="text-base font-bold">{formatNumber(goal.currentValue)}</span>
          <span style={{ color: "var(--text-dim)" }}> / {formatNumber(goal.targetValue)}</span>
        </span>
        <span style={{ color: "var(--brand-light)" }}>{pct.toFixed(0)}%</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: goal.completed ? "var(--success)" : "var(--brand)",
          }}
        />
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...inputStyle, padding: "6px 10px" }}
          />
          <button
            onClick={() => {
              const value = Number(target);
              if (value > 0) onEdit(value);
              setEditing(false);
            }}
            className="rounded-lg px-3 py-1.5 text-xs font-bold"
            style={{ background: "var(--brand)", color: "#000" }}
          >
            Save
          </button>
          <button
            onClick={() => {
              setTarget(String(goal.targetValue));
              setEditing(false);
            }}
            aria-label="Cancel"
            style={{ color: "var(--text-dim)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mt-3 text-xs underline"
          style={{ color: "var(--text-dim)" }}
        >
          Change target
        </button>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { data: goals, isLoading, error, refetch } = useGoals();
  const { data: connections } = useConnections();

  const [showForm, setShowForm] = useState(false);
  const [goalType, setGoalType] = useState<GoalType | "">("");
  const [targetValue, setTargetValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyGoal, setBusyGoal] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isConnected = (platform: string) =>
    connections.some((c) => c.platform === platform && c.connected);

  async function handleCreate() {
    if (!goalType || !targetValue) return;
    setSaving(true);
    setFormError(null);
    try {
      await createGoal({
        type: goalType,
        platform: GOAL_PLATFORMS[goalType],
        targetValue: Number(targetValue),
      });
      setGoalType("");
      setTargetValue("");
      setShowForm(false);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setBusyGoal(id);
    try {
      await deleteGoal(id);
      await refetch();
    } finally {
      setBusyGoal(null);
    }
  }

  async function handleEdit(id: string, target: number) {
    setBusyGoal(id);
    try {
      await updateGoal(id, { targetValue: target });
      await refetch();
    } finally {
      setBusyGoal(null);
    }
  }

  const selectedPlatform = goalType ? GOAL_PLATFORMS[goalType] : null;
  const platformMissing = selectedPlatform !== null && !isConnected(selectedPlatform);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Goals
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Targets are checked against live platform data each time this page loads.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: "var(--brand)", color: "#000" }}
          >
            <Plus className="h-4 w-4" />
            New goal
          </button>
        )}
      </div>

      {showForm && (
        <div
          className="space-y-4 rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--line-strong)" }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              Goal type
            </label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as GoalType | "")}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="" style={{ background: "var(--surface)" }}>
                Select a goal…
              </option>
              {Object.values(GoalType).map((type) => (
                <option key={type} value={type} style={{ background: "var(--surface)" }}>
                  {GOAL_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {goalType && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Target
              </label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1000"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {platformMissing && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--warning)" }}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {PLATFORM_CONFIGS[selectedPlatform!].name} isn&apos;t connected — this goal will sit
              at 0 until you{" "}
              <Link href="/connect" className="underline">
                connect it
              </Link>
              .
            </p>
          )}

          {formError && (
            <p className="flex items-center gap-1.5 text-sm" style={{ color: "var(--danger)" }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={!goalType || !targetValue || saving}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
              style={{ background: "var(--brand)", color: "#000" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create goal
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ border: "1px solid var(--line-strong)", color: "var(--text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--danger-wash)",
            border: "1px solid rgba(224,69,69,0.3)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl"
              style={{ background: "var(--surface-2)" }}
            />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "var(--surface)", border: "1px dashed var(--line-strong)" }}
        >
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--brand-dim)" }}
          >
            <Target className="h-6 w-6" style={{ color: "var(--brand)" }} />
          </div>
          <p className="font-semibold" style={{ color: "var(--text)" }}>
            No goals yet
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Set a follower or view target and BrandCMD will track it for you.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              busy={busyGoal === goal.id}
              onDelete={() => handleDelete(goal.id)}
              onEdit={(target) => handleEdit(goal.id, target)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
