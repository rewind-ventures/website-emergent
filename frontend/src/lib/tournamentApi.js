import {
  buildDrawState,
  createTournamentState,
  getMatchResult,
  normalizeTournament,
} from "@/lib/tournamentLogic";

const GOOGLE_SCRIPT_URL =
  process.env.REACT_APP_TOURNAMENT_SCRIPT_URL ||
  process.env.REACT_APP_GOOGLE_SCRIPT_URL ||
  "";
const LOCAL_PREFIX = "rewind_tournament_sheet_demo_";
const LOCAL_CODE_PREFIX = "rewind_tournament_code_demo_";
const ACCESS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getLocalKey(sheetId) {
  return `${LOCAL_PREFIX}${sheetId}`;
}

function getLocalCodeKey(accessCode) {
  return `${LOCAL_CODE_PREFIX}${normalizeAccessCode(accessCode)}`;
}

function normalizeAccessCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function makeAccessCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ACCESS_CODE_CHARS[Math.floor(Math.random() * ACCESS_CODE_CHARS.length)];
  }
  return code;
}

function makeUniqueLocalAccessCode() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = makeAccessCode();
    if (!window.localStorage.getItem(getLocalCodeKey(code))) return code;
  }
  throw new Error("Could not generate a tournament code. Try again.");
}

function readLocalTournament(sheetId) {
  const raw = window.localStorage.getItem(getLocalKey(sheetId));
  if (!raw) return null;
  return normalizeTournament(JSON.parse(raw));
}

function readLocalTournamentByCode(accessCode) {
  const sheetId = window.localStorage.getItem(getLocalCodeKey(accessCode));
  return sheetId ? readLocalTournament(sheetId) : null;
}

function writeLocalTournament(tournament) {
  const state = normalizeTournament(tournament);
  window.localStorage.setItem(getLocalKey(state.sheetId), JSON.stringify(state));
  if (state.accessCode) {
    window.localStorage.setItem(getLocalCodeKey(state.accessCode), state.sheetId);
  }
  return state;
}

function jsonpRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `__rewindTournament${Date.now()}${Math.random()
      .toString(16)
      .slice(2)}`;
    const script = document.createElement("script");
    const suppressJsonpError = (event) => {
      if (
        event.message === "Script error." ||
        String(event.filename || "").includes("script.google")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Tournament sync timed out. Check Drive for a newly created sheet, then try again."));
    }, 90000);

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("error", suppressJsonpError, true);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (response) => {
      cleanup();
      if (!response?.success) {
        reject(new Error(response?.error || "Tournament sync failed"));
        return;
      }
      resolve(response);
    };

    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("action", action);
    url.searchParams.set("payload", JSON.stringify(payload));

    script.src = url.toString();
    script.onerror = () => {
      cleanup();
      reject(new Error("Could not reach the tournament Google Script"));
    };
    window.addEventListener("error", suppressJsonpError, true);
    document.body.appendChild(script);
  });
}

async function localTournamentRequest(action, payload = {}) {
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  if (action === "createTournament") {
    const sheetId = `local-${Date.now()}`;
    const tournament = createTournamentState({
      id: sheetId,
      sheetId,
      sheetUrl: "",
      accessCode: makeUniqueLocalAccessCode(),
      name: payload.name,
      date: payload.date,
      courts: payload.courts,
    });
    return { success: true, demo: true, tournament: writeLocalTournament(tournament) };
  }

  if (action === "getTournamentByCode") {
    const tournament = readLocalTournamentByCode(payload.accessCode || payload.code);
    if (!tournament) throw new Error("Tournament code not found");
    return { success: true, demo: true, tournament };
  }

  const sheetId = payload.sheetId || payload.tournamentId;
  const tournament = readLocalTournament(sheetId);
  if (!tournament) throw new Error("Tournament not found");

  if (action === "getTournament") {
    return { success: true, demo: true, tournament };
  }

  if (action === "saveTeams") {
    return {
      success: true,
      demo: true,
      tournament: writeLocalTournament({
        ...tournament,
        teams: payload.teams || [],
        groups: [],
        matches: [],
        format: null,
        status: "setup",
        version: tournament.version + 1,
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  if (action === "generateDraw") {
    return {
      success: true,
      demo: true,
      tournament: writeLocalTournament(buildDrawState(tournament, payload.format)),
    };
  }

  if (action === "resetDraw") {
    return {
      success: true,
      demo: true,
      tournament: writeLocalTournament({
        ...tournament,
        groups: [],
        matches: [],
        format: null,
        status: "setup",
        version: tournament.version + 1,
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  if (action === "submitScore") {
    if (tournament.matches.find((match) => match.id === payload.matchId)?.status === "locked") {
      throw new Error("This score is locked. Unlock it before resubmitting.");
    }

    const nextMatches = tournament.matches.map((match) => {
      if (match.id !== payload.matchId) return match;
      return {
        ...match,
        teamAId: payload.teamAId || match.teamAId,
        teamBId: payload.teamBId || match.teamBId,
        teamAScore: String(payload.teamAScore),
        teamBScore: String(payload.teamBScore),
        status: "locked",
        submittedBy: payload.refereeName || "Referee",
        submittedAt: new Date().toISOString(),
      };
    });

    return {
      success: true,
      demo: true,
      tournament: writeLocalTournament({
        ...tournament,
        matches: nextMatches,
        status: "in_progress",
        version: tournament.version + 1,
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  if (action === "submitScores") {
    const scores = Array.isArray(payload.scores) ? payload.scores : [];
    const savedMatchIds = [];
    const conflicts = [];
    const submittedAt = new Date().toISOString();
    const nextMatches = tournament.matches.map((match) => {
      const entry = scores.find((item) => (item.matchId || item.m) === match.id);
      if (!entry) return match;

      if (match.status === "locked") {
        conflicts.push({ matchId: match.id, reason: "Score is already locked." });
        return match;
      }

      const teamAScore = Number(entry.teamAScore ?? entry.as);
      const teamBScore = Number(entry.teamBScore ?? entry.bs);
      const teamAId = entry.teamAId || entry.a || match.teamAId;
      const teamBId = entry.teamBId || entry.b || match.teamBId;

      if (!teamAId || !teamBId) {
        conflicts.push({ matchId: match.id, reason: "Match is not ready yet." });
        return match;
      }

      if (
        !Number.isFinite(teamAScore) ||
        !Number.isFinite(teamBScore) ||
        teamAScore < 0 ||
        teamBScore < 0 ||
        teamAScore === teamBScore
      ) {
        conflicts.push({ matchId: match.id, reason: "Enter a valid non-tied score." });
        return match;
      }

      savedMatchIds.push(match.id);
      return {
        ...match,
        teamAId,
        teamBId,
        teamAScore: String(teamAScore),
        teamBScore: String(teamBScore),
        status: "locked",
        submittedBy: entry.refereeName || entry.r || payload.refereeName || "Referee",
        submittedAt,
      };
    });

    return {
      success: true,
      demo: true,
      saved: savedMatchIds.length,
      savedMatchIds,
      conflicts,
      tournament: writeLocalTournament({
        ...tournament,
        matches: nextMatches,
        status: savedMatchIds.length ? "in_progress" : tournament.status,
        version: savedMatchIds.length ? tournament.version + 1 : tournament.version,
        updatedAt: savedMatchIds.length ? submittedAt : tournament.updatedAt,
      }),
    };
  }

  if (action === "updateMatchTeams") {
    const nextMatches = tournament.matches.map((match) => {
      if (match.id !== payload.matchId) return match;
      if (match.status === "locked") {
        throw new Error("Unlock this score before changing teams.");
      }
      return {
        ...match,
        teamAId: Object.prototype.hasOwnProperty.call(payload, "teamAId")
          ? payload.teamAId
          : match.teamAId,
        teamBId: Object.prototype.hasOwnProperty.call(payload, "teamBId")
          ? payload.teamBId
          : match.teamBId,
        court: Object.prototype.hasOwnProperty.call(payload, "court")
          ? payload.court === ""
            ? ""
            : Math.max(1, Number(payload.court) || 1)
          : match.court,
      };
    });

    return {
      success: true,
      demo: true,
      tournament: writeLocalTournament({
        ...tournament,
        matches: nextMatches,
        version: tournament.version + 1,
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  if (action === "unlockScore") {
    const nextMatches = tournament.matches.map((match) => {
      if (match.id !== payload.matchId) return match;
      const result = getMatchResult(match);
      return {
        ...match,
        status: "open",
        unlockedBy: payload.refereeName || "Referee",
        unlockedAt: new Date().toISOString(),
        lockVersion: Number(match.lockVersion || 0) + 1,
        previousWinnerId: result.winnerId || "",
      };
    });

    return {
      success: true,
      demo: true,
      tournament: writeLocalTournament({
        ...tournament,
        matches: nextMatches,
        version: tournament.version + 1,
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  throw new Error(`Unsupported tournament action: ${action}`);
}

export async function tournamentRequest(action, payload = {}) {
  if (!GOOGLE_SCRIPT_URL) {
    return localTournamentRequest(action, payload);
  }

  const response = await jsonpRequest(action, payload);
  return {
    ...response,
    tournament: response.tournament ? normalizeTournament(response.tournament) : null,
  };
}

export function isTournamentBackendConfigured() {
  return Boolean(GOOGLE_SCRIPT_URL);
}
