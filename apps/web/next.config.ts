import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle at .next/standalone containing only
  // the modules actually imported. The production image copies that instead of
  // a full node_modules tree.
  output: "standalone",
  // Trace from the workspace root so Next follows the monorepo's symlinked
  // workspace packages (@repo/protocol, @repo/game) into the bundle.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
};

export default nextConfig;
