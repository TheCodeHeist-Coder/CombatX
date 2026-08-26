"use client";

import { Suspense } from "react";
import { AuthPageShell } from "../../components/auth/AuthPageShell";

/**
 * Create an account.
 *
 * Wrapped in Suspense because the shell reads the `next` search param, and
 * useSearchParams opts a route into client rendering — without a boundary the
 * whole page would fail to prerender at build time.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageShell
        mode="signup"
        title="Create account"
        subtitle="Pick a username and a character. Your username is how opponents see you in battle."
        altHref="/login"
        altPrompt="Already have an account?"
        altLabel="Log in"
      />
    </Suspense>
  );
}
