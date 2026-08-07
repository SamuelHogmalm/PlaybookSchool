/**
 * Pre-flight animation checks for review UI — mirrors services/importer/animation_validate.py
 */

const MIN_PASS_PX = 20;
const VALID_TYPES = new Set(["screen", "cut", "dribble", "pass", "handoff"]);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function playerMoved(prevPos, curPos, pid, threshold = 22) {
  const a = prevPos?.[pid];
  const b = curPos?.[pid];
  if (!a || !b) return false;
  return dist(a, b) > threshold;
}

/** @returns {{ ok: boolean, issues: Array<{ code, severity, message, fix }> }} */
export function validateBeatAnimation(prevFrame, frame, beatIdx = 0) {
  const issues = [];
  if (!frame || beatIdx === 0) return { ok: true, issues };

  const actions = frame.actions ?? [];
  const pos = frame.pos ?? {};
  const ball = frame.ball != null ? String(frame.ball) : "";
  const prevBall = prevFrame?.ball != null ? String(prevFrame.ball) : "";
  const prevPos = prevFrame?.pos ?? {};

  if (prevBall && ball && prevBall !== ball) {
    const hasTransfer = actions.some(
      (a) =>
        (a.type === "pass" || a.type === "handoff") &&
        String(a.by) === prevBall &&
        String(a.for) === ball,
    );
    if (!hasTransfer) {
      issues.push({
        code: "ball_change_no_pass",
        severity: "error",
        message: `Ball moves ${prevBall}→${ball} with no pass/handoff from ${prevBall}.`,
        fix: "Add a pass or handoff, or fix the ball handler on this beat.",
      });
    }
  }

  let carrier = prevBall || ball;
  for (const a of actions) {
    const by = a.by != null ? String(a.by) : "";
    const fo = a.for != null ? String(a.for) : "";
    if (!VALID_TYPES.has(a.type)) {
      issues.push({
        code: "invalid_action_type",
        severity: "warn",
        message: `Unknown action type “${a.type}”.`,
        fix: "Use cut, screen, dribble, pass, or handoff.",
      });
      continue;
    }
    if (a.type === "pass" || a.type === "handoff") {
      if (by !== carrier) {
        issues.push({
          code: "pass_wrong_passer",
          severity: "error",
          message: `Pass from ${by} but ${carrier} has the ball at beat start.`,
          fix: `Set passer to ${carrier} or fix ball on the previous beat.`,
        });
      }
      const from = pos[by];
      const to = pos[fo];
      if (from && to && dist(from, to) < MIN_PASS_PX) {
        issues.push({
          code: "pass_too_short",
          severity: "warn",
          message: `Pass ${by}→${fo} is very short — may not animate.`,
          fix: "Check positions or merge beats.",
        });
      }
      if (fo) carrier = fo;
    } else if (a.type === "dribble" && by) {
      carrier = by;
    }
  }

  const passers = actions.filter((a) => a.type === "pass" || a.type === "handoff").map((a) => String(a.by));
  if (passers.length !== new Set(passers).size) {
    issues.push({
      code: "duplicate_pass_reads",
      severity: "error",
      message: "Multiple passes from the same player (diagram reads, not one animation).",
      fix: "Keep one pass per passer — delete read options.",
    });
  }

  const movers = [];
  for (const pid of ["1", "2", "3", "4", "5"]) {
    if (playerMoved(prevPos, pos, pid) && !actions.some((a) => String(a.by) === pid)) {
      movers.push(pid);
    }
  }
  if (movers.length && actions.length) {
    issues.push({
      code: "moved_without_action",
      severity: "warn",
      message: `Player(s) ${movers.join(", ")} moved but have no drawn action.`,
      fix: "Add a cut/dribble for each mover, or drag spots to match the prior beat.",
    });
  }

  if (actions.length > 1 && !actions.some((a) => a.order != null)) {
    issues.push({
      code: "missing_action_order",
      severity: "warn",
      message: "Multiple actions but no sequence order — animation may look wrong.",
      fix: "Use timing rows in the editor to set step order (dribble→pass→screen→cut).",
    });
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    issues,
  };
}

export function validatePlayAnimation(frames) {
  const beats = (frames ?? []).map((frame, beatIdx) => ({
    beatIdx,
    frameId: frame.id,
    ...validateBeatAnimation(beatIdx > 0 ? frames[beatIdx - 1] : null, frame, beatIdx),
  }));
  const errorCount = beats.reduce(
    (n, b) => n + b.issues.filter((i) => i.severity === "error").length,
    0,
  );
  const warnCount = beats.reduce(
    (n, b) => n + b.issues.filter((i) => i.severity === "warn").length,
    0,
  );
  return {
    beats,
    errorCount,
    warnCount,
    hasErrors: errorCount > 0,
    animationReady: errorCount === 0,
  };
}

export function animationIssueSummary(validation) {
  if (!validation?.beats?.length) return null;
  if (validation.errorCount === 0 && validation.warnCount === 0) {
    return "Animation-ready — sequential playback should run cleanly.";
  }
  const parts = [];
  if (validation.errorCount) parts.push(`${validation.errorCount} error(s)`);
  if (validation.warnCount) parts.push(`${validation.warnCount} warning(s)`);
  return `Fix before saving: ${parts.join(", ")}`;
}
