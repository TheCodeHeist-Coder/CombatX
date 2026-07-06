import "./loadEnv.js"; // must be first — loads .env before @repo/db reads it
import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

app.listen(env.port, env.host, () => {
  console.log(`http-api listening on http://${env.host}:${env.port}`);
});
