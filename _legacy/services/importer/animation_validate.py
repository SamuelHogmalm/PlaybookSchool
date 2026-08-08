"""Post-interpret checks — flag beats the sequential animator cannot play cleanly."""

from __future__ import annotations

import math
from typing import Any

MIN_ROUTE_PX = 18
MIN_PASS_PX = 20
VALID_TYPES = {"screen", "cut", "dribble", "pass", "handoff"}
TYPE_ORDER = {"dribble": 1, "pass": 2, "handoff": 2, "screen": 3, "cut": 4}


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _player_moved(prev_pos: dict, cur_pos: dict, pid: str, threshold: float = 22) -> bool:
    a, b = prev_pos.get(pid), cur_pos.get(pid)
    if not a or not b:
        return False
    return _dist(a, b) > threshold


def validate_beat_animation(
    prev: dict[str, Any] | None,
    beat: dict[str, Any],
    *,
    beat_index: int = 0,
) -> list[dict[str, str]]:
    """Return animation issues for coach review. severity: error | warn."""
    issues: list[dict[str, str]] = []
    actions = beat.get("actions") or []
    pos = beat.get("pos") or {}
    ball = str(beat.get("ball") or "")

    if beat_index == 0:
        return issues

    prev_ball = str(prev.get("ball") or "") if prev else ""
    prev_pos = prev.get("pos") or {} if prev else {}

    if prev_ball and ball and prev_ball != ball:
        has_transfer = any(
            a.get("type") in {"pass", "handoff"}
            and str(a.get("by")) == prev_ball
            and str(a.get("for")) == ball
            for a in actions
        )
        if not has_transfer:
            issues.append(
                {
                    "code": "ball_change_no_pass",
                    "severity": "error",
                    "message": f"Ball moves {prev_ball}→{ball} with no pass/handoff from {prev_ball}.",
                    "fix": "Add a pass or handoff, or fix the ball handler on this beat.",
                }
            )

    carrier = prev_ball or ball
    for a in actions:
        atype = a.get("type")
        by = str(a.get("by") or "")
        fo = str(a.get("for") or "")
        if atype not in VALID_TYPES:
            issues.append(
                {
                    "code": "invalid_action_type",
                    "severity": "warn",
                    "message": f"Unknown action type “{atype}”.",
                    "fix": "Use cut, screen, dribble, pass, or handoff.",
                }
            )
            continue
        if atype in {"pass", "handoff"}:
            if by != carrier:
                issues.append(
                    {
                        "code": "pass_wrong_passer",
                        "severity": "error",
                        "message": f"Pass from {by} but {carrier} has the ball at beat start.",
                        "fix": f"Set passer to {carrier} or fix ball on previous beat.",
                    }
                )
            p_from, p_to = pos.get(by), pos.get(fo)
            if p_from and p_to and _dist(p_from, p_to) < MIN_PASS_PX:
                issues.append(
                    {
                        "code": "pass_too_short",
                        "severity": "warn",
                        "message": f"Pass {by}→{fo} is very short — may not animate.",
                        "fix": "Check positions or merge beats.",
                    }
                )
            if fo:
                carrier = fo
        elif atype == "dribble" and by:
            carrier = by

    passers = [str(a.get("by")) for a in actions if a.get("type") in {"pass", "handoff"}]
    if len(passers) != len(set(passers)):
        issues.append(
            {
                "code": "duplicate_pass_reads",
                "severity": "error",
                "message": "Multiple passes from the same player (diagram reads, not one animation).",
                "fix": "Keep one pass per passer — delete read options.",
            }
        )

    movers_without_action = []
    for pid in ("1", "2", "3", "4", "5"):
        if _player_moved(prev_pos, pos, pid) and not any(str(a.get("by")) == pid for a in actions):
            movers_without_action.append(pid)

    if movers_without_action and actions:
        issues.append(
            {
                "code": "moved_without_action",
                "severity": "warn",
                "message": f"Player(s) {', '.join(movers_without_action)} moved but have no drawn action.",
                "fix": "Add a cut/dribble for each mover, or drag spots to match the prior beat.",
            }
        )

    if len(actions) > 1 and not any(a.get("order") is not None for a in actions):
        issues.append(
            {
                "code": "missing_action_order",
                "severity": "warn",
                "message": "Multiple actions but no sequence order — animation may look wrong.",
                "fix": "Use timing rows in the editor to set step order (dribble→pass→screen→cut).",
            }
        )

    return issues


def fill_missing_actions(prev: dict[str, Any] | None, beat: dict[str, Any]) -> None:
    """Infer cuts/passes for movers the vision model missed — flagged uncertain."""
    if not prev:
        return

    actions: list[dict[str, Any]] = list(beat.get("actions") or [])
    prev_pos = prev.get("pos") or {}
    pos = beat.get("pos") or {}
    prev_ball = str(prev.get("ball") or "")
    ball = str(beat.get("ball") or "")
    covered = {str(a.get("by")) for a in actions if a.get("by")}

    if (
        prev_ball
        and ball
        and prev_ball != ball
        and prev_ball in {"1", "2", "3", "4", "5"}
        and ball in {"1", "2", "3", "4", "5"}
    ):
        has_transfer = any(
            a.get("type") in {"pass", "handoff"}
            and str(a.get("by")) == prev_ball
            and str(a.get("for")) == ball
            for a in actions
        )
        if not has_transfer:
            actions.append(
                {
                    "id": f"a{len(actions) + 1}",
                    "type": "pass",
                    "by": prev_ball,
                    "for": ball,
                    "order": 2,
                    "uncertain": True,
                    "reason": "Ball changed from previous beat but no pass line was detected",
                }
            )
            covered.add(prev_ball)
            beat["needs_review"] = True
            beat["review_reason"] = beat.get("review_reason") or "missing_pass_inferred"

    for pid in ("1", "2", "3", "4", "5"):
        if pid in covered:
            continue
        if not _player_moved(prev_pos, pos, pid):
            continue
        atype = "dribble" if pid == prev_ball and ball == pid else "cut"
        actions.append(
            {
                "id": f"a{len(actions) + 1}",
                "type": atype,
                "by": pid,
                "order": 1 if atype == "dribble" else 4,
                "uncertain": True,
                "reason": "Player moved but no line was detected on the diagram",
            }
        )
        covered.add(pid)
        beat["needs_review"] = True
        beat["review_reason"] = beat.get("review_reason") or "missing_action_inferred"

    beat["actions"] = actions


def apply_animation_validation(play: dict[str, Any]) -> None:
    beats = play.get("beats", play.get("frames", []))
    for i, beat in enumerate(beats):
        prev = beats[i - 1] if i > 0 else None
        issues = validate_beat_animation(prev, beat, beat_index=i)
        if issues:
            beat["animation_issues"] = issues
            errors = [x for x in issues if x.get("severity") == "error"]
            if errors:
                beat["needs_review"] = True
                beat["review_reason"] = beat.get("review_reason") or "animation_error"
        elif "animation_issues" in beat:
            del beat["animation_issues"]
