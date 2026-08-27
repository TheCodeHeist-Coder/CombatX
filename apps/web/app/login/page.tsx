"use client";

import { Suspense } from "react";
import { AuthPageShell } from "../../components/auth/AuthPageShell";

/** Log in with email and password. See SignupPage for the Suspense note. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageShell
        mode="login"
        title="Log in"
        subtitle="Welcome back. Sign in to deploy into the arena."
        artSrc="/auth-return.png"
        artHeadline={["Welcome Back", "Warriors"]}
        artBody="Your rank, your streak, and every battle you have fought are waiting where you left them."
        altHref="/signup"
        altPrompt="No account yet?"
        altLabel="Create one"
      />
    </Suspense>
  );
}
