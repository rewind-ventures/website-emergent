/**
 * Rewind Pickleball tournament handler.
 *
 * Deploy this as a separate Apps Script Web App.
 * Use its URL for:
 *
 * REACT_APP_TOURNAMENT_SCRIPT_URL
 */

const TOURNAMENT_FOLDER_ID = ""; // Optional: paste the Drive folder ID here.
const STATE_SHEET_NAME = "_state";
const ACCESS_CODE_PROPERTY_PREFIX = "tournament_code_";
const ACCESS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function authorizeDriveOnce() {
  const folder = TOURNAMENT_FOLDER_ID
    ? DriveApp.getFolderById(TOURNAMENT_FOLDER_ID)
    : DriveApp.getRootFolder();

  folder.getName();

  const ss = SpreadsheetApp.create("Rewind Authorization Test");
  const file = DriveApp.getFileById(ss.getId());

  if (TOURNAMENT_FOLDER_ID) {
    file.moveTo(folder);
  }

  file.setTrashed(true);
  return "Drive + Sheets authorization complete";
}

function doGet(e) {
  const callback = e.parameter.callback || "";
  try {
    const action = e.parameter.action || "health";
    const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
    const result = handleTournamentAction(action, payload);
    return jsonpResponse(callback, result);
  } catch (error) {
    return jsonpResponse(callback, { success: false, error: String(error) });
  }
}

function handleTournamentAction(action, payload) {
  if (action === "health") {
    return { success: true, message: "Rewind tournament handler is running" };
  }

  return withScriptLock(function () {
    if (action === "createTournament") return createTournament(payload);
    if (action === "getTournament") return getTournament(payload);
    if (action === "getTournamentByCode") return getTournamentByCode(payload);
    if (action === "saveTeams") return saveTeams(payload);
    if (action === "generateDraw") return generateDraw(payload);
    if (action === "resetDraw") return resetDraw(payload);
    if (action === "submitScore") return submitScore(payload);
    if (action === "submitScores") return submitScores(payload);
    if (action === "updateMatchTeams") return updateMatchTeams(payload);
    if (action === "unlockScore") return unlockScore(payload);
    throw new Error("Unsupported action: " + action);
  });
}

function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function createTournament(payload) {
  const name = payload.name || "Daily Pickleball Tournament";
  const ss = SpreadsheetApp.create(name);
  const accessCode = generateUniqueAccessCode();

  if (TOURNAMENT_FOLDER_ID) {
    const file = DriveApp.getFileById(ss.getId());
    file.moveTo(DriveApp.getFolderById(TOURNAMENT_FOLDER_ID));
  }

  const state = normalizeTournament({
    id: ss.getId(),
    sheetId: ss.getId(),
    sheetUrl: ss.getUrl(),
    accessCode: accessCode,
    name: name,
    date: payload.date || todayInputValue(),
    courts: Math.max(1, Number(payload.courts) || 4),
    status: "setup",
    teams: [],
    groups: [],
    matches: [],
    format: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  saveAccessCodeMapping(accessCode, ss.getId());
  setupTournamentSheets(ss);
  writeTournamentState(ss, state);
  writeReadableSheets(ss, state);

  return { success: true, tournament: state };
}

function getTournament(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = ensureTournamentAccessCode(ss, readTournamentState(ss));
  return { success: true, tournament: state };
}

function getTournamentByCode(payload) {
  const accessCode = normalizeAccessCode(payload.accessCode || payload.code);
  if (!accessCode) throw new Error("Tournament code is required.");

  const sheetId = PropertiesService
    .getScriptProperties()
    .getProperty(ACCESS_CODE_PROPERTY_PREFIX + accessCode);

  if (!sheetId) throw new Error("Tournament code not found.");

  const ss = SpreadsheetApp.openById(sheetId);
  const state = ensureTournamentAccessCode(ss, readTournamentState(ss), accessCode);

  return { success: true, tournament: state };
}

function saveTeams(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = readTournamentState(ss);
  if (hasAnyScore(state.matches)) {
    throw new Error("Teams cannot be changed after scoring starts.");
  }

  state.teams = (payload.teams || []).map(function (team, index) {
    return {
      id: team.id || "team-" + (index + 1),
      playerOne: team.playerOne || team.name || "Team " + (index + 1),
      playerTwo: team.playerTwo || "",
      groupId: "",
      createdAt: team.createdAt || new Date().toISOString(),
    };
  });
  state.groups = [];
  state.matches = [];
  state.format = null;
  state.status = "setup";
  state.version += 1;
  state.updatedAt = new Date().toISOString();

  writeTournamentState(ss, state);
  writeReadableSheets(ss, state);
  return { success: true, tournament: state };
}

function generateDraw(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = readTournamentState(ss);
  if (state.teams.length < 2) throw new Error("Add at least two teams first.");
  if (hasAnyScore(state.matches)) throw new Error("Scores exist. Unlock/reset outside active play.");

  const next = buildDrawState(state, payload.format || {});
  writeTournamentState(ss, next);
  writeReadableSheets(ss, next);
  return { success: true, tournament: next };
}

function resetDraw(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = readTournamentState(ss);
  if (hasAnyScore(state.matches)) throw new Error("Cannot reset draw after scoring starts.");

  state.groups = [];
  state.matches = [];
  state.format = null;
  state.status = "setup";
  state.version += 1;
  state.updatedAt = new Date().toISOString();
  state.teams = state.teams.map(function (team) {
    team.groupId = "";
    return team;
  });

  writeTournamentState(ss, state);
  writeReadableSheets(ss, state);
  return { success: true, tournament: state };
}

function submitScore(payload) {
  const result = submitScores({
    sheetId: payload.sheetId,
    tournamentId: payload.tournamentId,
    refereeName: payload.refereeName,
    scores: [payload],
  });

  if (result.conflicts && result.conflicts.length) {
    throw new Error(result.conflicts[0].reason || "Score was not submitted.");
  }

  return { success: true, tournament: result.tournament };
}

function submitScores(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = readTournamentState(ss);
  const scores = Array.isArray(payload.scores) ? payload.scores : [];
  if (!scores.length) throw new Error("No scores were sent.");

  const savedMatchIds = [];
  const conflicts = [];
  const submittedAt = new Date().toISOString();

  scores.forEach(function (entry) {
    const match = state.matches.find(function (item) {
      return item.id === (entry.matchId || entry.m);
    });

    if (!match) {
      conflicts.push({ matchId: entry.matchId || entry.m || "", reason: "Match not found." });
      return;
    }

    if (match.status === "locked") {
      conflicts.push({ matchId: match.id, reason: "Score is already locked." });
      return;
    }

    const a = Number(entry.teamAScore !== undefined ? entry.teamAScore : entry.as);
    const b = Number(entry.teamBScore !== undefined ? entry.teamBScore : entry.bs);
    const teamAId = entry.teamAId || entry.a || match.teamAId;
    const teamBId = entry.teamBId || entry.b || match.teamBId;

    if (!teamAId || !teamBId) {
      conflicts.push({ matchId: match.id, reason: "Match is not ready yet." });
      return;
    }

    if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0 || a === b) {
      conflicts.push({ matchId: match.id, reason: "Enter a valid non-tied score." });
      return;
    }

    match.teamAId = teamAId;
    match.teamBId = teamBId;
    match.teamAScore = String(a);
    match.teamBScore = String(b);
    match.status = "locked";
    match.submittedBy = entry.refereeName || entry.r || payload.refereeName || "Referee";
    match.submittedAt = submittedAt;
    savedMatchIds.push(match.id);
  });

  if (savedMatchIds.length) {
    state.status = "in_progress";
    state.version += 1;
    state.updatedAt = submittedAt;
    writeTournamentState(ss, state);
    writeReadableSheets(ss, state);
  }

  return {
    success: true,
    tournament: state,
    saved: savedMatchIds.length,
    savedMatchIds: savedMatchIds,
    conflicts: conflicts,
  };
}

function unlockScore(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = readTournamentState(ss);
  const match = state.matches.find(function (item) {
    return item.id === payload.matchId;
  });
  if (!match) throw new Error("Match not found.");

  match.status = "open";
  match.unlockedBy = payload.refereeName || "Referee";
  match.unlockedAt = new Date().toISOString();
  match.lockVersion = Number(match.lockVersion || 0) + 1;
  state.version += 1;
  state.updatedAt = new Date().toISOString();

  writeTournamentState(ss, state);
  writeReadableSheets(ss, state);
  return { success: true, tournament: state };
}

function updateMatchTeams(payload) {
  const ss = SpreadsheetApp.openById(requiredSheetId(payload));
  const state = readTournamentState(ss);
  const match = state.matches.find(function (item) {
    return item.id === payload.matchId;
  });
  if (!match) throw new Error("Match not found.");
  if (match.status === "locked") throw new Error("Unlock this score before changing teams.");

  if (Object.prototype.hasOwnProperty.call(payload, "teamAId")) {
    match.teamAId = payload.teamAId || "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "teamBId")) {
    match.teamBId = payload.teamBId || "";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "court")) {
    match.court = payload.court === "" ? "" : Math.max(1, Number(payload.court) || 1);
  }

  state.version += 1;
  state.updatedAt = new Date().toISOString();

  writeTournamentState(ss, state);
  writeReadableSheets(ss, state);
  return { success: true, tournament: state };
}

function setupTournamentSheets(ss) {
  ["Summary", "Teams", "Matches", "Standings", "Qualifiers", STATE_SHEET_NAME].forEach(function (name) {
    getOrCreateSheet(ss, name);
  });
  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  ss.getSheetByName(STATE_SHEET_NAME).hideSheet();
}

function readTournamentState(ss) {
  const sheet = getOrCreateSheet(ss, STATE_SHEET_NAME);
  const raw = sheet.getRange("A1").getValue();
  if (!raw) throw new Error("Tournament state is missing.");
  return normalizeTournament(JSON.parse(raw));
}

function writeTournamentState(ss, state) {
  const sheet = getOrCreateSheet(ss, STATE_SHEET_NAME);
  sheet.clear();
  sheet.getRange("A1").setValue(JSON.stringify(normalizeTournament(state)));
}

function writeReadableSheets(ss, state) {
  state = normalizeTournament(state);
  writeSummarySheet(ss, state);
  writeTeamsSheet(ss, state);
  writeMatchesSheet(ss, state);
  writeStandingsSheet(ss, state);
  writeQualifiersSheet(ss, state);
}

function writeSummarySheet(ss, state) {
  const sheet = getOrCreateSheet(ss, "Summary");
  const rows = [
    ["Tournament", state.name],
    ["Date", state.date],
    ["Access Code", state.accessCode || ""],
    ["Courts", state.courts],
    ["Status", state.status],
    ["Teams", state.teams.length],
    ["Matches", state.matches.length],
    ["Updated", state.updatedAt],
    ["Tournament ID", state.sheetId],
  ];
  writeRows(sheet, rows);
  sheet.getRange("A3:B3")
    .setBackground("#d3ff62")
    .setFontColor("#07150f")
    .setFontWeight("bold");
  sheet.getRange("B3").setFontSize(18);
}

function writeTeamsSheet(ss, state) {
  const groupById = {};
  state.groups.forEach(function (group) {
    groupById[group.id] = group.name;
  });
  const rows = [["Seed", "Team ID", "Player One", "Player Two", "Group"]];
  state.teams.forEach(function (team, index) {
    rows.push([index + 1, team.id, team.playerOne, team.playerTwo, groupById[team.groupId] || ""]);
  });
  writeRows(getOrCreateSheet(ss, "Teams"), rows);
}

function writeMatchesSheet(ss, state) {
  const rows = [[
    "Phase",
    "Round",
    "Group",
    "Court",
    "Team A",
    "Score A",
    "Score B",
    "Team B",
    "Status",
    "Submitted By",
    "Submitted At",
    "Unlocked By",
    "Unlocked At",
  ]];

  const groupNames = {};
  state.groups.forEach(function (group) {
    groupNames[group.id] = group.name;
  });

  state.matches.forEach(function (match) {
    rows.push([
      match.phaseLabel || match.phase,
      match.round,
      groupNames[match.groupId] || match.groupId || "",
      match.court,
      getMatchTeamName(state, match, "A"),
      match.teamAScore,
      match.teamBScore,
      getMatchTeamName(state, match, "B"),
      match.status,
      match.submittedBy || "",
      match.submittedAt || "",
      match.unlockedBy || "",
      match.unlockedAt || "",
    ]);
  });

  writeRows(getOrCreateSheet(ss, "Matches"), rows);
}

function writeStandingsSheet(ss, state) {
  const rows = [["Scope", "Rank", "Team", "Played", "Wins", "Losses", "PF", "PA", "Diff"]];
  if (state.groups.length) {
    state.groups.forEach(function (group) {
      const standings = buildStandings(state.teams, state.matches, {
        phase: "round_robin",
        groupId: group.id,
        teamIds: group.teamIds,
      });
      standings.forEach(function (row, index) {
        rows.push([group.name, index + 1, row.name, row.played, row.wins, row.losses, row.pointsFor, row.pointsAgainst, row.diff]);
      });
    });
  } else {
    buildStandings(state.teams, state.matches, { phase: "round_robin" }).forEach(function (row, index) {
      rows.push(["All teams", index + 1, row.name, row.played, row.wins, row.losses, row.pointsFor, row.pointsAgainst, row.diff]);
    });
  }
  writeRows(getOrCreateSheet(ss, "Standings"), rows);
}

function writeQualifiersSheet(ss, state) {
  const rows = [["Seed", "Team", "Group", "Group Rank", "Wildcard"]];
  getQualifiers(state).forEach(function (row) {
    rows.push([row.seed, row.name, row.groupName, row.groupRank, row.wildcard ? "Yes" : "No"]);
  });
  writeRows(getOrCreateSheet(ss, "Qualifiers"), rows);
}

function writeRows(sheet, rows) {
  sheet.clear();
  if (!rows.length) return;
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(1, 1, 1, rows[0].length).setFontWeight("bold");
  sheet.autoResizeColumns(1, rows[0].length);
}

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function requiredSheetId(payload) {
  const sheetId = payload.sheetId || payload.tournamentId;
  if (!sheetId) throw new Error("sheetId is required.");
  return sheetId;
}

function normalizeAccessCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function generateAccessCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ACCESS_CODE_CHARS.charAt(Math.floor(Math.random() * ACCESS_CODE_CHARS.length));
  }
  return code;
}

function generateUniqueAccessCode() {
  const properties = PropertiesService.getScriptProperties();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = generateAccessCode();
    if (!properties.getProperty(ACCESS_CODE_PROPERTY_PREFIX + code)) return code;
  }
  throw new Error("Could not generate a tournament code. Try again.");
}

function saveAccessCodeMapping(accessCode, sheetId) {
  PropertiesService
    .getScriptProperties()
    .setProperty(ACCESS_CODE_PROPERTY_PREFIX + normalizeAccessCode(accessCode), sheetId);
}

function ensureTournamentAccessCode(ss, state, preferredCode) {
  state = normalizeTournament(state);
  let changed = false;

  if (!state.accessCode) {
    state.accessCode = normalizeAccessCode(preferredCode) || generateUniqueAccessCode();
    changed = true;
  }

  saveAccessCodeMapping(state.accessCode, state.sheetId || ss.getId());

  if (changed) {
    state.updatedAt = new Date().toISOString();
    writeTournamentState(ss, state);
    writeReadableSheets(ss, state);
  }

  return state;
}

function jsonpResponse(callback, obj) {
  const body = callback ? callback + "(" + JSON.stringify(obj) + ");" : JSON.stringify(obj);
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTournament(value) {
  value = value || {};
  return {
    id: value.id || value.sheetId || "",
    sheetId: value.sheetId || value.id || "",
    sheetUrl: value.sheetUrl || "",
    accessCode: normalizeAccessCode(value.accessCode || ""),
    name: value.name || "Daily Pickleball Tournament",
    date: value.date || todayInputValue(),
    courts: Math.max(1, Number(value.courts) || 4),
    status: value.status || "setup",
    teams: Array.isArray(value.teams) ? value.teams : [],
    groups: Array.isArray(value.groups) ? value.groups : [],
    matches: Array.isArray(value.matches) ? value.matches : [],
    format: value.format || null,
    version: Number(value.version) || 1,
    createdAt: value.createdAt || new Date().toISOString(),
    updatedAt: value.updatedAt || new Date().toISOString(),
  };
}

function hasAnyScore(matches) {
  return (matches || []).some(function (match) {
    return (match.teamAScore !== "" && match.teamAScore !== null && match.teamAScore !== undefined) ||
      (match.teamBScore !== "" && match.teamBScore !== null && match.teamBScore !== undefined);
  });
}

function teamName(team) {
  if (!team) return "TBD";
  const one = (team.playerOne || "").trim();
  const two = (team.playerTwo || "").trim();
  if (one && two) return one + " / " + two;
  return one || two || "Unnamed team";
}

function scoreNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : null;
}

function getMatchResult(match) {
  const a = scoreNumber(match.teamAScore);
  const b = scoreNumber(match.teamBScore);
  if (a === null && b === null) return { complete: false, winnerId: "", status: "scheduled" };
  if (a === null || b === null || a === b) return { complete: false, winnerId: "", status: "needs_winner" };
  return { complete: true, winnerId: a > b ? match.teamAId : match.teamBId, status: "complete" };
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
    unlockedBy: "",
    unlockedAt: "",
    lockVersion: 0,
  };
}

function buildDrawState(state, format) {
  state = normalizeTournament(state);
  format = format || {};
  const mode = format.mode || "all_play_all";
  const courts = Math.max(1, Number(state.courts) || 1);
  let teams = state.teams.map(function (team) {
    team.groupId = "";
    return team;
  });
  let groups = [];
  let matches = [];

  if (mode === "groups") {
    groups = assignGroups(teams, format.groupCount || courts);
    const groupByTeamId = {};
    groups.forEach(function (group) {
      group.teamIds.forEach(function (teamId) {
        groupByTeamId[teamId] = group.id;
      });
      const groupMatches = buildRoundRobin(group.teamIds, {
        prefix: group.id,
        phaseLabel: group.name,
        groupId: group.id,
        courts: 1,
        courtOffset: group.court - 1,
      }).map(function (match) {
        match.court = group.court;
        return match;
      });
      matches = matches.concat(groupMatches);
    });
    teams = teams.map(function (team) {
      team.groupId = groupByTeamId[team.id] || "";
      return team;
    });
    matches = matches.concat(buildPlayoffMatches(format.playoffStart || "none", courts));
  } else {
    matches = buildRoundRobin(teams.map(function (team) { return team.id; }), {
      prefix: "all-play-all",
      phaseLabel: "All play all",
      courts: courts,
    });
  }

  state.teams = teams;
  state.groups = groups;
  state.matches = matches;
  state.format = {
    mode: mode,
    groupCount: mode === "groups" ? Number(format.groupCount) || courts : 0,
    directQualifiers: mode === "groups" ? Number(format.directQualifiers) || 1 : 0,
    wildcardCount: mode === "groups" ? Number(format.wildcardCount) || 0 : 0,
    playoffStart: mode === "groups" ? format.playoffStart || "none" : "none",
  };
  state.status = "draw_created";
  state.version += 1;
  state.updatedAt = new Date().toISOString();
  return state;
}

function buildRoundRobin(teamIds, options) {
  options = options || {};
  if (teamIds.length < 2) return [];
  const courtCount = Math.max(1, Number(options.courts) || 1);
  const courtOffset = Number(options.courtOffset) || 0;
  const participants = teamIds.slice();
  if (participants.length % 2 === 1) participants.push(null);

  const rounds = participants.length - 1;
  const matches = [];
  let rotation = participants.slice();
  let sequence = 1;

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    let roundMatchIndex = 0;
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (!left || !right) continue;
      const flip = (roundIndex + index) % 2 === 1;
      matches.push(makeMatch({
        id: (options.prefix || "rr") + "-r" + (roundIndex + 1) + "-" + sequence,
        phase: "round_robin",
        phaseLabel: options.phaseLabel || "Round robin",
        round: roundIndex + 1,
        court: ((courtOffset + roundMatchIndex) % courtCount) + 1,
        groupId: options.groupId || "",
        teamAId: flip ? right : left,
        teamBId: flip ? left : right,
      }));
      roundMatchIndex += 1;
      sequence += 1;
    }
    rotation = [rotation[0], rotation[rotation.length - 1]].concat(rotation.slice(1, rotation.length - 1));
  }

  return matches;
}

function assignGroups(teams, groupCount) {
  const count = Math.max(1, Number(groupCount) || 1);
  const groups = [];
  for (let index = 0; index < count; index += 1) {
    groups.push({ id: "group-" + (index + 1), name: "Court " + (index + 1) + " Group", court: index + 1, teamIds: [] });
  }
  teams.forEach(function (team, index) {
    groups[index % count].teamIds.push(team.id);
  });
  return groups;
}

function buildPlayoffMatches(playoffStart) {
  const matches = [];
  if (playoffStart === "quarterfinals") {
    [[1, 1, 8], [2, 4, 5], [3, 2, 7], [4, 3, 6]].forEach(function (slot) {
      matches.push(makeMatch({
        id: "qf-" + slot[0],
        phase: "quarterfinals",
        phaseLabel: "Quarterfinal " + slot[0],
        round: 1,
        court: "",
        teamAFrom: { type: "seed", rank: slot[1] },
        teamBFrom: { type: "seed", rank: slot[2] },
      }));
    });
  }
  if (playoffStart === "quarterfinals" || playoffStart === "semifinals") {
    const fromQf = playoffStart === "quarterfinals";
    [[1, "qf-1", "qf-2", 1, 4], [2, "qf-3", "qf-4", 2, 3]].forEach(function (slot) {
      matches.push(makeMatch({
        id: "sf-" + slot[0],
        phase: "semifinals",
        phaseLabel: "Semifinal " + slot[0],
        round: fromQf ? 2 : 1,
        court: "",
        teamAFrom: fromQf ? { type: "winner", matchId: slot[1] } : { type: "seed", rank: slot[3] },
        teamBFrom: fromQf ? { type: "winner", matchId: slot[2] } : { type: "seed", rank: slot[4] },
      }));
    });
  }
  if (playoffStart !== "none") {
    const fromSemis = playoffStart !== "final";
    matches.push(makeMatch({
      id: "final-1",
      phase: "final",
      phaseLabel: "Final",
      round: playoffStart === "quarterfinals" ? 3 : playoffStart === "semifinals" ? 2 : 1,
      court: "",
      teamAFrom: fromSemis ? { type: "winner", matchId: "sf-1" } : { type: "seed", rank: 1 },
      teamBFrom: fromSemis ? { type: "winner", matchId: "sf-2" } : { type: "seed", rank: 2 },
    }));
  }
  return matches;
}

function buildStandings(teams, matches, filter) {
  filter = filter || {};
  const allowed = filter.teamIds ? makeSet(filter.teamIds) : null;
  const rows = teams.filter(function (team) {
    return !allowed || allowed[team.id];
  }).map(function (team) {
    return {
      teamId: team.id,
      name: teamName(team),
      groupId: team.groupId || "",
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
    };
  });
  const byId = {};
  rows.forEach(function (row) { byId[row.teamId] = row; });

  matches.forEach(function (match) {
    if (filter.groupId && match.groupId !== filter.groupId) return;
    if (filter.phase && match.phase !== filter.phase) return;
    const result = getMatchResult(match);
    if (!result.complete) return;
    const a = byId[match.teamAId];
    const b = byId[match.teamBId];
    if (!a || !b) return;
    const aScore = Number(match.teamAScore);
    const bScore = Number(match.teamBScore);
    a.played += 1;
    b.played += 1;
    a.pointsFor += aScore;
    a.pointsAgainst += bScore;
    b.pointsFor += bScore;
    b.pointsAgainst += aScore;
    if (result.winnerId === a.teamId) {
      a.wins += 1;
      b.losses += 1;
    } else {
      b.wins += 1;
      a.losses += 1;
    }
  });
  rows.forEach(function (row) { row.diff = row.pointsFor - row.pointsAgainst; });
  return sortStandings(rows);
}

function sortStandings(rows) {
  return rows.slice().sort(function (a, b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name);
  });
}

function makeSet(values) {
  const set = {};
  values.forEach(function (value) { set[value] = true; });
  return set;
}

function groupStageComplete(state) {
  const groupMatches = state.matches.filter(function (match) {
    return match.phase === "round_robin";
  });
  return groupMatches.length > 0 && groupMatches.every(function (match) {
    return getMatchResult(match).complete;
  });
}

function getQualifiers(state) {
  state = normalizeTournament(state);
  const format = state.format || {};
  if (format.mode !== "groups" || format.playoffStart === "none") return [];
  if (!groupStageComplete(state)) return [];
  const directQualifiers = Math.max(0, Number(format.directQualifiers) || 0);
  const wildcardCount = Math.max(0, Number(format.wildcardCount) || 0);
  const qualified = {};
  let direct = [];
  let remaining = [];

  state.groups.forEach(function (group) {
    const standings = buildStandings(state.teams, state.matches, {
      phase: "round_robin",
      groupId: group.id,
      teamIds: group.teamIds,
    });
    standings.forEach(function (row, index) {
      row.groupId = group.id;
      row.groupName = group.name;
      row.groupRank = index + 1;
      if (index < directQualifiers) {
        direct.push(row);
        qualified[row.teamId] = true;
      } else {
        remaining.push(row);
      }
    });
  });

  const wildcards = sortStandings(remaining.filter(function (row) {
    return !qualified[row.teamId];
  })).slice(0, wildcardCount).map(function (row) {
    row.wildcard = true;
    return row;
  });

  return sortStandings(direct.concat(wildcards)).map(function (row, index) {
    row.seed = index + 1;
    return row;
  });
}

function getMatchTeamName(state, match, side) {
  const teamId = side === "A" ? match.teamAId : match.teamBId;
  const source = side === "A" ? match.teamAFrom : match.teamBFrom;
  if (teamId) {
    const team = state.teams.find(function (item) { return item.id === teamId; });
    return teamName(team);
  }
  if (!source) return "TBD";
  if (source.type === "seed") {
    const qualifier = getQualifiers(state)[Number(source.rank) - 1];
    return qualifier ? qualifier.name : "Seed " + source.rank;
  }
  if (source.type === "winner") return "Winner " + String(source.matchId).toUpperCase();
  return "TBD";
}
