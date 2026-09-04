import { Router } from "express";
import { asyncHandler } from "../../http/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  deleteFixture,
  deleteLeagueRoute,
  deleteTeamMember,
  getLeagueDetail,
  getLeagues,
  getProblemOptions,
  postFixture,
  postLeague,
  postLeagueLookup,
  postLegStart,
  postTeam,
  postTeamJoin,
  putLeague,
} from "./leagues.controller.js";

/**
 * League routes.
 *
 * ROUTE ORDER MATTERS. Every literal path — "/leagues/lookup",
 * "/leagues/problem-options" — is registered BEFORE "/leagues/:id", or the
 * parameter pattern swallows it and "lookup" arrives as a league id.
 *
 * WHICH ROUTES ARE PUBLIC, AND WHY
 * --------------------------------
 * Reading is open: the browse list and a public league's page are the shop
 * window, and requiring an account to look at one would hide the feature from
 * exactly the people it is meant to attract. Those handlers read the caller's
 * identity when a token happens to be present, because the response differs
 * — the join code and "my leagues" are only for people involved.
 *
 * Everything that WRITES requires an account, and the service refuses guests
 * on top of that, so the middleware is not the only thing in the way.
 */
export const leagueRoutes: Router = Router();

// --- literal paths first ---
leagueRoutes.get("/leagues/problem-options", asyncHandler(getProblemOptions));
leagueRoutes.post("/leagues/lookup", asyncHandler(postLeagueLookup));

// --- reading ---
leagueRoutes.get("/leagues", asyncHandler(getLeagues));
leagueRoutes.get("/leagues/:id", asyncHandler(getLeagueDetail));

// --- league management ---
leagueRoutes.post("/leagues", requireAuth, asyncHandler(postLeague));
leagueRoutes.put("/leagues/:id", requireAuth, asyncHandler(putLeague));
leagueRoutes.delete(
  "/leagues/:id",
  requireAuth,
  asyncHandler(deleteLeagueRoute),
);

// --- teams ---
leagueRoutes.post("/leagues/:id/teams", requireAuth, asyncHandler(postTeam));
leagueRoutes.post(
  "/leagues/:id/teams/:teamId/join",
  requireAuth,
  asyncHandler(postTeamJoin),
);
leagueRoutes.delete(
  "/leagues/:id/teams/:teamId/members/:userId",
  requireAuth,
  asyncHandler(deleteTeamMember),
);

// --- fixtures ---
leagueRoutes.post(
  "/leagues/:id/fixtures",
  requireAuth,
  asyncHandler(postFixture),
);
leagueRoutes.delete(
  "/leagues/:id/fixtures/:fixtureId",
  requireAuth,
  asyncHandler(deleteFixture),
);
leagueRoutes.post(
  "/leagues/:id/fixtures/:fixtureId/legs/:legId/start",
  requireAuth,
  asyncHandler(postLegStart),
);
