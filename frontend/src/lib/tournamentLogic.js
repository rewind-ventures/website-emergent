export const PLAYOFF_SIZES = {
  none: 0,
  final: 2,
  semifinals: 4,
  quarterfinals: 8,
};

export const PLAYOFF_LABELS = {
  none: "No playoffs",
  final: "Final",
  semifinals: "Semifinals",
  quarterfinals: "Quarterfinals",
};

export function makeClientId(prefix) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function teamName(team) {
  if (!team) return "TBD";
  const playerOne = (team.playerOne || "").trim();
  const playerTwo = (team.playerTwo || "").trim();
  if (playerOne && playerTwo) return `${playerOne} / ${playerTwo}`;
  return playerOne || playerTwo || "Unnamed team";
}

export function createTeam(playerOne, playerTwo = "") {
  return {
    id: makeClientId("team"),
    playerOne: playerOne.trim(),
    playerTwo: playerTwo.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function createTournamentState(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || input.sheetId || makeClientId("tournament"),
    sheetId: input.sheetId || input.id || "",
    sheetUrl: input.sheetUrl || "",
    accessCode: String(input.accessCode || "").trim().toUpperCase(),
    name: input.name || "Daily Pickleball Tournament",
    date: input.date || todayInputValue(),
    courts: Math.max(1, Number(input.courts) || 2),
    status: input.status || "setup",
    teams: Array.isArray(input.teams) ? input.teams : [],
    groups: Array.isArray(input.groups) ? input.groups : [],
    matches: Array.isArray(input.matches) ? input.matches : [],
    format: input.format || null,
    version: Number(input.version) || 1,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function normalizeTournament(input) {
  const tournament = createTournamentState(input || {});
  return {
    ...tournament,
    teams: tournament.teams.map((team, index) => ({
      id: team.id || makeClientId("team"),
      playerOne: team.playerOne || team.name || `Team ${index + 1}`,
      playerTwo: team.playerTwo || "",
      groupId: team.groupId || "",
      createdAt: team.createdAt || tournament.createdAt,
    })),
    matches: tournament.matches.map((match) => ({
      status: "open",
      teamAScore: "",
      teamBScore: "",
      submittedBy: "",
      submittedAt: "",
      unlockedAt: "",
      lockVersion: 0,
      ...match,
    })),
  };
}

export function parseBulkTeamLine(line) {
  const parts = line
    .split(/\s*(?:\/|\+|&|,|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return createTeam(parts[0] || line.trim(), parts.slice(1).join(" / "));
}

export function scoreNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function scoreStarted(matches = []) {
  return matches.some(
    (match) =>
      (match.teamAScore !== "" &&
        match.teamAScore !== null &&
        match.teamAScore !== undefined) ||
      (match.teamBScore !== "" &&
        match.teamBScore !== null &&
        match.teamBScore !== undefined)
  );
}

export function getMatchResult(match) {
  const teamAScore = scoreNumber(match.teamAScore);
  const teamBScore = scoreNumber(match.teamBScore);

  if (teamAScore === null && teamBScore === null) {
    return { status: "scheduled", winnerId: "", complete: false };
  }

  if (teamAScore === null || teamBScore === null || teamAScore === teamBScore) {
    return { status: "needs_winner", winnerId: "", complete: false };
  }

  return {
    status: "complete",
    winnerId: teamAScore > teamBScore ? match.teamAId : match.teamBId,
    complete: true,
  };
}

function makeMatch(input) {
  return {
    id: input.id,
    phase: input.phase || "round_robin",
    phaseLabel: input.phaseLabel || "Round robin",
    round: input.round || 1,
    court: Object.prototype.hasOwnProperty.call(input, "court") ? input.court : 1,
    groupId: input.groupId || "",
    teamAId: input.teamAId || "",
    teamBId: input.teamBId || "",
    teamAFrom: input.teamAFrom || null,
    teamBFrom: input.teamBFrom || null,
    teamAScore: "",
    teamBScore: "",
    status: "open",
    submittedBy: "",
    submittedAt: "",
    unlockedAt: "",
    lockVersion: 0,
  };
}

export function buildRoundRobin(teamIds, options = {}) {
  if (teamIds.length < 2) return [];

  const courtCount = Math.max(1, Number(options.courts) || 1);
  const courtOffset = Number(options.courtOffset) || 0;
  const participants = [...teamIds];
  if (participants.length % 2 === 1) participants.push(null);

  const rounds = participants.length - 1;
  const matches = [];
  let rotation = [...participants];
  let sequence = 1;

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    let roundMatchIndex = 0;

    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (!left || !right) continue;

      const flipSides = (roundIndex + index) % 2 === 1;
      matches.push(
        makeMatch({
          id: `${options.prefix || "rr"}-r${roundIndex + 1}-${sequence}`,
          phase: "round_robin",
          phaseLabel: options.phaseLabel || "Round robin",
          round: roundIndex + 1,
          court: ((courtOffset + roundMatchIndex) % courtCount) + 1,
          groupId: options.groupId || "",
          teamAId: flipSides ? right : left,
          teamBId: flipSides ? left : right,
        })
      );

      roundMatchIndex += 1;
      sequence += 1;
    }

    rotation = [
      rotation[0],
      rotation[rotation.length - 1],
      ...rotation.slice(1, rotation.length - 1),
    ];
  }

  return matches;
}

export function assignGroups(teams, groupCount) {
  const count = Math.max(1, Number(groupCount) || 1);
  const groups = Array.from({ length: count }, (_, index) => ({
    id: `group-${index + 1}`,
    name: `Court ${index + 1} Group`,
    court: index + 1,
    teamIds: [],
  }));

  teams.forEach((team, index) => {
    groups[index % count].teamIds.push(team.id);
  });

  return groups;
}

function buildPlayoffMatches(playoffStart) {
  const matches = [];

  if (playoffStart === "quarterfinals") {
    [
      [1, 1, 8],
      [2, 4, 5],
      [3, 2, 7],
      [4, 3, 6],
    ].forEach(([slot, aSeed, bSeed]) => {
      matches.push(
        makeMatch({
          id: `qf-${slot}`,
          phase: "quarterfinals",
          phaseLabel: `Quarterfinal ${slot}`,
          round: 1,
          court: "",
          teamAFrom: { type: "seed", rank: aSeed },
          teamBFrom: { type: "seed", rank: bSeed },
        })
      );
    });
  }

  if (playoffStart === "quarterfinals" || playoffStart === "semifinals") {
    const fromQuarters = playoffStart === "quarterfinals";
    [
      [1, fromQuarters ? "qf-1" : null, fromQuarters ? "qf-2" : null, 1, 4],
      [2, fromQuarters ? "qf-3" : null, fromQuarters ? "qf-4" : null, 2, 3],
    ].forEach(([slot, aMatch, bMatch, aSeed, bSeed]) => {
      matches.push(
        makeMatch({
          id: `sf-${slot}`,
          phase: "semifinals",
          phaseLabel: `Semifinal ${slot}`,
          round: fromQuarters ? 2 : 1,
          court: "",
          teamAFrom: aMatch
            ? { type: "winner", matchId: aMatch }
            : { type: "seed", rank: aSeed },
          teamBFrom: bMatch
            ? { type: "winner", matchId: bMatch }
            : { type: "seed", rank: bSeed },
        })
      );
    });
  }

  if (playoffStart !== "none") {
    const fromSemis = playoffStart !== "final";
    matches.push(
      makeMatch({
        id: "final-1",
        phase: "final",
        phaseLabel: "Final",
        round: playoffStart === "quarterfinals" ? 3 : playoffStart === "semifinals" ? 2 : 1,
        court: "",
        teamAFrom: fromSemis
          ? { type: "winner", matchId: "sf-1" }
          : { type: "seed", rank: 1 },
        teamBFrom: fromSemis
          ? { type: "winner", matchId: "sf-2" }
          : { type: "seed", rank: 2 },
      })
    );
  }

  return matches;
}

export function buildDrawState(tournament, format) {
  const current = normalizeTournament(tournament);
  const mode = format?.mode || "all_play_all";
  const courts = Math.max(1, Number(current.courts) || 1);
  let groups = [];
  let teams = current.teams.map((team) => ({ ...team, groupId: "" }));
  let matches = [];

  if (mode === "groups") {
    groups = assignGroups(teams, format.groupCount || courts);
    const groupByTeamId = new Map();

    groups.forEach((group) => {
      group.teamIds.forEach((teamId) => groupByTeamId.set(teamId, group.id));
      matches = [
        ...matches,
        ...buildRoundRobin(group.teamIds, {
          prefix: group.id,
          phaseLabel: group.name,
          groupId: group.id,
          courts: 1,
          courtOffset: group.court - 1,
        }).map((match) => ({ ...match, court: group.court })),
      ];
    });

    teams = teams.map((team) => ({
      ...team,
      groupId: groupByTeamId.get(team.id) || "",
    }));

    matches = [
      ...matches,
      ...buildPlayoffMatches(format.playoffStart || "none", courts),
    ];
  } else {
    matches = buildRoundRobin(
      teams.map((team) => team.id),
      {
        prefix: "all-play-all",
        phaseLabel: "All play all",
        courts,
      }
    );
  }

  return {
    ...current,
    teams,
    groups,
    matches,
    format: {
      mode,
      groupCount: mode === "groups" ? Number(format.groupCount) || courts : 0,
      directQualifiers: mode === "groups" ? Number(format.directQualifiers) || 1 : 0,
      wildcardCount: mode === "groups" ? Number(format.wildcardCount) || 0 : 0,
      playoffStart: mode === "groups" ? format.playoffStart || "none" : "none",
    },
    status: "draw_created",
    version: (Number(current.version) || 1) + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function groupMatchesByRound(matches = []) {
  return matches.reduce((acc, match) => {
    const key = match.phase === "round_robin"
      ? `${match.groupId || "all"}-${match.round}`
      : `${match.phase}-${match.round}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        title:
          match.phase === "round_robin"
            ? `${match.phaseLabel || "Round robin"} - Round ${match.round}`
            : match.phaseLabel,
        matches: [],
      };
    }
    acc[key].matches.push(match);
    return acc;
  }, {});
}

export function buildStandings(teams = [], matches = [], filter = {}) {
  const allowedTeamIds = filter.teamIds ? new Set(filter.teamIds) : null;
  const rows = teams
    .filter((team) => !allowedTeamIds || allowedTeamIds.has(team.id))
    .map((team) => ({
      teamId: team.id,
      name: teamName(team),
      groupId: team.groupId || "",
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
    }));
  const byId = new Map(rows.map((row) => [row.teamId, row]));

  matches.forEach((match) => {
    if (filter.groupId && match.groupId !== filter.groupId) return;
    if (filter.phase && match.phase !== filter.phase) return;

    const result = getMatchResult(match);
    if (!result.complete) return;

    const teamA = byId.get(match.teamAId);
    const teamB = byId.get(match.teamBId);
    const teamAScore = scoreNumber(match.teamAScore);
    const teamBScore = scoreNumber(match.teamBScore);
    if (!teamA || !teamB || teamAScore === null || teamBScore === null) return;

    teamA.played += 1;
    teamB.played += 1;
    teamA.pointsFor += teamAScore;
    teamA.pointsAgainst += teamBScore;
    teamB.pointsFor += teamBScore;
    teamB.pointsAgainst += teamAScore;

    if (result.winnerId === teamA.teamId) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  });

  rows.forEach((row) => {
    row.diff = row.pointsFor - row.pointsAgainst;
  });

  return sortStandings(rows);
}

export function sortStandings(rows) {
  return [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name);
  });
}

export function getGroupStandings(tournament) {
  const state = normalizeTournament(tournament);
  if (!state.groups.length) {
    return [
      {
        group: null,
        standings: buildStandings(state.teams, state.matches, { phase: "round_robin" }),
      },
    ];
  }

  return state.groups.map((group) => ({
    group,
    standings: buildStandings(state.teams, state.matches, {
      phase: "round_robin",
      groupId: group.id,
      teamIds: group.teamIds,
    }),
  }));
}

export function groupStageComplete(tournament) {
  const state = normalizeTournament(tournament);
  const groupMatches = state.matches.filter((match) => match.phase === "round_robin");
  return groupMatches.length > 0 && groupMatches.every((match) => getMatchResult(match).complete);
}

export function getQualifiers(tournament) {
  const state = normalizeTournament(tournament);
  const format = state.format || {};
  if (format.mode !== "groups" || format.playoffStart === "none") return [];
  if (!groupStageComplete(state)) return [];

  const directQualifiers = Math.max(0, Number(format.directQualifiers) || 0);
  const wildcardCount = Math.max(0, Number(format.wildcardCount) || 0);
  const qualifiedIds = new Set();
  const direct = [];
  const remaining = [];

  getGroupStandings(state).forEach(({ group, standings }) => {
    standings.forEach((row, index) => {
      const entry = {
        ...row,
        groupId: group?.id || row.groupId,
        groupName: group?.name || "All teams",
        groupRank: index + 1,
      };

      if (index < directQualifiers) {
        direct.push(entry);
        qualifiedIds.add(row.teamId);
      } else {
        remaining.push(entry);
      }
    });
  });

  const wildcards = sortStandings(remaining.filter((row) => !qualifiedIds.has(row.teamId)))
    .slice(0, wildcardCount)
    .map((row) => ({ ...row, wildcard: true }));

  return sortStandings([...direct, ...wildcards]).map((row, index) => ({
    ...row,
    seed: index + 1,
  }));
}

function placeholderFromSource(source) {
  if (!source) return "TBD";
  if (source.type === "seed") return `Seed ${source.rank}`;
  if (source.type === "winner") return `Winner ${source.matchId.toUpperCase()}`;
  return "TBD";
}

export function resolveSource(source, tournament, stack = []) {
  const state = normalizeTournament(tournament);
  if (!source) return { teamId: "", label: "TBD" };

  if (source.type === "seed") {
    const qualifier = getQualifiers(state)[Number(source.rank) - 1];
    return qualifier
      ? { teamId: qualifier.teamId, label: qualifier.name }
      : { teamId: "", label: placeholderFromSource(source) };
  }

  if (source.type === "winner") {
    if (stack.includes(source.matchId)) return { teamId: "", label: "TBD" };
    const sourceMatch = state.matches.find((match) => match.id === source.matchId);
    if (!sourceMatch) return { teamId: "", label: placeholderFromSource(source) };

    const resolved = resolveMatch(sourceMatch, state, [...stack, source.matchId]);
    const result = getMatchResult(resolved);
    if (result.complete) {
      const team = state.teams.find((item) => item.id === result.winnerId);
      return { teamId: result.winnerId, label: teamName(team) };
    }
    return { teamId: "", label: placeholderFromSource(source) };
  }

  return { teamId: "", label: "TBD" };
}

export function resolveMatch(match, tournament, stack = []) {
  const state = normalizeTournament(tournament);
  const teamA = match.teamAId
    ? {
        teamId: match.teamAId,
        label: teamName(state.teams.find((team) => team.id === match.teamAId)),
      }
    : resolveSource(match.teamAFrom, state, stack);
  const teamB = match.teamBId
    ? {
        teamId: match.teamBId,
        label: teamName(state.teams.find((team) => team.id === match.teamBId)),
      }
    : resolveSource(match.teamBFrom, state, stack);

  return {
    ...match,
    teamAId: teamA.teamId,
    teamBId: teamB.teamId,
    teamALabel: teamA.label,
    teamBLabel: teamB.label,
  };
}

export function resolveMatches(tournament) {
  const state = normalizeTournament(tournament);
  return state.matches.map((match) => resolveMatch(match, state));
}

export function validateDrawConfig(teams, config) {
  const teamCount = teams.length;
  if (teamCount < 2) return "Add at least two teams before generating a draw.";
  if (config.mode === "all_play_all") return "";

  const groupCount = Number(config.groupCount) || 0;
  if (groupCount < 2) return "Create at least two groups, or use all play all.";
  if (groupCount > teamCount) return "Groups cannot exceed the number of teams.";

  const playoffSize = PLAYOFF_SIZES[config.playoffStart || "none"] || 0;
  if (playoffSize === 0) return "";

  const direct = Number(config.directQualifiers) || 0;
  const wildcards = Number(config.wildcardCount) || 0;
  const total = groupCount * direct + wildcards;
  if (direct < 1) return "At least one team per group must advance.";
  if (total !== playoffSize) {
    return `${PLAYOFF_LABELS[config.playoffStart]} needs ${playoffSize} teams. Your setup advances ${total}.`;
  }
  if (total > teamCount) return "More teams advance than are registered.";

  return "";
}
