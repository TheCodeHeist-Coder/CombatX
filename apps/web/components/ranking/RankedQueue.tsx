"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Difficulty, QueueStatusResponse } from "@repo/protocol";
import {
  fetchQueueStatus,
  joinRankedQueue,
  leaveRankedQueue,
  ApiCallError,
} from "../../lib/api";

/**
 * The ranked queue.
 *
 * This is the only route to a rating. Room-code battles stay unranked because
 * there you choose your opponent, and a rating you can farm with a friend is
 * not a rating — so the server picks here, and the pairing is not negotiable.
 *
 * Polls rather than holding a socket: the queue is low-traffic, a poll is
 * resumable across a page reload, and a dropped connection costs nothing but a
 * few seconds. The server also re-attempts a pairing on every status read, so
 * polling is what actually drives matching rather than merely observing it.
 */
const POLL_MS = 2000;

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "EASY", label: "Easy" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HARD", label: "Hard" },
];

export function RankedQueue({ token }: { token: string }) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("EASY");
  const [status, setStatus] = useState<QueueStatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards the navigation so a slow route change cannot fire it twice.
  const navigated = useRef(false);

  const goToMatch = useCallback(
    (s: QueueStatusResponse) => {
      if (!s.matchedBattleId || navigated.current) return false;
      navigated.current = true;
      router.push(`/battle/${s.matchedBattleId}`);
      return true;
    },
    [router],
  );

  // Poll only while queued. An idle component makes no requests at all.
  useEffect(() => {
    if (!status?.queued) return;
    let alive = true;

    const timer = setInterval(() => {
      fetchQueueStatus(token)
        .then((s) => {
          if (!alive) return;
          setStatus(s);
          goToMatch(s);
        })
        .catch(() => {
          // A transient failure is not worth surfacing mid-queue: the next
          // tick will either recover or the user will leave.
        });
    }, POLL_MS);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [status?.queued, token, goToMatch]);

  async function enter() {
    setBusy(true);
    setError(null);
    try {
      const s = await joinRankedQueue(token, difficulty);
      setStatus(s);
      goToMatch(s);
    } catch (err) {
      setError(
        err instanceof ApiCallError ? err.message : "Could not join the queue.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      setStatus(await leaveRankedQueue(token));
    } catch {
      setError("Could not leave the queue.");
    } finally {
      setBusy(false);
    }
  }

  const queued = status?.queued === true;

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">Ranked</h2>
        <span
          className="font-mono text-[0.66rem]"
          style={{ color: "var(--color-ink-ghost)" }}
        >
          {status ? `${status.queueSize} waiting` : ""}
        </span>
      </div>

      <p
        className="mt-2 font-mono text-[0.74rem] leading-relaxed"
        style={{ color: "var(--color-ink-faint)" }}
      >
        The server picks your opponent. Only these battles move your rating.
      </p>

      {queued ? (
        <div className="mt-4">
          <div className="flex items-center gap-2.5">
            <span
              className="h-2 w-2 animate-pulse rounded-full"
              style={{ background: "var(--color-good)" }}
              aria-hidden
            />
            <p className="font-mono text-[0.8rem]">
              Searching — {formatWait(status.waitingSec)}
            </p>
          </div>
          <p
            className="mt-1.5 font-mono text-[0.68rem]"
            style={{ color: "var(--color-ink-ghost)" }}
          >
            {/* Honest about the trade-off rather than pretending the wait is
                free: the search widens over time, so a long wait means a
                less closely matched opponent. */}
            The rating range widens the longer you wait.
          </p>
          <button
            className="btn btn-ghost mt-4 w-full"
            onClick={leave}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                onClick={() => setDifficulty(d.key)}
                className="flex-1 rounded-[7px] border py-1.5 font-mono text-[0.7rem] font-bold uppercase transition-colors"
                style={{
                  borderColor:
                    difficulty === d.key
                      ? "var(--color-primary)"
                      : "var(--color-line)",
                  background:
                    difficulty === d.key
                      ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
                      : "transparent",
                  color:
                    difficulty === d.key
                      ? "var(--color-primary)"
                      : "var(--color-ink-faint)",
                }}
                aria-pressed={difficulty === d.key}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary mt-3 w-full"
            onClick={enter}
            disabled={busy}
          >
            {busy ? "..." : "Find a match"}
          </button>
        </div>
      )}

      {error && (
        <p
          className="mt-3 font-mono text-[0.72rem]"
          style={{ color: "var(--color-bad)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function formatWait(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${sec % 60}s`;
}
