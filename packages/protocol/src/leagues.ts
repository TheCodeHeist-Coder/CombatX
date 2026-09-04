import { z } from "zod";
import { AvatarColor, AvatarId } from "./avatars.js";
import {
  Difficulty,
  FixtureStatus,
  LeagueRound,
  LeagueStatus,
  LeagueVisibility,
  MAX_LEAGUE_TEAM_SIZE,
  MIN_LEAGUE_TEAM_SIZE,
  QualificationMode,
} from "./enums.js";

/**
 * Leagues — player-run tournaments.
 *
 * The shape of the feature: someone creates a league, shares its join code,
 * players form teams inside it, and the host pairs those teams into fixtures
 * that play out on the ordinary battle engine.
 *
 * WHAT A FIXTURE DELIBERATELY DOES NOT CARRY
 * ------------------------------------------
 * A fixture leg names a problem by id and title, and NOTHING about what the
 * problem asks. The same rule the Intel catalogue follows applies here for
 * the same reason: a player who can read the statement before the match can
 * prepare an answer to it, and a scheduled fixture is exactly the situation
 * where they would have the time to. The statement is revealed by the battle,
 * at kick-off, to everyone at once.
 */

/**
 * A logo, stored inline as a data URL.
 *
 * Bounded at ~300KB, matching the profile-photo ceiling in web/lib/image.ts —
 * these are downscaled 256px squares, so a larger payload means the client
 * skipped the resize and is about to put a phone photo in a database row.
 */
const LogoDataUrl = z
  .string()
  .max(400_000, "That image is too large — it should be downscaled first")
  .refine(
    (v) => v.startsWith("data:image/") || v.startsWith("https://"),
    "A logo must be an image",
  );

/**
 * The rule deciding who advances out of the group stage.
 *
 * Null on a league that is just a table of matches — most will be, and
 * forcing a knockout on them would invent a structure nobody asked for.
 */
export const QualificationRuleInput = z.object({
  mode: QualificationMode,
  value: z
    .number()
    .int()
    .min(1, "That has to be at least one")
    .max(64, "That is more than any league will have"),
});
export type QualificationRuleInput = z.infer<typeof QualificationRuleInput>;

/** What creating a league needs. */
export const CreateLeagueInput = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Give the league a name")
    .max(60, "That name is too long"),
  description: z.string().trim().max(2000).default(""),
  logoUrl: LogoDataUrl.nullable().optional(),
  visibility: LeagueVisibility.default("PUBLIC"),
  /**
   * Players per team. Fixed at creation — see the schema note on why this
   * cannot be edited once teams have formed against it.
   */
  teamSize: z
    .number()
    .int()
    .min(MIN_LEAGUE_TEAM_SIZE, "A team needs at least one player")
    .max(MAX_LEAGUE_TEAM_SIZE, "Teams cap at four players"),
  /** Null for no cap. */
  maxTeams: z.number().int().min(2).max(256).nullable().optional(),
});
export type CreateLeagueInput = z.infer<typeof CreateLeagueInput>;

/** Editing a league. Everything here is safe to change mid-league. */
export const UpdateLeagueInput = z.object({
  name: z.string().trim().min(3).max(60).optional(),
  description: z.string().trim().max(2000).optional(),
  logoUrl: LogoDataUrl.nullable().optional(),
  visibility: LeagueVisibility.optional(),
  status: LeagueStatus.optional(),
  maxTeams: z.number().int().min(2).max(256).nullable().optional(),
  /** Null clears the rule, turning a knockout back into a plain table. */
  qualification: QualificationRuleInput.nullable().optional(),
});
export type UpdateLeagueInput = z.infer<typeof UpdateLeagueInput>;

/** One league in the browse list. */
export const LeagueCard = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  logoUrl: z.string().nullable().default(null),
  visibility: LeagueVisibility,
  status: LeagueStatus,
  teamSize: z.number().int(),
  maxTeams: z.number().int().nullable().default(null),
  teamCount: z.number().int().min(0).default(0),
  fixtureCount: z.number().int().min(0).default(0),
  hostName: z.string(),
  createdAt: z.string(),
  /** How teams advance, when the host has set a knockout up. */
  qualifyMode: QualificationMode.nullable().default(null),
  qualifyValue: z.number().int().nullable().default(null),
  /**
   * The join code, included ONLY for a league the caller hosts or has joined.
   * Null otherwise — a public listing must not hand out the key to a private
   * league, and the browse list is readable by anyone.
   */
  joinCode: z.string().nullable().default(null),
});
export type LeagueCard = z.infer<typeof LeagueCard>;

export const LeagueListResponse = z.object({
  /** Public leagues anyone may join. */
  open: z.array(LeagueCard).default([]),
  /** Leagues the caller hosts or plays in. Empty when signed out. */
  mine: z.array(LeagueCard).default([]),
});
export type LeagueListResponse = z.infer<typeof LeagueListResponse>;

/** One player on a league team. */
export const LeagueMemberView = z.object({
  userId: z.string(),
  username: z.string(),
  /**
   * Not nullable, matching PlayerView. The server runs every member through
   * normalizeAvatar, which seeds a default from the user id for rows written
   * before avatars existed — so a null never reaches the wire, and typing one
   * here would force every renderer to handle a case that cannot happen.
   */
  avatarId: AvatarId,
  avatarColor: AvatarColor,
  imageUrl: z.string().nullable().default(null),
  isCaptain: z.boolean().default(false),
});
export type LeagueMemberView = z.infer<typeof LeagueMemberView>;

/** A team as the league dashboard shows it. */
export const LeagueTeamView = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable().default(null),
  captainUserId: z.string(),
  members: z.array(LeagueMemberView).default([]),
  /** Roster size against the league's teamSize, so "2/3" can be shown. */
  isFull: z.boolean().default(false),
  /** Fixtures won, for the standings table. */
  played: z.number().int().min(0).default(0),
  won: z.number().int().min(0).default(0),
  lost: z.number().int().min(0).default(0),
});
export type LeagueTeamView = z.infer<typeof LeagueTeamView>;

/** One leg of a fixture — a single battle on a single problem. */
export const LeagueLegView = z.object({
  id: z.string(),
  ordinal: z.number().int().min(1),
  /** Null when the host left the problem to the system. */
  problemId: z.string().nullable().default(null),
  /**
   * The problem's title, shown so the host can confirm what they scheduled.
   * Never the statement — see the note at the top of this file.
   */
  problemTitle: z.string().nullable().default(null),
  /** The battle that played it, once it has kicked off. */
  battleId: z.string().nullable().default(null),
  /** Room code, so a player can be sent straight into the leg. */
  roomCode: z.string().nullable().default(null),
  winnerTeamId: z.string().nullable().default(null),
  /** Whether the battle behind it has finished. */
  isFinished: z.boolean().default(false),
});
export type LeagueLegView = z.infer<typeof LeagueLegView>;

/** A scheduled tie. */
export const LeagueFixtureView = z.object({
  id: z.string(),
  round: LeagueRound,
  status: FixtureStatus,
  homeTeamId: z.string(),
  homeTeamName: z.string(),
  awayTeamId: z.string(),
  awayTeamName: z.string(),
  timeLimitSec: z.number().int(),
  difficulty: Difficulty,
  winnerTeamId: z.string().nullable().default(null),
  legs: z.array(LeagueLegView).default([]),
  /** Legs won by each side, so "2 - 1" can be rendered without recounting. */
  homeScore: z.number().int().min(0).default(0),
  awayScore: z.number().int().min(0).default(0),
  scheduledAt: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type LeagueFixtureView = z.infer<typeof LeagueFixtureView>;

/** Everything one league's page needs. */
export const LeagueDetailResponse = z.object({
  league: LeagueCard,
  teams: z.array(LeagueTeamView).default([]),
  fixtures: z.array(LeagueFixtureView).default([]),
  /** True when the caller hosts it — gates every management control. */
  isHost: z.boolean().default(false),
  /** The caller's team in this league, when they are in one. */
  myTeamId: z.string().nullable().default(null),
});
export type LeagueDetailResponse = z.infer<typeof LeagueDetailResponse>;

/** Joining a league by code. */
export const JoinLeagueInput = z.object({
  joinCode: z.string().trim().min(4).max(12),
});
export type JoinLeagueInput = z.infer<typeof JoinLeagueInput>;

/** Creating a team inside a league. The creator becomes its captain. */
export const CreateTeamInput = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the team a name")
    .max(40, "That team name is too long"),
  logoUrl: LogoDataUrl.nullable().optional(),
});
export type CreateTeamInput = z.infer<typeof CreateTeamInput>;

/**
 * One leg as the host schedules it.
 *
 * `problemId` omitted or null means "let the system pick", which is the
 * documented fallback the user asked for.
 */
export const FixtureLegInput = z.object({
  problemId: z.string().nullable().optional(),
});
export type FixtureLegInput = z.infer<typeof FixtureLegInput>;

/** Scheduling a tie between two teams. */
export const CreateFixtureInput = z.object({
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  round: LeagueRound.default("GROUP"),
  /** Per-leg clock. */
  timeLimitSec: z.number().int().min(60).max(7200).default(1800),
  /** Used only for legs with no problem set. */
  difficulty: Difficulty.default("MEDIUM"),
  /**
   * The problems, in order. One entry per leg; at least one.
   *
   * Capped at five because a series is decided by a majority and a longer one
   * mostly means legs that can no longer change the result.
   */
  legs: z
    .array(FixtureLegInput)
    .min(1, "A match needs at least one problem")
    .max(5, "Five problems is the most a match can carry")
    .default([{}]),
  scheduledAt: z.string().nullable().optional(),
});
export type CreateFixtureInput = z.infer<typeof CreateFixtureInput>;

/** What kicking off a leg returns: the battle to send both teams into. */
export const StartLegResponse = z.object({
  battleId: z.string(),
  roomCode: z.string(),
});
export type StartLegResponse = z.infer<typeof StartLegResponse>;

/** One problem the host may pin to a leg. Title and difficulty only. */
export const LeagueProblemOption = z.object({
  id: z.string(),
  title: z.string(),
  difficulty: Difficulty,
});
export type LeagueProblemOption = z.infer<typeof LeagueProblemOption>;

export const LeagueProblemOptionsResponse = z.object({
  rows: z.array(LeagueProblemOption).default([]),
});
export type LeagueProblemOptionsResponse = z.infer<
  typeof LeagueProblemOptionsResponse
>;

/* -------------------------------------------------------------------------- */
/* Standings and progression                                                  */
/* -------------------------------------------------------------------------- */

/** One row of the league table. */
export const LeagueStandingRow = z.object({
  teamId: z.string(),
  teamName: z.string(),
  logoUrl: z.string().nullable().default(null),
  rank: z.number().int().min(1),
  played: z.number().int().min(0),
  won: z.number().int().min(0),
  drawn: z.number().int().min(0),
  lost: z.number().int().min(0),
  /** Legs won and lost across every match — the tie-break. */
  legsWon: z.number().int().min(0),
  legsLost: z.number().int().min(0),
  legDiff: z.number().int(),
  points: z.number().int().min(0),
  /** True when this team would advance under the league's current rule. */
  qualifies: z.boolean().default(false),
  /** True once the league is over and this team won it. */
  isChampion: z.boolean().default(false),
});
export type LeagueStandingRow = z.infer<typeof LeagueStandingRow>;

/**
 * What the host is shown before a round is generated.
 *
 * A preview rather than a straight "advance" button, because generating a
 * round creates fixtures that people will turn up for. The host sees exactly
 * who goes through and who they would play BEFORE anything is written.
 */
export const RoundPreview = z.object({
  /** The round these pairings would belong to. */
  round: LeagueRound,
  /** Teams that qualify, strongest first. */
  qualified: z.array(
    z.object({ teamId: z.string(), teamName: z.string(), rank: z.number().int() }),
  ),
  /** The matches that would be created. */
  pairings: z.array(
    z.object({
      homeTeamId: z.string(),
      homeTeamName: z.string(),
      awayTeamId: z.string(),
      awayTeamName: z.string(),
    }),
  ),
  /** A team advancing unopposed because the field is odd. */
  byeTeamId: z.string().nullable().default(null),
  byeTeamName: z.string().nullable().default(null),
  /**
   * Why the round cannot be generated, when it cannot. Null means ready.
   * Carried as prose because every reason is something the host must fix.
   */
  blockedReason: z.string().nullable().default(null),
  /**
   * True when the qualification cut falls inside a group of teams that are
   * level on every tie-break, so more teams qualify than there are places.
   * The host is asked to settle it rather than the server guessing.
   */
  ambiguousCut: z.boolean().default(false),
  /**
   * The teams left level at the cut and the places they are playing for.
   *
   * Present only when `ambiguousCut` is true, and it is what turns that from
   * a dead end into an action: the host schedules a decider between exactly
   * these teams and the winner takes the place.
   */
  tiebreak: z
    .object({
      teams: z.array(z.object({ teamId: z.string(), teamName: z.string() })),
      places: z.number().int().min(1),
      /** True once the decider exists, so it is not offered twice. */
      scheduled: z.boolean().default(false),
    })
    .nullable()
    .default(null),
});
export type RoundPreview = z.infer<typeof RoundPreview>;

/** The whole standings view: the table, plus what happens next. */
export const LeagueStandingsResponse = z.object({
  rows: z.array(LeagueStandingRow).default([]),
  /** Null when the host has not set a qualification rule. */
  qualifyMode: QualificationMode.nullable().default(null),
  qualifyValue: z.number().int().nullable().default(null),
  /** The next round the host could generate. Null when there is nothing to do. */
  preview: RoundPreview.nullable().default(null),
  /** The team that won the whole thing, once a final has been decided. */
  championTeamId: z.string().nullable().default(null),
  championTeamName: z.string().nullable().default(null),
});
export type LeagueStandingsResponse = z.infer<typeof LeagueStandingsResponse>;

/**
 * Settings for a round the host is about to draw.
 *
 * All optional: the point of the draw button is that it works with one
 * click. These let a host who cares set the clock and format up front rather
 * than editing every generated fixture afterwards.
 */
export const GenerateRoundInput = z.object({
  timeLimitSec: z.number().int().min(60).max(7200).optional(),
  difficulty: Difficulty.optional(),
  /** Problems per tie. Defaults to one. */
  legs: z.number().int().min(1).max(5).optional(),
});
export type GenerateRoundInput = z.infer<typeof GenerateRoundInput>;
