"use client";

import Link from "next/link";
import { AppShell } from "../../../components/AppShell";
import { SignInGate } from "../../../components/SignInGate";
import { SubmitForm } from "../../../components/intel/SubmitForm";
import { useSession } from "../../../lib/useSession";
import { useProfile } from "../../../lib/useProfile";

/**
 * Write a problem for the arena.
 *
 * Gated inline rather than by redirect, matching every other authenticated
 * page here — and `loaded &&` so the gate does not flash before localStorage
 * has been read.
 */
export default function SubmitProblemPage() {
  const { session, loaded } = useSession();
  const { profile } = useProfile(session);

  return (
    <AppShell session={session} profile={profile}>
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-7">
        <p className="eyebrow">Module // intel</p>
        <h1 className="mt-2 text-2xl font-bold">Submit a problem</h1>
        <p
          className="mt-2 max-w-xl font-mono text-[0.76rem] leading-relaxed"
          style={{ color: "var(--color-ink-dim)" }}
        >
          Write something you would want to be dealt in a battle. An admin
          reviews every submission — when yours is accepted it joins the
          rotation and you earn the author&apos;s medal.
        </p>

        <div className="mt-6">
          {!loaded ? null : !session || session.isGuest ? (
            <SignInGate
              what="submit a problem"
              guest={!!session?.isGuest}
            />
          ) : (
            <SubmitForm session={session} />
          )}
        </div>

        {loaded && session && !session.isGuest && (
          <p className="mt-6">
            <Link
              href="/intel/mine"
              className="font-mono text-[0.74rem] underline underline-offset-2"
              style={{ color: "var(--color-accent)" }}
            >
              See your submissions
            </Link>
          </p>
        )}
      </div>
    </AppShell>
  );
}
