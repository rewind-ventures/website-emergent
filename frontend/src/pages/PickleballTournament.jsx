import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "@/pickleball-tournament.css";

import { MOCK } from "@/mock";
import { tournamentRequest, isTournamentBackendConfigured } from "@/lib/tournamentApi";
import {
  PLAYOFF_LABELS,
  PLAYOFF_SIZES,
  buildStandings,
  createTeam,
  getGroupStandings,
  getMatchResult,
  getQualifiers,
  groupMatchesByRound,
  groupStageComplete,
  normalizeTournament,
  parseBulkTeamLine,
  resolveMatches,
  scoreStarted,
  teamName,
  todayInputValue,
  validateDrawConfig,
} from "@/lib/tournamentLogic";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster, toast } from "@/components/ui/sonner";

import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
  Unlock,
  Users,
} from "lucide-react";

const DEFAULT_SETUP = {
  name: "Daily Pickleball Tournament",
  date: todayInputValue(),
  courts: 4,
};

const DEFAULT_DRAW = {
  mode: "groups",
  groupCount: 4,
  directQualifiers: 2,
  wildcardCount: 0,
  playoffStart: "quarterfinals",
};

const SCORE_BATCH_SIZE = 8;

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value || "pickleball-tournament")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function escapePdfText(value) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfText(text, maxChars) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function createPdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 42;
  const pages = [];
  let page = [];
  let y = pageHeight - margin;

  lines.forEach((line) => {
    if (line.spacer) {
      y -= line.size || 10;
      return;
    }

    const size = line.size || 10;
    const wrapped = wrapPdfText(line.text, line.maxChars || (size > 13 ? 58 : 94));

    wrapped.forEach((text, index) => {
      if (y < margin) {
        pages.push(page);
        page = [];
        y = pageHeight - margin;
      }
      page.push({
        text,
        size,
        bold: line.bold,
        y,
        indent: line.indent || 0,
      });
      y -= index === wrapped.length - 1 ? size + 8 : size + 3;
    });
  });

  pages.push(page);

  const objects = [];
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  pages.forEach((pdfPage, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = pageObjectId + 1;
    const content = pdfPage
      .map((line) => {
        const font = line.bold ? "F2" : "F1";
        const x = margin + line.indent;
        return `BT /${font} ${line.size} Tf ${x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`;
      })
      .join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function buildCsv(tournament, matches, standings) {
  const lines = [];
  lines.push(["Tournament", tournament.name].map(csvEscape).join(","));
  lines.push(["Date", tournament.date].map(csvEscape).join(","));
  lines.push(["Google Sheet", tournament.sheetUrl].map(csvEscape).join(","));
  lines.push([]);
  lines.push(
    ["Phase", "Round", "Group", "Court", "Team A", "Score A", "Score B", "Team B", "Winner", "Status", "Submitted By"]
      .map(csvEscape)
      .join(",")
  );

  matches.forEach((match) => {
    const result = getMatchResult(match);
    const winner =
      result.winnerId === match.teamAId
        ? match.teamALabel
        : result.winnerId === match.teamBId
          ? match.teamBLabel
          : "";
    lines.push(
      [
        match.phaseLabel,
        match.round,
        match.groupId,
        match.court,
        match.teamALabel,
        match.teamAScore,
        match.teamBScore,
        match.teamBLabel,
        winner,
        match.status,
        match.submittedBy,
      ]
        .map(csvEscape)
        .join(",")
    );
  });

  lines.push([]);
  lines.push(["Rank", "Team", "Played", "Wins", "Losses", "PF", "PA", "Diff"].map(csvEscape).join(","));
  standings.forEach((row, index) => {
    lines.push(
      [index + 1, row.name, row.played, row.wins, row.losses, row.pointsFor, row.pointsAgainst, row.diff]
        .map(csvEscape)
        .join(",")
    );
  });

  return lines.join("\n");
}

function buildPdf(tournament, matches, standings) {
  const lines = [
    { text: tournament.name, size: 18, bold: true, maxChars: 46 },
    {
      text: `Pickleball score sheet | ${tournament.date || "No date"} | ${tournament.teams.length} teams | ${matches.length} matches`,
      size: 10,
    },
    { spacer: true, size: 12 },
    { text: "Standings", size: 14, bold: true },
  ];

  standings.forEach((row, index) => {
    lines.push({
      text: `${index + 1}. ${row.name} | P ${row.played} | W ${row.wins} | L ${row.losses} | PF ${row.pointsFor} | PA ${row.pointsAgainst} | Diff ${row.diff}`,
      size: 10,
      indent: 10,
    });
  });

  lines.push({ spacer: true, size: 12 });
  lines.push({ text: "Matches", size: 14, bold: true });
  matches.forEach((match) => {
    const result = getMatchResult(match);
    const winner =
      result.winnerId === match.teamAId
        ? match.teamALabel
        : result.winnerId === match.teamBId
          ? match.teamBLabel
          : "Pending";
    lines.push({
      text: `${match.phaseLabel}, Court ${match.court}: ${match.teamALabel} ${match.teamAScore || "-"} - ${match.teamBScore || "-"} ${match.teamBLabel} | Winner: ${winner}`,
      size: 10,
      indent: 10,
    });
  });

  return createPdf(lines);
}

function statusLabel(match) {
  if (match.status === "locked") return "Locked";
  const result = getMatchResult(match);
  if (result.complete) return "Ready to submit";
  if (result.status === "needs_winner") return "Needs valid score";
  return "Open";
}

function normalizeAccessCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function buildAccessLink(accessCode) {
  if (!accessCode || typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#/pickleball?code=${encodeURIComponent(accessCode)}`;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getErrorMessage(error) {
  return String(error?.message || error || "");
}

function isBulkUnsupportedError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("unsupported action") ||
    message.includes("submit scores") ||
    message.includes("submitscores") ||
    message.includes("could not reach") ||
    message.includes("timed out")
  );
}

export default function PickleballTournament() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeSheetId = searchParams.get("t") || "";
  const routeAccessCode = normalizeAccessCode(searchParams.get("code") || "");

  const [createForm, setCreateForm] = useState(DEFAULT_SETUP);
  const [accessCodeInput, setAccessCodeInput] = useState(routeAccessCode);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(Boolean(routeSheetId || routeAccessCode));
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [playerOne, setPlayerOne] = useState("");
  const [playerTwo, setPlayerTwo] = useState("");
  const [bulkTeams, setBulkTeams] = useState("");
  const [drawConfig, setDrawConfig] = useState(DEFAULT_DRAW);
  const [refereeName, setRefereeName] = useState("");
  const [courtFilter, setCourtFilter] = useState("all");
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [courtDrafts, setCourtDrafts] = useState({});
  const [openCourtIds, setOpenCourtIds] = useState([]);
  const [courtGroupsInitializedFor, setCourtGroupsInitializedFor] = useState("");

  const backendConfigured = isTournamentBackendConfigured();
  const state = tournament ? normalizeTournament(tournament) : null;
  const matches = useMemo(() => (state ? resolveMatches(state) : []), [state]);
  const roundGroups = useMemo(() => Object.values(groupMatchesByRound(matches)), [matches]);
  const allStandings = useMemo(
    () => (state ? buildStandings(state.teams, matches, { phase: "round_robin" }) : []),
    [state, matches]
  );
  const groupStandings = useMemo(() => (state ? getGroupStandings({ ...state, matches }) : []), [state, matches]);
  const qualifiers = useMemo(() => (state ? getQualifiers({ ...state, matches }) : []), [state, matches]);
  const scoresHaveStarted = useMemo(() => scoreStarted(state?.matches || []), [state]);
  const completedMatches = matches.filter((match) => getMatchResult(match).complete).length;
  const drawError = state ? validateDrawConfig(state.teams, drawConfig) : "";
  const filteredScoreMatches = useMemo(
    () =>
      matches.filter((match) =>
        courtFilter === "all" ? true : String(match.court || "") === courtFilter
      ),
    [courtFilter, matches]
  );
  const playoffScoreMatches = useMemo(
    () => filteredScoreMatches.filter((match) => match.phase !== "round_robin"),
    [filteredScoreMatches]
  );
  const scoreCourtGroups = useMemo(() => {
    const byCourt = new Map();
    filteredScoreMatches.filter((match) => match.phase === "round_robin").forEach((match) => {
      const courtId = String(match.court || "1");
      if (!byCourt.has(courtId)) {
        byCourt.set(courtId, {
          courtId,
          title: `Court ${courtId}`,
          matches: [],
        });
      }
      byCourt.get(courtId).matches.push(match);
    });

    return Array.from(byCourt.values()).sort((a, b) => Number(a.courtId) - Number(b.courtId));
  }, [filteredScoreMatches]);
  const scoreCourtGroupIds = useMemo(
    () => scoreCourtGroups.map((group) => group.courtId).join("|"),
    [scoreCourtGroups]
  );
  const pendingScoreSubmissions = useMemo(
    () =>
      matches
        .filter((match) => match.status !== "locked" && match.teamAId && match.teamBId)
        .map((match) => {
          const draft = scoreDrafts[match.id] || {};
          const teamAScore = draft.teamAScore ?? match.teamAScore;
          const teamBScore = draft.teamBScore ?? match.teamBScore;
          const parsedA = Number(teamAScore);
          const parsedB = Number(teamBScore);
          return {
            match,
            teamAScore,
            teamBScore,
            valid:
              teamAScore !== "" &&
              teamBScore !== "" &&
              Number.isFinite(parsedA) &&
              Number.isFinite(parsedB) &&
              parsedA >= 0 &&
              parsedB >= 0 &&
              parsedA !== parsedB,
          };
        })
        .filter((entry) => entry.valid),
    [matches, scoreDrafts]
  );
  const shareLink = buildAccessLink(state?.accessCode || "");

  async function syncAction(action, payload = {}, options = {}) {
    if (
      !state?.sheetId &&
      !payload.sheetId &&
      action !== "createTournament" &&
      action !== "getTournamentByCode"
    ) {
      return null;
    }
    setSyncing(true);
    try {
      const response = await tournamentRequest(action, {
        sheetId: state?.sheetId,
        ...payload,
      });
      if (response.tournament) {
        setTournament(response.tournament);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
      if (response.demo && !options.silent) {
        toast.message("Demo storage active", {
          description: "Set REACT_APP_TOURNAMENT_SCRIPT_URL to create real Google Sheets.",
        });
      }
      return response;
    } catch (error) {
      if (!options.silent) {
        toast.message("Sync failed", {
          description: error.message || "Please try again.",
        });
      }
      throw error;
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!routeSheetId && !routeAccessCode) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setAccessCodeInput(routeAccessCode);
    tournamentRequest(
      routeAccessCode ? "getTournamentByCode" : "getTournament",
      routeAccessCode ? { accessCode: routeAccessCode } : { sheetId: routeSheetId }
    )
      .then((response) => {
        if (cancelled) return;
        setTournament(response.tournament);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      })
      .catch((error) => {
        if (!cancelled) {
          toast.message("Tournament not loaded", {
            description: error.message || "Check the tournament link.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routeSheetId, routeAccessCode]);

  useEffect(() => {
    if (!state?.sheetId) return undefined;
    const interval = window.setInterval(() => {
      tournamentRequest("getTournament", { sheetId: state.sheetId })
        .then((response) => {
          setTournament(response.tournament);
          setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        })
        .catch(() => {
          // Polling is best-effort; user-triggered actions still surface errors.
        });
    }, 3500);

    return () => window.clearInterval(interval);
  }, [state?.sheetId]);

  useEffect(() => {
    if (!scoreCourtGroups.length) {
      setOpenCourtIds([]);
      setCourtGroupsInitializedFor("");
      return;
    }

    const groupsChanged = courtGroupsInitializedFor !== scoreCourtGroupIds;
    setOpenCourtIds((current) => {
      const available = new Set(scoreCourtGroups.map((group) => group.courtId));
      const next = current.filter((courtId) => available.has(courtId));
      if (groupsChanged && courtFilter !== "all" && available.has(courtFilter) && !next.includes(courtFilter)) {
        next.push(courtFilter);
      }
      if (groupsChanged && !next.length) next.push(scoreCourtGroups[0].courtId);
      if (next.length === current.length && next.every((courtId, index) => courtId === current[index])) {
        return current;
      }
      return next;
    });
    if (groupsChanged) setCourtGroupsInitializedFor(scoreCourtGroupIds);
  }, [courtFilter, courtGroupsInitializedFor, scoreCourtGroupIds, scoreCourtGroups]);

  function toggleCourt(courtId) {
    setOpenCourtIds((current) =>
      current.includes(courtId)
        ? current.filter((item) => item !== courtId)
        : [...current, courtId]
    );
  }

  async function createTournament(event) {
    event.preventDefault();
    const response = await syncAction("createTournament", createForm);
    if (response?.tournament?.sheetId) {
      setTournament(response.tournament);
      if (response.tournament.accessCode) {
        setAccessCodeInput(response.tournament.accessCode);
        setSearchParams({ code: response.tournament.accessCode });
      } else {
        setSearchParams({ t: response.tournament.sheetId });
      }
      toast.success(
        response.tournament.accessCode
          ? `Tournament created. Share code ${response.tournament.accessCode}.`
          : "Tournament sheet created"
      );
    }
  }

  async function accessTournament(event) {
    event.preventDefault();
    const accessCode = normalizeAccessCode(accessCodeInput);
    if (!accessCode) {
      toast.message("Enter the tournament code.");
      return;
    }

    const response = await syncAction("getTournamentByCode", { accessCode });
    if (response?.tournament) {
      setTournament(response.tournament);
      setSearchParams({ code: response.tournament.accessCode || accessCode });
      toast.success("Tournament opened");
    }
  }

  async function copyAccessLink() {
    if (!shareLink) {
      toast.message("This tournament does not have an access code yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Tournament link copied");
    } catch (error) {
      toast.message("Copy failed", {
        description: shareLink,
      });
    }
  }

  async function saveTeams(nextTeams) {
    await syncAction("saveTeams", { teams: nextTeams });
  }

  async function handleAddTeam(event) {
    event.preventDefault();
    const one = playerOne.trim();
    const two = playerTwo.trim();
    if (!one && !two) {
      toast.message("Add at least one player name.");
      return;
    }
    await saveTeams([...(state?.teams || []), createTeam(one || two, one ? two : "")]);
    setPlayerOne("");
    setPlayerTwo("");
    toast.success("Team saved to the tournament sheet");
  }

  async function handleBulkAdd() {
    const rows = bulkTeams
      .split("\n")
      .map((row) => row.trim())
      .filter(Boolean);
    if (!rows.length) {
      toast.message("Paste one team per line first.");
      return;
    }
    await saveTeams([...(state?.teams || []), ...rows.map(parseBulkTeamLine)]);
    setBulkTeams("");
    toast.success(`${rows.length} team${rows.length === 1 ? "" : "s"} saved`);
  }

  async function removeTeam(teamId) {
    if (scoresHaveStarted) {
      toast.message("Scores have started", {
        description: "Create a fresh tournament if teams need to change after scoring starts.",
      });
      return;
    }
    await saveTeams(state.teams.filter((team) => team.id !== teamId));
  }

  async function generateDraw() {
    if (drawError) {
      toast.message("Draw setup needs attention", { description: drawError });
      return;
    }
    if (scoresHaveStarted && !window.confirm("Regenerating the draw clears existing scores. Continue?")) {
      return;
    }
    await syncAction("generateDraw", { format: drawConfig });
    toast.success("Draw saved to the tournament sheet");
  }

  async function resetDraw() {
    if (scoresHaveStarted && !window.confirm("Resetting the draw clears existing scores. Continue?")) {
      return;
    }
    await syncAction("resetDraw");
    toast.success("Draw reset");
  }

  function setDraft(matchId, field, value) {
    setScoreDrafts((current) => ({
      ...current,
      [matchId]: {
        ...current[matchId],
        [field]: value,
      },
    }));
  }

  async function submitScore(match) {
    if (!match.teamAId || !match.teamBId) {
      toast.message("Match is not ready yet", {
        description: "Playoff teams appear once the previous round is complete.",
      });
      return;
    }
    const draft = scoreDrafts[match.id] || {};
    const teamAScore = draft.teamAScore ?? match.teamAScore;
    const teamBScore = draft.teamBScore ?? match.teamBScore;
    if (teamAScore === "" || teamBScore === "" || Number(teamAScore) === Number(teamBScore)) {
      toast.message("Enter a winning score before submitting.");
      return;
    }

    await syncAction("submitScore", {
      matchId: match.id,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      teamAScore,
      teamBScore,
      refereeName: refereeName.trim() || "Referee",
    });
    setScoreDrafts((current) => {
      const next = { ...current };
      delete next[match.id];
      return next;
    });
    toast.success("Score submitted and locked");
  }

  async function submitAllScores() {
    if (!pendingScoreSubmissions.length) {
      toast.message("Enter scores for one or more open matches first.");
      return;
    }

    const referee = refereeName.trim() || "Referee";
    const savedMatchIds = new Set();
    const conflicts = [];
    const chunks = chunkArray(pendingScoreSubmissions, SCORE_BATCH_SIZE);

    try {
      for (const chunk of chunks) {
        const response = await syncAction(
          "submitScores",
          {
            refereeName: referee,
            scores: chunk.map(({ match, teamAScore, teamBScore }) => ({
              m: match.id,
              a: match.teamAId,
              b: match.teamBId,
              as: teamAScore,
              bs: teamBScore,
              r: referee,
            })),
          },
          { silent: true }
        );

        (response?.savedMatchIds || []).forEach((matchId) => savedMatchIds.add(matchId));
        (response?.conflicts || []).forEach((conflict) => conflicts.push(conflict));
      }
    } catch (error) {
      if (!savedMatchIds.size && isBulkUnsupportedError(error)) {
        for (const { match, teamAScore, teamBScore } of pendingScoreSubmissions) {
          try {
            await syncAction(
              "submitScore",
              {
                matchId: match.id,
                teamAId: match.teamAId,
                teamBId: match.teamBId,
                teamAScore,
                teamBScore,
                refereeName: referee,
              },
              { silent: true }
            );
            savedMatchIds.add(match.id);
          } catch (submitError) {
            conflicts.push({
              matchId: match.id,
              reason: getErrorMessage(submitError) || "Score was not submitted.",
            });
          }
        }
      } else {
        conflicts.push({
          matchId: "",
          reason: getErrorMessage(error) || "Refresh and try again.",
        });
      }
    }

    if (savedMatchIds.size) {
      setScoreDrafts((current) => {
        const next = { ...current };
        savedMatchIds.forEach((matchId) => {
          delete next[matchId];
        });
        return next;
      });
    }

    const conflictCount = conflicts.length;
    if (savedMatchIds.size && conflictCount) {
      toast.message(`${savedMatchIds.size} scores saved`, {
        description: `${conflictCount} match${conflictCount === 1 ? " was" : "es were"} already locked or invalid.`,
      });
    } else if (savedMatchIds.size) {
      toast.success(`${savedMatchIds.size} score${savedMatchIds.size === 1 ? "" : "s"} submitted and locked`);
    } else if (conflictCount) {
      toast.message("No scores were saved", {
        description: conflicts[0]?.reason || "Refresh and try again.",
      });
    }
  }

  async function unlockScore(match) {
    if (!window.confirm("Unlock this score for resubmission?")) return;
    await syncAction("unlockScore", {
      matchId: match.id,
      refereeName: refereeName.trim() || "Referee",
    });
    toast.success("Score unlocked");
  }

  async function updatePlayoffSlot(match, field, value) {
    await syncAction("updateMatchTeams", {
      matchId: match.id,
      [field]: value,
    });
    toast.success("Playoff slot updated");
  }

  async function updateMatchCourt(match, value) {
    const rawMatch = state.matches.find((item) => item.id === match.id) || match;
    const normalized = value === "" ? "" : Math.max(1, Number(value) || 1);
    if (String(rawMatch.court || "") === String(normalized || "")) return;

    await syncAction("updateMatchTeams", {
      matchId: match.id,
      court: normalized,
    });

    setCourtDrafts((current) => {
      const next = { ...current };
      delete next[match.id];
      return next;
    });
    toast.success(normalized ? `Court ${normalized} saved` : "Court cleared");
  }

  function downloadCsv() {
    if (!state || !matches.length) {
      toast.message("Generate a draw first.");
      return;
    }
    downloadBlob(
      buildCsv(state, matches, allStandings),
      "text/csv;charset=utf-8",
      `${slugify(state.name)}-score-sheet.csv`
    );
  }

  function downloadPdf() {
    if (!state || !matches.length) {
      toast.message("Generate a draw first.");
      return;
    }
    downloadBlob(
      buildPdf(state, matches, allStandings),
      "application/pdf",
      `${slugify(state.name)}-score-sheet.pdf`
    );
  }

  function renderScoreRow(match) {
    const locked = match.status === "locked";
    const ready = Boolean(match.teamAId && match.teamBId);
    const draft = scoreDrafts[match.id] || {};
    const teamAScore = draft.teamAScore ?? match.teamAScore;
    const teamBScore = draft.teamBScore ?? match.teamBScore;
    const rawMatch = state.matches.find((item) => item.id === match.id) || match;
    const playoff = match.phase !== "round_robin";
    const courtValue = courtDrafts[match.id] ?? rawMatch.court ?? "";
    const meta = playoff
      ? match.court
        ? `${match.phaseLabel} - Court ${match.court}`
        : match.phaseLabel
      : `${match.phaseLabel} - Court ${match.court}`;

    return (
      <div className={`pbm-scoreRow ${locked ? "pbm-scoreRowLocked" : ""}`} key={match.id}>
        <div className="pbm-scoreMeta">{meta}</div>
        <ScoreTeamSlot
          auto={!rawMatch.teamAId && Boolean(rawMatch.teamAFrom)}
          disabled={locked || !playoff}
          field="teamAId"
          match={match}
          onChange={updatePlayoffSlot}
          teams={state.teams}
          value={rawMatch.teamAId || ""}
        />
        <Input
          aria-label={`${match.teamALabel} score`}
          className="rv2-input pbm-input pbm-scoreInput"
          type="number"
          min="0"
          value={teamAScore}
          disabled={locked || !ready}
          onChange={(event) => setDraft(match.id, "teamAScore", event.target.value)}
        />
        <div className="pbm-scoreDivider">-</div>
        <Input
          aria-label={`${match.teamBLabel} score`}
          className="rv2-input pbm-input pbm-scoreInput"
          type="number"
          min="0"
          value={teamBScore}
          disabled={locked || !ready}
          onChange={(event) => setDraft(match.id, "teamBScore", event.target.value)}
        />
        <ScoreTeamSlot
          auto={!rawMatch.teamBId && Boolean(rawMatch.teamBFrom)}
          disabled={locked || !playoff}
          field="teamBId"
          match={match}
          onChange={updatePlayoffSlot}
          teams={state.teams}
          value={rawMatch.teamBId || ""}
        />
        <div className="pbm-scoreActions">
          {playoff ? (
            <label className="pbm-playoffCourt">
              <span>Court</span>
              <Input
                aria-label={`${match.phaseLabel} court`}
                className="rv2-input pbm-input pbm-courtInput"
                type="number"
                min="1"
                placeholder="TBD"
                value={courtValue}
                disabled={locked}
                onChange={(event) =>
                  setCourtDrafts((current) => ({
                    ...current,
                    [match.id]: event.target.value,
                  }))
                }
                onBlur={(event) => updateMatchCourt(match, event.target.value)}
              />
            </label>
          ) : null}
          <Badge
            className={`pbm-scoreBadge ${locked ? "pbm-scoreBadgeWin" : ""}`}
            variant="secondary">
            {locked ? <Lock className="h-3 w-3" /> : null}
            {statusLabel(match)}
          </Badge>
          {locked ? (
            <Button
              className="rv2-btn rv2-btnSecondary pbm-rowBtn"
              type="button"
              disabled={syncing}
              onClick={() => unlockScore(match)}>
              <Unlock className="h-4 w-4" />
              Unlock and resubmit
            </Button>
          ) : (
            <Button
              className="rv2-btn rv2-btnPrimary pbm-rowBtn"
              type="button"
              disabled={syncing || !ready}
              onClick={() => submitScore(match)}>
              <Save className="h-4 w-4" />
              Submit score
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rv2-page pbm-page">
        <div className="pbm-loading">Loading tournament...</div>
      </div>
    );
  }

  return (
    <div className="rv2-page pbm-page">
      <Toaster richColors closeButton />
      <header className="rv2-header">
        <div className="rv2-container">
          <div className="rv2-headerRow pbm-headerRow">
            <Button
              className="rv2-btn rv2-btnSecondary"
              variant="outline"
              type="button"
              onClick={() => navigate("/")}
              aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="rv2-logo" aria-label="Rewind Ventures">
              <span className="rv2-logoMark" aria-hidden>
                <span className="rv2-logoMonogram">RV</span>
              </span>
              <span className="rv2-logoText">{MOCK.brand.name}</span>
            </div>

            {state?.sheetUrl ? (
              <Button
                className="rv2-btn rv2-btnPrimary pbm-headerExport"
                type="button"
                onClick={() => window.open(state.sheetUrl, "_blank", "noopener,noreferrer")}>
                <ExternalLink className="h-4 w-4" />
                Sheet
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="pbm-main">
        <section className="pbm-hero">
          <div className="rv2-container">
            <div className="pbm-heroGrid">
              <div>
                <Badge className="rv2-sectionTag" variant="secondary">
                  PICKLEBALL TOURNAMENT MANAGER
                </Badge>
                <h1 className="pbm-title">Run a shared live tournament sheet.</h1>
                <p className="pbm-subtitle">
                  Create a tournament, add teams, choose the draw format, and let referees submit
                  locked scores from the same live Google Sheet.
                </p>
              </div>

              <div className="pbm-statusPanel" aria-label="Tournament status">
                <div className="pbm-statusItem">
                  <Users className="h-5 w-5" />
                  <span>{state?.teams.length || 0} teams</span>
                </div>
                <div className="pbm-statusItem">
                  <Trophy className="h-5 w-5" />
                  <span>{completedMatches} scored</span>
                </div>
                <div className="pbm-statusItem">
                  <ShieldCheck className="h-5 w-5" />
                  <span>{backendConfigured ? "Google Sheet sync" : "Demo storage"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pbm-workspace">
          <div className="rv2-container">
            {!state ? (
              <div className="pbm-startGrid">
                <section className="pbm-panel pbm-accessPanel">
                  <div className="pbm-panelHead">
                    <div>
                      <h2>Open tournament</h2>
                      <p>Enter the code shared by the tournament director.</p>
                    </div>
                  </div>

                  <form className="pbm-accessForm" onSubmit={accessTournament}>
                    <div className="pbm-field">
                      <label htmlFor="tournament-code">Tournament code</label>
                      <Input
                        id="tournament-code"
                        className="rv2-input pbm-input pbm-codeInput"
                        autoComplete="off"
                        inputMode="text"
                        placeholder="AB12CD"
                        value={accessCodeInput}
                        onChange={(event) => setAccessCodeInput(normalizeAccessCode(event.target.value))}
                      />
                    </div>
                    <Button className="rv2-btn rv2-btnPrimary pbm-actionBtn" type="submit" disabled={syncing}>
                      <ShieldCheck className="h-4 w-4" />
                      Open
                    </Button>
                  </form>
                </section>

                <section className="pbm-panel pbm-createPanel">
                  <div className="pbm-panelHead">
                    <div>
                      <h2>Create tournament sheet</h2>
                      <p>
                        This creates a new Google Sheet and a tournament code for referees.
                      </p>
                    </div>
                  </div>

                  {!backendConfigured ? (
                    <div className="pbm-warning">
                      Google Script URL is not configured. This browser will use demo storage until
                      `REACT_APP_TOURNAMENT_SCRIPT_URL` is set.
                    </div>
                  ) : null}

                  <form className="pbm-toolbar pbm-createForm" onSubmit={createTournament}>
                    <div className="pbm-field">
                      <label htmlFor="new-tournament-name">Tournament name</label>
                      <Input
                        id="new-tournament-name"
                        className="rv2-input pbm-input"
                        value={createForm.name}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="pbm-field pbm-smallField">
                      <label htmlFor="new-tournament-date">Date</label>
                      <Input
                        id="new-tournament-date"
                        type="date"
                        className="rv2-input pbm-input"
                        value={createForm.date}
                        onChange={(event) =>
                          setCreateForm((current) => ({ ...current, date: event.target.value }))
                        }
                      />
                    </div>
                    <div className="pbm-field pbm-smallField">
                      <label htmlFor="new-courts">Courts</label>
                      <Input
                        id="new-courts"
                        type="number"
                        min="1"
                        className="rv2-input pbm-input"
                        value={createForm.courts}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            courts: Math.max(1, Number(event.target.value) || 1),
                          }))
                        }
                      />
                    </div>
                    <Button className="rv2-btn rv2-btnPrimary pbm-actionBtn" type="submit" disabled={syncing}>
                      <FileSpreadsheet className="h-4 w-4" />
                      Create sheet
                    </Button>
                  </form>
                </section>
              </div>
            ) : (
              <>
                <div className="pbm-toolbar pbm-sessionToolbar">
                  <div className="pbm-field">
                    <label>Tournament sheet</label>
                    <div className="pbm-shareLine">
                      <span>{state.name}</span>
                      {state.sheetUrl ? (
                        <a href={state.sheetUrl} target="_blank" rel="noreferrer">
                          Open sheet
                        </a>
                      ) : null}
                    </div>
                  </div>

                  <div className="pbm-field pbm-codeField">
                    <label>Access code</label>
                    <div className="pbm-codeBox">
                      <strong>{state.accessCode || "Not set"}</strong>
                      <Button
                        className="rv2-btn rv2-btnSecondary pbm-copyBtn"
                        type="button"
                        disabled={!state.accessCode}
                        onClick={copyAccessLink}>
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="pbm-field pbm-smallField">
                    <label>Sync</label>
                    <div className="pbm-syncText">
                      {syncing ? "Syncing..." : lastSyncedAt ? `Updated ${lastSyncedAt}` : "Ready"}
                    </div>
                  </div>

                  <div className="pbm-field pbm-smallField">
                    <label htmlFor="referee-name">Referee</label>
                    <Input
                      id="referee-name"
                      className="rv2-input pbm-input"
                      placeholder="Your name"
                      value={refereeName}
                      onChange={(event) => setRefereeName(event.target.value)}
                    />
                  </div>
                </div>

                <Tabs defaultValue="setup" className="pbm-tabs">
                  <TabsList className="pbm-tabsList">
                    <TabsTrigger className="pbm-tabsTrigger" value="setup">
                      Setup
                    </TabsTrigger>
                    <TabsTrigger className="pbm-tabsTrigger" value="draw">
                      Draw
                    </TabsTrigger>
                    <TabsTrigger className="pbm-tabsTrigger" value="scores">
                      Scores
                    </TabsTrigger>
                    <TabsTrigger className="pbm-tabsTrigger" value="export">
                      Export
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="setup" className="pbm-tabsContent">
                    <div className="pbm-grid">
                      <section className="pbm-panel">
                        <div className="pbm-panelHead">
                          <div>
                            <h2>Add teams</h2>
                            <p>Teams are saved to this tournament sheet before the draw is made.</p>
                          </div>
                          <Badge className="pbm-softBadge" variant="secondary">
                            {state.teams.length} teams
                          </Badge>
                        </div>

                        <form className="pbm-teamForm" onSubmit={handleAddTeam}>
                          <div className="pbm-field">
                            <label htmlFor="player-one">Player one</label>
                            <Input
                              id="player-one"
                              className="rv2-input pbm-input"
                              placeholder="e.g., Aisha Rao"
                              value={playerOne}
                              disabled={scoresHaveStarted}
                              onChange={(event) => setPlayerOne(event.target.value)}
                            />
                          </div>

                          <div className="pbm-field">
                            <label htmlFor="player-two">Player two</label>
                            <Input
                              id="player-two"
                              className="rv2-input pbm-input"
                              placeholder="Optional partner"
                              value={playerTwo}
                              disabled={scoresHaveStarted}
                              onChange={(event) => setPlayerTwo(event.target.value)}
                            />
                          </div>

                          <Button
                            className="rv2-btn rv2-btnPrimary pbm-actionBtn"
                            type="submit"
                            disabled={syncing || scoresHaveStarted}>
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </form>

                        <div className="pbm-bulkBox">
                          <div className="pbm-field">
                            <label htmlFor="bulk-teams">Paste teams</label>
                            <Textarea
                              id="bulk-teams"
                              className="rv2-input pbm-input pbm-textarea"
                              placeholder={"One team per line\nAisha Rao / Kabir Shah\nMeera Singh / Rohan Das"}
                              value={bulkTeams}
                              disabled={scoresHaveStarted}
                              onChange={(event) => setBulkTeams(event.target.value)}
                            />
                          </div>
                          <Button
                            className="rv2-btn rv2-btnSecondary pbm-actionBtn"
                            type="button"
                            disabled={syncing || scoresHaveStarted}
                            onClick={handleBulkAdd}>
                            <Plus className="h-4 w-4" />
                            Add pasted teams
                          </Button>
                        </div>
                      </section>

                      <section className="pbm-panel">
                        <div className="pbm-panelHead">
                          <div>
                            <h2>Teams</h2>
                            <p>{scoresHaveStarted ? "Locked after scoring starts." : "Adjust before scoring starts."}</p>
                          </div>
                          {state.matches.length ? (
                            <Button
                              className="rv2-btn rv2-btnSecondary pbm-miniBtn"
                              type="button"
                              disabled={syncing}
                              onClick={resetDraw}>
                              <RotateCcw className="h-4 w-4" />
                              Reset draw
                            </Button>
                          ) : null}
                        </div>

                        <div className="pbm-teamList">
                          {state.teams.length ? (
                            state.teams.map((team, index) => (
                              <div className="pbm-teamRow" key={team.id}>
                                <span className="pbm-teamSeed">{index + 1}</span>
                                <span className="pbm-teamName">
                                  {teamName(team)}
                                  {team.groupId ? <small>{team.groupId.replace("-", " ")}</small> : null}
                                </span>
                                <Button
                                  className="pbm-iconBtn"
                                  variant="ghost"
                                  size="icon"
                                  type="button"
                                  disabled={scoresHaveStarted}
                                  onClick={() => removeTeam(team.id)}
                                  aria-label={`Remove ${teamName(team)}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="pbm-empty">No teams added yet.</div>
                          )}
                        </div>
                      </section>
                    </div>
                  </TabsContent>

                  <TabsContent value="draw" className="pbm-tabsContent">
                    <div className="pbm-grid">
                      <section className="pbm-panel">
                        <div className="pbm-panelHead">
                          <div>
                            <h2>Choose draw format</h2>
                            <p>Set this after adding teams, before tournament scoring begins.</p>
                          </div>
                        </div>

                        <div className="pbm-choiceGrid">
                          <button
                            type="button"
                            className={`pbm-choice ${drawConfig.mode === "all_play_all" ? "pbm-choiceActive" : ""}`}
                            onClick={() => setDrawConfig((current) => ({ ...current, mode: "all_play_all" }))}>
                            <strong>All play all</strong>
                            <span>Best for smaller draws where every team plays every other team.</span>
                          </button>
                          <button
                            type="button"
                            className={`pbm-choice ${drawConfig.mode === "groups" ? "pbm-choiceActive" : ""}`}
                            onClick={() => setDrawConfig((current) => ({ ...current, mode: "groups" }))}>
                            <strong>Groups + playoffs</strong>
                            <span>Create court groups, round robins, then knockout rounds.</span>
                          </button>
                        </div>

                        {drawConfig.mode === "groups" ? (
                          <div className="pbm-drawForm">
                            <div className="pbm-field">
                              <label htmlFor="group-count">Groups</label>
                              <Input
                                id="group-count"
                                className="rv2-input pbm-input"
                                type="number"
                                min="2"
                                value={drawConfig.groupCount}
                                onChange={(event) =>
                                  setDrawConfig((current) => ({
                                    ...current,
                                    groupCount: Math.max(2, Number(event.target.value) || 2),
                                  }))
                                }
                              />
                            </div>
                            <div className="pbm-field">
                              <label htmlFor="playoff-start">First playoff round</label>
                              <select
                                id="playoff-start"
                                className="rv2-input pbm-input pbm-select"
                                value={drawConfig.playoffStart}
                                onChange={(event) =>
                                  setDrawConfig((current) => ({
                                    ...current,
                                    playoffStart: event.target.value,
                                  }))
                                }>
                                {Object.keys(PLAYOFF_LABELS).map((key) => (
                                  <option key={key} value={key}>
                                    {PLAYOFF_LABELS[key]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="pbm-field">
                              <label htmlFor="direct-qualifiers">Top teams per group</label>
                              <Input
                                id="direct-qualifiers"
                                className="rv2-input pbm-input"
                                type="number"
                                min="1"
                                value={drawConfig.directQualifiers}
                                onChange={(event) =>
                                  setDrawConfig((current) => ({
                                    ...current,
                                    directQualifiers: Math.max(1, Number(event.target.value) || 1),
                                  }))
                                }
                              />
                            </div>
                            <div className="pbm-field">
                              <label htmlFor="wildcards">Wildcards</label>
                              <Input
                                id="wildcards"
                                className="rv2-input pbm-input"
                                type="number"
                                min="0"
                                value={drawConfig.wildcardCount}
                                onChange={(event) =>
                                  setDrawConfig((current) => ({
                                    ...current,
                                    wildcardCount: Math.max(0, Number(event.target.value) || 0),
                                  }))
                                }
                              />
                            </div>
                          </div>
                        ) : null}

                        <div className={drawError ? "pbm-warning" : "pbm-successLine"}>
                          {drawError ||
                            (drawConfig.mode === "groups" && drawConfig.playoffStart !== "none"
                              ? `${PLAYOFF_LABELS[drawConfig.playoffStart]} bracket will use ${PLAYOFF_SIZES[drawConfig.playoffStart]} qualifiers.`
                              : "Draw setup is ready.")}
                        </div>

                        <Button
                          className="rv2-btn rv2-btnPrimary pbm-actionBtn"
                          type="button"
                          disabled={syncing || Boolean(drawError)}
                          onClick={generateDraw}>
                          <RefreshCw className="h-4 w-4" />
                          Generate draw
                        </Button>
                      </section>

                      <section className="pbm-panel">
                        <div className="pbm-panelHead">
                          <div>
                            <h2>Current draw</h2>
                            <p>
                              {matches.length
                                ? `${matches.length} matches saved to Google Sheets.`
                                : "Generate a draw to create matches."}
                            </p>
                          </div>
                        </div>

                        <div className="pbm-rounds">
                          {roundGroups.length ? (
                            roundGroups.map((group) => (
                              <div className="pbm-round" key={group.key}>
                                <h3>{group.title}</h3>
                                <div className="pbm-matchList">
                                  {group.matches.map((match) => (
                                    <article className="pbm-matchCard" key={match.id}>
                                      <div className="pbm-matchMeta">
                                        {match.phase === "round_robin"
                                          ? `Court ${match.court}`
                                          : match.court
                                            ? `Court ${match.court}`
                                            : "Court TBD"}
                                      </div>
                                      <div className="pbm-matchTeams">
                                        <span>{match.teamALabel}</span>
                                        <strong>vs</strong>
                                        <span>{match.teamBLabel}</span>
                                      </div>
                                      <div className="pbm-matchFooter">
                                        <span>{match.status === "locked" ? "Locked" : "Open"}</span>
                                        <span>{match.phaseLabel}</span>
                                      </div>
                                    </article>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="pbm-empty">Your draw will appear here.</div>
                          )}
                        </div>
                      </section>
                    </div>
                  </TabsContent>

                  <TabsContent value="scores" className="pbm-tabsContent">
                    <div className="pbm-grid pbm-scoreGrid">
                      <section className="pbm-panel">
                        <div className="pbm-panelHead">
                          <div>
                            <h2>Referee score entry</h2>
                            <p>Submitted scores lock immediately for every referee.</p>
                          </div>
                          <div className="pbm-scoreTools">
                            <div className="pbm-field pbm-courtFilter">
                              <label htmlFor="court-filter">Court</label>
                              <select
                                id="court-filter"
                                className="rv2-input pbm-input pbm-select"
                                value={courtFilter}
                                onChange={(event) => setCourtFilter(event.target.value)}>
                                <option value="all">All courts</option>
                                {Array.from({ length: state.courts }, (_, index) => (
                                  <option key={index + 1} value={String(index + 1)}>
                                    Court {index + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Button
                              className="rv2-btn rv2-btnPrimary pbm-bulkSubmitBtn"
                              type="button"
                              disabled={syncing || !pendingScoreSubmissions.length}
                              onClick={submitAllScores}>
                              <Save className="h-4 w-4" />
                              {pendingScoreSubmissions.length
                                ? `Submit ${pendingScoreSubmissions.length} entered`
                                : "Submit all entered"}
                            </Button>
                          </div>
                        </div>

                        <div className="pbm-courtStack">
                          {scoreCourtGroups.length || playoffScoreMatches.length ? (
                            <>
                              {scoreCourtGroups.map((courtGroup) => {
                                const open = openCourtIds.includes(courtGroup.courtId);
                                const lockedCount = courtGroup.matches.filter((match) => match.status === "locked").length;
                                return (
                                  <section className="pbm-courtGroup" key={courtGroup.courtId}>
                                    <button
                                      className="pbm-courtToggle"
                                      type="button"
                                      aria-expanded={open}
                                      onClick={() => toggleCourt(courtGroup.courtId)}>
                                      <span>
                                        <strong>{courtGroup.title}</strong>
                                        <small>
                                          {lockedCount}/{courtGroup.matches.length} locked
                                        </small>
                                      </span>
                                      <ChevronDown className={`h-5 w-5 ${open ? "pbm-chevronOpen" : ""}`} />
                                    </button>

                                    {open ? (
                                      <div className="pbm-scoreList">
                                        {courtGroup.matches.map((match) => renderScoreRow(match))}
                                      </div>
                                    ) : null}
                                  </section>
                                );
                              })}

                              {playoffScoreMatches.length ? (
                                <section className="pbm-courtGroup pbm-playoffGroup">
                                  <div className="pbm-playoffHead">
                                    <strong>Playoffs</strong>
                                    <small>Assign a court only when that match is called.</small>
                                  </div>
                                  <div className="pbm-scoreList">
                                    {playoffScoreMatches.map((match) => renderScoreRow(match))}
                                  </div>
                                </section>
                              ) : null}
                            </>
                          ) : (
                            <div className="pbm-empty">Generate a draw to score matches.</div>
                          )}
                        </div>
                      </section>

                      <section className="pbm-panel">
                        <div className="pbm-panelHead">
                          <div>
                            <h2>Standings</h2>
                            <p>Updated from locked and submitted scores.</p>
                          </div>
                        </div>

                        {state.groups.length ? (
                          <div className="pbm-standingsStack">
                            {groupStandings.map(({ group, standings }) => (
                              <StandingsTable
                                key={group?.id || "all"}
                                title={group?.name || "All teams"}
                                standings={standings}
                              />
                            ))}
                            {state.format?.playoffStart !== "none" ? (
                              <div className="pbm-qualifiers">
                                <h3>Playoff qualifiers</h3>
                                {groupStageComplete({ ...state, matches }) ? (
                                  qualifiers.map((row) => (
                                    <div className="pbm-teamRow" key={row.teamId}>
                                      <span className="pbm-teamSeed">{row.seed}</span>
                                      <span className="pbm-teamName">
                                        {row.name}
                                        <small>{row.wildcard ? "Wildcard" : row.groupName}</small>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="pbm-empty">Qualifiers appear after group matches are complete.</div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <StandingsTable title="All teams" standings={allStandings} />
                        )}
                      </section>
                    </div>
                  </TabsContent>

                  <TabsContent value="export" className="pbm-tabsContent">
                    <section className="pbm-panel pbm-exportPanel">
                      <div className="pbm-panelHead">
                        <div>
                          <h2>Download score sheet</h2>
                          <p>Google Sheets remains the live source. Downloads are for end-of-tournament sharing.</p>
                        </div>
                        <Save className="h-5 w-5" />
                      </div>

                      <div className="pbm-exportGrid">
                        {state.sheetUrl ? (
                          <button
                            className="pbm-exportTile"
                            type="button"
                            onClick={() => window.open(state.sheetUrl, "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="h-6 w-6" />
                            <span>Open Google Sheet</span>
                            <small>Live sheet stored in the tournament Drive account.</small>
                          </button>
                        ) : null}

                        <button className="pbm-exportTile" type="button" onClick={downloadPdf}>
                          <FileText className="h-6 w-6" />
                          <span>Download PDF</span>
                          <small>Share a finished score sheet.</small>
                        </button>

                        <button className="pbm-exportTile" type="button" onClick={downloadCsv}>
                          <Download className="h-6 w-6" />
                          <span>Download CSV</span>
                          <small>Open scores in Sheets or Excel.</small>
                        </button>
                      </div>
                    </section>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StandingsTable({ title, standings }) {
  return (
    <div className="pbm-standingsBlock">
      <h3>{title}</h3>
      <Table className="pbm-table">
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>P</TableHead>
            <TableHead>W</TableHead>
            <TableHead>L</TableHead>
            <TableHead>Diff</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.length ? (
            standings.map((row, index) => (
              <TableRow key={row.teamId}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.played}</TableCell>
                <TableCell>{row.wins}</TableCell>
                <TableCell>{row.losses}</TableCell>
                <TableCell>{row.diff}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6}>No standings yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ScoreTeamSlot({ auto, disabled, field, match, onChange, teams, value }) {
  if (disabled) {
    return (
      <div className={`pbm-scoreTeam ${auto ? "pbm-scoreTeamAuto" : ""}`}>
        {field === "teamAId" ? match.teamALabel : match.teamBLabel}
        {auto ? <small>Auto qualifier</small> : null}
      </div>
    );
  }

  const label = field === "teamAId" ? match.teamALabel : match.teamBLabel;

  return (
    <label className="pbm-playoffSlot">
      <span>{auto ? "Auto qualifier" : "Manual team"}</span>
      <select
        className={`rv2-input pbm-input pbm-select pbm-playoffSelect ${auto ? "pbm-playoffSelectAuto" : ""}`}
        value={value}
        onChange={(event) => onChange(match, field, event.target.value)}>
        <option value="">Auto: {label}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {teamName(team)}
          </option>
        ))}
      </select>
    </label>
  );
}
