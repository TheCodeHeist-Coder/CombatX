import { PISTON_RUNTIME, type Language } from "@repo/protocol";
import { env } from "../config/env.js";

/**
 * Thin client over the Piston execution API. One request runs a program once
 * against a single stdin. We never trust the sandbox to enforce our limits, so
 * we also cap the HTTP call itself with an AbortController.
 *
 * `pistonUrl` is the API BASE (e.g. self-hosted "http://host:2000/api/v2", or the
 * public proxy "https://emkc.org/api/v2/piston"); we append "/execute".
 *   POST {pistonUrl}/execute
 *   body:  { language, version, files:[{content}], stdin, run_timeout, compile_timeout }
 *   reply: { compile?: {stdout,stderr,code}, run: {stdout,stderr,code,signal} }
 */

/** File extension per language, so Piston picks the right compiler/interpreter. */
const FILE_NAME: Record<Language, string> = {
  PYTHON: "main.py",
  JAVASCRIPT: "main.js",
  CPP: "main.cpp",
  JAVA: "Main.java",
};

interface PistonStage {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
}

interface PistonResponse {
  compile?: PistonStage;
  run: PistonStage;
  message?: string; // present on API-level errors (e.g. runtime not installed)
}

export interface RunResult {
  stdout: string;
  stderr: string;
  /** true if the program compiled+ran and exited 0 */
  ok: boolean;
  /** a compile error, non-zero exit, or timeout signal — for the error message */
  failure: string | null;
  timedOut: boolean;
}

/** Truncate output defensively so one runaway print can't blow up memory. */
function clip(s: string): string {
  if (s.length <= env.maxOutputBytes) return s;
  return s.slice(0, env.maxOutputBytes) + "\n…[output truncated]";
}

/** Run `source` once against `stdin` and return its stdout + status. */
export async function runOnce(
  language: Language,
  source: string,
  stdin: string,
): Promise<RunResult> {
  const runtime = PISTON_RUNTIME[language];
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), env.httpTimeoutMs);

  let res: Response;
  try {
    res = await fetch(`${env.pistonUrl.replace(/\/$/, "")}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: FILE_NAME[language], content: source }],
        stdin,
        run_timeout: env.runTimeoutMs,
        compile_timeout: env.compileTimeoutMs,
      }),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return {
      stdout: "",
      stderr: "",
      ok: false,
      failure: timedOut ? "Execution service timed out." : "Execution service unreachable.",
      timedOut,
    };
  } finally {
    clearTimeout(abort);
  }

  if (!res.ok) {
    return {
      stdout: "",
      stderr: "",
      ok: false,
      failure: `Execution service error (HTTP ${res.status}).`,
      timedOut: false,
    };
  }

  const data = (await res.json()) as PistonResponse;

  // API-level error (bad runtime, etc.).
  if (data.message && !data.run) {
    return { stdout: "", stderr: "", ok: false, failure: data.message, timedOut: false };
  }

  // Compilation failure (C++/Java).
  if (data.compile && data.compile.code !== 0) {
    return {
      stdout: "",
      stderr: clip(data.compile.stderr),
      ok: false,
      failure: firstLine(data.compile.stderr) || "Compilation failed.",
      timedOut: false,
    };
  }

  const run = data.run;
  // A killed process (timeout / OOM) surfaces as a signal.
  if (run.signal) {
    return {
      stdout: clip(run.stdout),
      stderr: clip(run.stderr),
      ok: false,
      failure: run.signal === "SIGKILL" ? "Time limit exceeded." : `Killed (${run.signal}).`,
      timedOut: run.signal === "SIGKILL",
    };
  }
  if (run.code !== 0) {
    return {
      stdout: clip(run.stdout),
      stderr: clip(run.stderr),
      ok: false,
      failure: firstLine(run.stderr) || `Runtime error (exit ${run.code}).`,
      timedOut: false,
    };
  }

  return {
    stdout: clip(run.stdout),
    stderr: clip(run.stderr),
    ok: true,
    failure: null,
    timedOut: false,
  };
}

function firstLine(s: string): string {
  return s.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
}
