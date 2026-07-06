import { config as loadDotenv } from "dotenv";

/**
 * Side-effect module: loads environment variables from .env files. Imported
 * FIRST (before @repo/db and anything else that reads process.env at module
 * load time), because ESM evaluates imports in source order — so this must sit
 * at the very top of the entrypoint.
 */
loadDotenv();
loadDotenv({ path: "../../.env" });
