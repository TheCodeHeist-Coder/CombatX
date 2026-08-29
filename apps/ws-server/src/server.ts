import { createServer, type Server } from "node:http";
import { env } from "./config/env.js";
import { JudgePipeline } from "./infra/judgeQueue.js";
import { RoomRegistry } from "./battle/roomRegistry.js";
import { createHttpApp } from "./transport/httpApp.js";
import { WsGateway } from "./transport/wsGateway.js";

/**
 * Wires the whole ws-server together: an HTTP server (health + upgrade host),
 * the judge pipeline (BullMQ producer + result subscriber), the room registry,
 * and the WebSocket gateway. Returns start/stop handles so index.ts stays thin.
 */
export interface GameServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createGameServer(): GameServer {
  const judge = new JudgePipeline();
  const registry = new RoomRegistry(judge);
  const httpServer: Server = createServer(createHttpApp(registry));
  const gateway = new WsGateway(httpServer, registry);

  return {
    async start() {
      // Fan judge results from the worker out to the owning room.
      await judge.onResult((result) => {
        void registry.routeResult(result.battleId, {
          submissionId: result.submissionId,
          passed: result.passed,
          total: result.total,
          timeMs: result.timeMs,
          allPassed: result.allPassed,
          errorMessage: result.errorMessage,
        });
      });

      gateway.start();

      await new Promise<void>((resolve) => {
        httpServer.listen(env.port, env.host, () => {
          console.log(
            `ws-server listening on http://${env.host}:${env.port} (ws path /ws)`,
          );
          resolve();
        });
      });
    },

    async stop() {
      gateway.close();
      registry.disposeAll();
      await judge.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
