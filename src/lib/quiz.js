import { IDS } from "@/app/court/Court";
import { beatEndPositions, beatStartPositions, LINE_TOOLS } from "@/lib/playModel";
import { BEAT_DURATION_MS, BEAT_HOLD_MS } from "@/lib/playback";
import {
  actionAnswer,
  actionDistractorPool,
  balancedMcOptions,
  ballHandoffStem,
  ballHolderAnswer,
  ballHolderStem,
  ballPassStem,
  ballSituation,
  buildSafeContext,
  contrastiveFeedback,
  drawStem,
  drawSubText,
  handoffLookAnswer,
  passDistractorPool,
  passLookAnswer,
  readOptionsFromBreakdown,
  readStem,
  roleErrorFromBreakdown,
  roleJobFromBreakdown,
  roleKeysFromBreakdown,
  roleKeysStem,
  intentStem,
  advantageStem,
  beatPurposeStem,
  spacingStem,
  progressionStem,
  breakdownWrongPool,
  spotStem,
  spotSubText,
  watchStem,
  youAre,
} from "@/lib/quizVoice";

export const POS_NAME = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };

export const SPOT_TOLERANCE = 80;
export const DRAW_END_TOLERANCE = 72;

/** Quiz watch playback — lower = slower (easier to follow). */
export const QUIZ_WATCH_SPEED = 0.65;
export const QUIZ_FULL_PLAY_SPEED = 0.55;

export const QUIZ_CATEGORIES = {
  spot: {
    id: "spot",
    label: "Find your spot",
    short: "Spot",
    hint: "Your marker is hidden — tap where you belong.",
  },
  draw: {
    id: "draw",
    label: "Draw the action",
    short: "Draw",
    hint: "Pick an action and draw your path.",
  },
  watch: {
    id: "watch",
    label: "Watch & decide",
    short: "Watch",
    hint: "See the play run, then answer.",
  },
  ball: {
    id: "ball",
    label: "Ball movement",
    short: "Ball",
    hint: "Pass, handoff, or who has the ball.",
  },
  coach: {
    id: "coach",
    label: "Coach's notes",
    short: "Coach",
    hint: "From the play breakdown your coach wrote.",
  },
  read: {
    id: "read",
    label: "The read",
    short: "Read",
    hint: "What to do when the defense adjusts.",
  },
};

export const CATEGORY_ORDER = ["spot", "draw", "watch", "ball", "coach", "read"];

function dist(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function shuffle(arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mcOptions(correct, pool, count = 4) {
  return balancedMcOptions(correct, pool, count, shuffle);
}

export function formatMcOptions(correct, pool, count = 4) {
  return mcOptions(correct, pool, count);
}

function playerOption(id) {
  return `#${id} (${POS_NAME[id]})`;
}

function watchAnswerForPlayer(prev, cur, myId, beatActions) {
  return actionAnswer(prev, cur, myId, beatActions, playerMovedOnBeat);
}

function watchMcOptions(correct, prev, cur, myId, beatActions, frames, playName) {
  return mcOptions(
    correct,
    actionDistractorPool(prev, cur, myId, beatActions, playerMovedOnBeat, frames, playName),
    4
  );
}

function passMcOptions(correct, prev, cur, myId, beatActions, passerId) {
  return mcOptions(correct, passDistractorPool(prev, cur, myId, beatActions, passerId, playerMovedOnBeat), 4);
}

/** Plain-language recap — others only (spoiler-safe by default). */
function beatContextPlain(prev, cur, myId, beatActions) {
  return buildSafeContext(prev, cur, myId, beatActions ?? inferBeatActions(prev, cur));
}

function actionMatches(a, filter) {
  if (!filter) return false;
  if (filter.type != null && a.type !== filter.type) return false;
  if (filter.by != null && String(a.by) !== String(filter.by)) return false;
  if (filter.for != null && String(a.for) !== String(filter.for)) return false;
  return true;
}

function filteredActions(beatActions, excludeActions) {
  return beatActions.filter((a) => !excludeActions.some((f) => actionMatches(a, f)));
}

function priorBeatContext(frames, beatIdx, myId) {
  if (beatIdx < 2) return null;
  return beatContextPlain(frames[beatIdx - 2], frames[beatIdx - 1], myId);
}

function roleQuestionContext(frames, beatIdx, prev, cur, myId, beatActions) {
  const prior = priorBeatContext(frames, beatIdx, myId);
  return buildSafeContext(prev, cur, myId, beatActions, { priorContext: prior });
}

function ballPassContext(frames, beatIdx, prev, cur, myId, action, beatActions) {
  const filtered = filteredActions(beatActions, [
    { type: action.type, by: action.by, for: action.for },
  ]);
  return (
    buildSafeContext(prev, cur, myId, filtered, {
      priorContext: priorBeatContext(frames, beatIdx, myId),
    }) || `${youAre(myId)} ${ballSituation(prev, myId)} Read the floor.`.trim()
  );
}

function ballHolderContext(frames, beatIdx, prev, cur, myId, beatActions) {
  const filtered = filteredActions(beatActions, [{ type: "pass" }, { type: "handoff" }]);
  return (
    buildSafeContext(prev, cur, myId, filtered, {
      priorContext: priorBeatContext(frames, beatIdx, myId),
      hideBall: true,
    }) || "Track the ball on the court."
  );
}

function attachFeedback(q, playName) {
  if (q.kind === "spot" || q.kind === "draw") return q;
  if (typeof q.correct !== "string") return q;
  return {
    ...q,
    feedbackWrong: (guess) => {
      if (typeof guess !== "string") return null;
      return contrastiveFeedback({
        playName,
        guess,
        correct: q.correct,
        altPlay: q.altPlay,
      });
    },
  };
}

function coin(p = 0.5) {
  return Math.random() < p;
}

function inferBeatActions(prev, cur) {
  const explicit = cur.actions ?? [];
  if (explicit.length) return explicit;

  const inferred = [];
  if (cur.ball && prev.ball && cur.ball !== prev.ball) {
    inferred.push({ type: "pass", by: prev.ball, for: cur.ball });
  }
  for (const cutter of IDS) {
    if (!playerMovedOnBeat(prev, cur, cutter, 40)) continue;
    for (const screener of IDS) {
      if (screener === cutter) continue;
      if (playerMovedOnBeat(prev, cur, screener, 28)) continue;
      const endS = beatEndPositions(prev, cur)[screener];
      const startC = beatStartPositions(prev, cur)[cutter];
      if (endS && startC && dist(endS, startC) < 55) {
        inferred.push({ type: "screen", by: screener, for: cutter });
      }
    }
  }
  return inferred;
}

function beatSummary(prev, cur) {
  const parts = [];
  for (const a of inferBeatActions(prev, cur)) {
    if (a.type === "pass") parts.push(`#${a.by} passes to #${a.for}`);
    if (a.type === "handoff") parts.push(`#${a.by} hands off to #${a.for}`);
    if (a.type === "screen") parts.push(`#${a.by} sets a screen for #${a.for}`);
    if (a.type === "cut") parts.push(`#${a.by} cuts`);
    if (a.type === "dribble") parts.push(`#${a.by} dribbles`);
  }
  for (const id of IDS) {
    if (playerMovedOnBeat(prev, cur, id)) {
      const tagged = inferBeatActions(prev, cur).some((a) => a.by === id || a.for === id);
      if (!tagged) parts.push(`#${id} (${POS_NAME[id]}) moves`);
    }
  }
  if (cur.ball !== prev.ball && !parts.some((p) => p.includes("pass") || p.includes("hand"))) {
    parts.push(`Ball ends with #${cur.ball}`);
  }
  return parts.length ? parts.join(". ") : null;
}

function actionLabel(type) {
  return LINE_TOOLS.find((t) => t.id === type)?.label ?? type;
}

function expectedDrawForPlayer(prev, cur, myId, beatActions) {
  const mine = beatActions.find((a) => a.by === myId);
  if (mine) return mine;
  const pass = beatActions.find((a) => a.type === "pass" && a.by === myId);
  if (pass) return pass;
  if (playerMovedOnBeat(prev, cur, myId)) {
    return { type: "cut", by: myId };
  }
  return null;
}

const FALLBACK_READS = [
  { trigger: "Defense switches the screen", answer: "Hit the roll man or skip to the corner" },
  { trigger: "Help rotates early on the drive", answer: "Kick out to the open shooter" },
  { trigger: "They go under the screen", answer: "Pull up or reject and re-screen" },
  { trigger: "Defender denies the first pass", answer: "Backdoor cut or dribble handoff" },
];

const GENERIC_COACH_WRONG = [
  "Get a quick two in transition",
  "Hold for the last shot",
  "Force a turnover with a trap",
  "Post up and isolate on the block",
  "Run clock and reset at 10",
];

function readsForPlay(play) {
  const bd = play.breakdown;
  if (bd?.reads?.length) {
    return bd.reads.map((r) => ({
      trigger: r.situation ?? r.trigger ?? "Defense adjusts",
      answer: r.progression?.[0] ?? r.trigger ?? "",
      response: r.progression?.[0] ?? r.trigger ?? "",
      progression: r.progression ?? [],
      playerId: r.playerId,
      beatId: r.beatId,
    }));
  }
  if (bd?.counters?.length) {
    return bd.counters.map((c) => ({
      trigger: c.trigger,
      answer: c.response ?? c.answer,
      response: c.response ?? c.answer,
    }));
  }
  if (play.counters?.length) return play.counters;
  const seeded = play.name.length % FALLBACK_READS.length;
  return [FALLBACK_READS[seeded], FALLBACK_READS[(seeded + 1) % FALLBACK_READS.length]];
}

function appendBreakdownQuestions(buckets, play, myId, F) {
  const bd = play.breakdown;
  if (!bd || play.breakdownStale) return;

  const wrongPool = (correct, extra = []) =>
    [...breakdownWrongPool(play, correct), ...GENERIC_COACH_WRONG, ...extra].filter(
      (x) => x && x !== correct
    );

  if (bd.intent?.trim()) {
    const correct = bd.intent.trim();
    const q = {
      kind: "mc",
      category: "coach",
      prompt: intentStem(play.name),
      sub: "From the play breakdown — know what we're hunting.",
      correct,
      options: mcOptions(correct, wrongPool(correct), 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    };
    buckets.coach.push(attachFeedback(q, play.name));
  }

  if (bd.advantage?.trim()) {
    const correct = bd.advantage.trim();
    const q = {
      kind: "mc",
      category: "coach",
      prompt: advantageStem(play.name),
      sub: "How this set creates the look.",
      correct,
      options: mcOptions(correct, wrongPool(correct), 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    };
    buckets.coach.push(attachFeedback(q, play.name));
  }

  if (bd.beatPurposes && typeof bd.beatPurposes === "object") {
    for (const frame of F) {
      const purpose = bd.beatPurposes[frame.id]?.trim();
      if (!purpose) continue;
      const others = Object.entries(bd.beatPurposes)
        .filter(([id, p]) => id !== frame.id && p?.trim())
        .map(([, p]) => p.trim());
      const q = {
        kind: "mc",
        category: "coach",
        frameIdx: F.indexOf(frame),
        prompt: beatPurposeStem(play.name, frame.id),
        sub: "Why this beat exists in the sequence.",
        correct: purpose,
        options: mcOptions(purpose, [...others, ...GENERIC_COACH_WRONG], 4),
        from: F[Math.max(0, F.indexOf(frame) - 1)] ?? F[0],
        showFrame: F[Math.max(0, F.indexOf(frame) - 1)] ?? F[0],
        introMode: "static",
      };
      buckets.coach.push(attachFeedback(q, play.name));
    }
  }

  const roleKeys = roleKeysFromBreakdown(play, myId);
  if (roleKeys) {
    const keyPool = [];
    for (const id of IDS) {
      if (id === myId) continue;
      const k = roleKeysFromBreakdown(play, id);
      if (k) keyPool.push(k);
      const j = roleJobFromBreakdown(play, id);
      if (j) keyPool.push(j);
    }
    const q = {
      kind: "mc",
      category: "coach",
      prompt: roleKeysStem(myId),
      sub: "Your keys from the breakdown.",
      correct: roleKeys,
      options: mcOptions(roleKeys, [...keyPool, ...GENERIC_COACH_WRONG], 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    };
    buckets.coach.push(attachFeedback(q, play.name));
  }

  if (bd.spacingRules?.length >= 2) {
    const correct = bd.spacingRules[0].trim();
    const wrong = bd.spacingRules.slice(1).map((s) => s.trim()).filter(Boolean);
    const q = {
      kind: "mc",
      category: "coach",
      prompt: spacingStem(play.name),
      sub: "Spacing keeps the read alive.",
      correct,
      options: mcOptions(correct, [...wrong, ...GENERIC_COACH_WRONG], 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    };
    buckets.coach.push(attachFeedback(q, play.name));
  }

  if (bd.reads?.length) {
    for (const r of bd.reads) {
      const prog = r.progression?.filter(Boolean) ?? [];
      if (prog.length < 2) continue;
      const correct = prog[1];
      const wrong = [
        ...prog.filter((p) => p !== correct),
        ...breakdownWrongPool(play, correct),
      ];
      const q = {
        kind: "mc",
        category: "read",
        prompt: progressionStem(play.name, r.situation ?? r.trigger),
        sub: "First look is gone — what's next?",
        correct,
        options: mcOptions(correct, wrong, 4),
        from: F[0],
        showFrame: F[0],
        introMode: "static",
      };
      buckets.read.push(attachFeedback(q, play.name));
    }
  }
}

export function questionIdFor(q) {
  return `${q.category}|${q.kind}|${q.frameIdx ?? "c"}|${q.player ?? ""}|${q.playName ?? ""}|${q.prompt?.slice(0, 48)}`;
}

function questionKey(q) {
  return questionIdFor(q);
}

function withIntro(q, beatIdx) {
  const introMode = q.kind === "watch" ? "watch" : coin(0.42) ? "watch" : "static";
  return {
    ...q,
    introMode,
    watchStopBeat: introMode === "watch" ? Math.max(0, beatIdx - 1) : undefined,
  };
}

/** Avoid back-to-back same category or same beat */
function spreadDeck(cards) {
  const out = [...cards];
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 1; i < out.length; i++) {
      const sameCat = out[i].category === out[i - 1].category;
      const sameBeat = out[i].frameIdx != null && out[i].frameIdx === out[i - 1].frameIdx;
      if (!sameCat && !sameBeat) continue;
      for (let j = i + 1; j < out.length; j++) {
        if (out[j].category !== out[i - 1].category && out[j].frameIdx !== out[i - 1].frameIdx) {
          [out[i], out[j]] = [out[j], out[i]];
          break;
        }
      }
    }
  }
  return out;
}

export function movementTarget(prevFrame, frame, playerId) {
  return beatEndPositions(prevFrame, frame)[playerId];
}

export function playerMovedOnBeat(prevFrame, frame, playerId, threshold = 22) {
  const start = beatStartPositions(prevFrame, frame);
  const end = beatEndPositions(prevFrame, frame);
  if (!start[playerId] || !end[playerId]) return false;
  return dist(start[playerId], end[playerId]) > threshold;
}

export function scoreSpot(guess, target, tolerance = SPOT_TOLERANCE) {
  if (!guess || !target) return false;
  return dist(guess, target) <= tolerance;
}

export function scoreDrawAnswer(guess, question) {
  if (!guess?.points?.length || guess.points.length < 2) return false;
  const end = guess.points[guess.points.length - 1];
  if (!scoreSpot(end, question.target, DRAW_END_TOLERANCE)) return false;

  const expected = question.expectedTool;
  const tool = guess.tool;
  if (!expected) return true;

  const moveTypes = new Set(["cut", "dribble"]);
  if (moveTypes.has(expected) && moveTypes.has(tool)) return true;
  if ((expected === "pass" || expected === "handoff") && (tool === "pass" || tool === "handoff")) {
    return true;
  }
  return tool === expected;
}

export function collectQuestionsByCategory(play, myId) {
  const buckets = {
    spot: [],
    draw: [],
    watch: [],
    ball: [],
    coach: [],
    read: [],
  };
  const F = play.frames;
  const playName = play.name;
  const allBeatNotes = F.map((f) => f.note?.trim()).filter(Boolean);

  for (let i = 1; i < F.length; i++) {
    const prev = F[i - 1];
    const cur = F[i];
    const beatActions = inferBeatActions(prev, cur);
    const roleContext = roleQuestionContext(F, i, prev, cur, myId, beatActions);
    const start = beatStartPositions(prev, cur);
    const target = movementTarget(prev, cur, myId);
    const exp = expectedDrawForPlayer(prev, cur, myId, beatActions);
    const coachNote = cur.note?.trim();

    if (playerMovedOnBeat(prev, cur, myId) && target) {
      const spotQ = {
        kind: "spot",
        category: "spot",
        player: myId,
        frameIdx: i,
        prompt: spotStem(playName, myId),
        sub: spotSubText(roleContext),
        target,
        showFrame: prev,
        from: prev,
      };
      buckets.spot.push(withIntro(attachFeedback(spotQ, playName), i));
    }

    if (exp && target && start[myId]) {
      const tool =
        exp.type === "dribble"
          ? "dribble"
          : exp.type === "pass"
            ? "pass"
            : exp.type === "handoff"
              ? "handoff"
              : exp.type === "screen"
                ? "screen"
                : "cut";
      const drawTarget =
        exp.type === "pass" || exp.type === "handoff" ? cur.pos[exp.for] ?? target : target;
      const introMode = coin(0.42) ? "watch" : "static";
      const drawQ = {
        kind: "draw",
        category: "draw",
        player: myId,
        frameIdx: i,
        introMode,
        watchStopBeat: introMode === "watch" ? i - 1 : undefined,
        prompt: drawStem(playName, myId),
        sub:
          introMode === "watch"
            ? drawSubText(roleContext)
            : drawSubText(roleContext),
        expectedTool: tool,
        allowedTools:
          tool === "cut" || tool === "dribble"
            ? ["cut", "dribble"]
            : tool === "pass" || tool === "handoff"
              ? ["pass", "handoff"]
              : [tool],
        target: drawTarget,
        pathStart: start[myId],
        showFrame: prev,
        from: prev,
      };
      buckets.draw.push(attachFeedback(drawQ, playName));
    }

    const watchAnswer = watchAnswerForPlayer(prev, cur, myId, beatActions);
    if (watchAnswer && playerMovedOnBeat(prev, cur, myId)) {
      const watchQ = {
        kind: "watch",
        category: "watch",
        player: myId,
        frameIdx: i,
        introMode: "watch",
        watchStopBeat: i - 1,
        prompt: watchStem(playName, myId),
        sub: roleContext || "Watch what ran — then pick your move.",
        correct: watchAnswer,
        options: watchMcOptions(watchAnswer, prev, cur, myId, beatActions, F, playName),
        from: prev,
        showFrame: prev,
      };
      buckets.watch.push(attachFeedback(watchQ, playName));
    }

    // Coach beat notes (from AI import or manual review)
    if (coachNote && allBeatNotes.length >= 2) {
      const coachQ = {
        kind: "mc",
        category: "coach",
        frameIdx: i,
        prompt: `Running ${playName}. What happens on this beat?`,
        sub: beatContextPlain(prev, cur, myId, beatActions) || "Pick the coach's line.",
        correct: coachNote,
        options: mcOptions(coachNote, allBeatNotes.filter((n) => n !== coachNote), 4),
        from: prev,
        showFrame: prev,
      };
      buckets.coach.push(withIntro(attachFeedback(coachQ, playName), i));
    }

    beatActions.forEach((a) => {
      if (a.type === "pass" && String(a.by) === String(myId)) {
        const introMode = coin(0.35) ? "watch" : "static";
        const correct = passLookAnswer(a.for, prev, cur, beatActions);
        const passQ = {
          kind: "mc",
          category: "ball",
          frameIdx: i,
          introMode,
          watchStopBeat: introMode === "watch" ? i - 1 : undefined,
          prompt: ballPassStem(playName, myId, prev, cur, true),
          sub: ballPassContext(F, i, prev, cur, myId, a, beatActions),
          correct,
          options: passMcOptions(correct, prev, cur, myId, beatActions, a.by),
          from: prev,
          showFrame: prev,
        };
        buckets.ball.push(attachFeedback(passQ, playName));
      }
      if (a.type === "handoff" && String(a.by) === String(myId)) {
        const correct = handoffLookAnswer(a.for);
        const handQ = {
          kind: "mc",
          category: "ball",
          frameIdx: i,
          prompt: ballHandoffStem(playName, myId, prev, true),
          sub: ballPassContext(F, i, prev, cur, myId, a, beatActions),
          correct,
          options: passMcOptions(correct, prev, cur, myId, beatActions, a.by),
          from: prev,
          showFrame: prev,
          introMode: "static",
        };
        buckets.ball.push(attachFeedback(handQ, playName));
      }
    });

    if (cur.ball !== prev.ball) {
      const hasPassQ = beatActions.some(
        (a) => (a.type === "pass" || a.type === "handoff") && String(a.by) === String(myId)
      );
      if (!hasPassQ) {
        const correct = ballHolderAnswer(cur.ball, myId);
        const holderQ = {
          kind: "mc",
          category: "ball",
          frameIdx: i,
          prompt: ballHolderStem(playName, myId, prev),
          sub: ballHolderContext(F, i, prev, cur, myId, beatActions),
          correct,
          options: mcOptions(correct, IDS.map((id) => ballHolderAnswer(id, myId)), 4),
          from: prev,
          showFrame: prev,
          introMode: "static",
        };
        buckets.ball.push(attachFeedback(holderQ, playName));
      }
    }
  }

  const roleJob = roleJobFromBreakdown(play, myId);
  if (roleJob) {
    const roleErr = roleErrorFromBreakdown(play, myId);
    const rolePool = [];
    for (const id of IDS) {
      if (id === myId) continue;
      const j = roleJobFromBreakdown(play, id);
      if (j) rolePool.push(j);
      const e = roleErrorFromBreakdown(play, id);
      if (e) rolePool.push(e);
    }
    if (roleErr) rolePool.push(roleErr);
    const roleQ = {
      kind: "mc",
      category: "coach",
      prompt: `Running ${play.name}. ${youAre(myId)} What's your job?`,
      sub: "Know your responsibility before the details.",
      correct: roleJob,
      options: mcOptions(roleJob, rolePool.length ? rolePool : [roleErr].filter(Boolean), 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    };
    buckets.coach.push(attachFeedback(roleQ, play.name));
  }

  // Play purpose (coach review screen) — skip if breakdown intent already covers it
  if (play.purpose?.trim() && !play.breakdown?.intent?.trim()) {
    const wrong = [
      "Get a quick two in transition",
      "Hold for the last shot",
      "Force a turnover with a trap",
      play.summary?.slice(0, 80),
    ].filter(Boolean);
    buckets.coach.push({
      kind: "mc",
      category: "coach",
      prompt: `What's the main idea of ${play.name}?`,
      sub: "From your coach's play review.",
      correct: play.purpose.trim(),
      options: mcOptions(play.purpose.trim(), wrong, 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    });
  }

  // Summary snippet as coach context
  if (play.summary?.trim() && play.summary.length > 20) {
    const snippets = allBeatNotes.length ? allBeatNotes : [beatSummary(F[0], F[1])].filter(Boolean);
    if (snippets.length >= 2) {
      buckets.coach.push({
        kind: "mc",
        category: "coach",
        frameIdx: 1,
        prompt: `Which best describes the start of "${play.name}"?`,
        sub: "Coach's overview of the play.",
        correct: snippets[0],
        options: mcOptions(snippets[0], snippets.slice(1), 4),
        from: F[0],
        showFrame: F[0],
        introMode: coin(0.4) ? "watch" : "static",
        watchStopBeat: 0,
      });
    }
  }

  appendBreakdownQuestions(buckets, play, myId, F);

  readsForPlay(play).forEach((c) => {
    const trigger = c.trigger;
    const answer = c.response ?? c.answer;
    const wrongFromBd = readOptionsFromBreakdown(play, answer);
    const wrong =
      wrongFromBd.length >= 2
        ? wrongFromBd
        : readsForPlay(play)
            .filter((x) => x !== c)
            .map((x) => x.response ?? x.answer);
    const readQ = {
      kind: "mc",
      category: "read",
      frameIdx: F.length > 1 ? 1 : null,
      prompt: readStem(play.name, trigger),
      sub: "Situation only — pick the read.",
      correct: answer,
      options: mcOptions(answer, wrong, 4),
      from: F[0],
      showFrame: F[0],
      introMode: "static",
    };
    buckets.read.push(attachFeedback(readQ, play.name));
  });

  return buckets;
}

/** One of spot / draw / watch per beat — keeps sessions from feeling repetitive */
function pickRoleVariants(buckets, myId) {
  const byBeat = new Map();
  for (const cat of ["spot", "draw", "watch"]) {
    for (const q of buckets[cat]) {
      if (q.player !== myId) continue;
      const idx = q.frameIdx;
      if (!byBeat.has(idx)) byBeat.set(idx, []);
      byBeat.get(idx).push(q);
    }
  }
  const picked = [];
  for (const variants of byBeat.values()) {
    picked.push(pickOne(shuffle(variants)));
  }
  return picked;
}

export function generateFlashcardDeck(play, myId = "1", opts = {}) {
  const { maxCards = 10 } = opts;
  const buckets = collectQuestionsByCategory(play, myId);
  const used = new Set();

  const finalize = (q) => {
    const key = questionKey(q);
    if (used.has(key)) return null;
    used.add(key);
    return { ...q, id: key, categoryMeta: QUIZ_CATEGORIES[q.category] };
  };

  const pool = [];

  // Role questions — max one per beat, mixed format
  for (const q of shuffle(pickRoleVariants(buckets, myId))) {
    const card = finalize(q);
    if (card) pool.push(card);
  }

  // Coach + ball — shuffled in
  for (const cat of shuffle(["coach", "ball", "read"])) {
    for (const q of shuffle(buckets[cat])) {
      const card = finalize(q);
      if (card) pool.push(card);
    }
  }

  let deck = spreadDeck(shuffle(pool));

  // Top up if thin
  if (deck.length < maxCards) {
    for (const cat of shuffle(CATEGORY_ORDER)) {
      for (const q of shuffle(buckets[cat])) {
        if (deck.length >= maxCards) break;
        const card = finalize(q);
        if (card && !deck.some((d) => d.id === card.id)) deck.push(card);
      }
    }
    deck = spreadDeck(shuffle(deck));
  }

  deck = deck.slice(0, maxCards);

  return {
    deck,
    buckets,
    available: CATEGORY_ORDER.filter((c) => buckets[c].length > 0),
    missing: CATEGORY_ORDER.filter((c) => buckets[c].length === 0),
  };
}

export function generateQuestions(play, myId = "1", opts = {}) {
  const { maxQuestions = 8 } = opts;
  return generateFlashcardDeck(play, myId, { maxCards: maxQuestions }).deck;
}

export function summarizeSession(results, categories = QUIZ_CATEGORIES) {
  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  const byCategory = {};
  const order = Object.keys(categories);
  for (const cat of order) {
    const catResults = results.filter((r) => r.category === cat);
    byCategory[cat] = {
      total: catResults.length,
      correct: catResults.filter((r) => r.correct).length,
    };
  }
  return { total, correct, byCategory };
}

export function getCategoryLabel(category) {
  return QUIZ_CATEGORIES[category]?.label ?? category;
}

export function needsWatchIntro(q) {
  if (q?.watchFullPlay) return true;
  if (!q || q.introMode !== "watch") return false;
  return q.kind === "watch" || q.kind === "spot" || q.kind === "draw" || q.kind === "mc";
}

export function watchPlaybackTargetMs(frames, watchStopBeat, speed = 1) {
  const hold = BEAT_HOLD_MS / speed;
  const trans = BEAT_DURATION_MS / speed;
  const idx = Math.max(0, Math.min(watchStopBeat, frames.length - 1));
  if (idx === 0) return hold * 0.92;
  return idx * (hold + trans) + hold * 0.92;
}
