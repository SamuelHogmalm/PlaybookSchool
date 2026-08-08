"""Derive beat.ball and missing movement actions — single writer after parse + interpret."""

from __future__ import annotations

import math
from typing import Any

PLAYER_IDS = ("1", "2", "3", "4", "5")
TRANSFERS = {"pass", "handoff"}
TYPE_ORDER = {"dribble": 1, "pass": 2, "handoff": 2, "screen": 3, "cut": 4}

# 10 units ≈ 1 foot on the 500×470 court
JITTER_MAX = 25  # under: token jitter — snap pos, no action
SPACING_MAX = 60  # 25–60: spacing adjustment — keep pos, no action
REAL_MOVE_MIN = 60  # over: real move — derive cut/dribble
MAX_BEAT_MOVE = 500  # flag for review, never split path
MAX_SCREENER_MOVE = 60


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _path_length(path: list[dict[str, float]]) -> float:
    total = 0.0
    for i in range(1, len(path)):
        total += _dist(path[i - 1], path[i])
    return total


def _simple_path(start: dict[str, float], end: dict[str, float]) -> list[dict[str, float]]:
    return [{"x": start["x"], "y": start["y"]}, {"x": end["x"], "y": end["y"]}]


def _beat_positions(beat: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Start and end positions for one beat (startPos -> pos within beat)."""
    start_pos = beat.get("startPos") or beat.get("pos") or {}
    end_pos = beat.get("pos") or start_pos
    return start_pos, end_pos


def _next_action_id(actions: list[dict[str, Any]]) -> str:
    max_n = 0
    for action in actions:
        aid = str(action.get("id", ""))
        if aid.startswith("a") and aid[1:].isdigit():
            max_n = max(max_n, int(aid[1:]))
    return f"a{max_n + 1}"


def _beat_start_holder(beats: list[dict[str, Any]], index: int) -> str:
    if index == 0:
        return str(beats[0].get("startBall") or "1")
    return str(beats[index - 1].get("ball") or beats[index].get("startBall") or "1")


def _action_travel(
    action: dict[str, Any],
    start_pos: dict[str, Any],
    end_pos: dict[str, Any],
) -> float:
    path = action.get("path") or []
    if len(path) >= 2:
        return _path_length(path)
    pid = str(action.get("by") or "")
    a = start_pos.get(pid)
    b = end_pos.get(pid)
    if a and b:
        return _dist(a, b)
    return 0.0


def _valid_transfer(action: dict[str, Any], holder: str) -> bool:
    if action.get("type") not in TRANSFERS:
        return False
    by = str(action.get("by") or "")
    fo = str(action.get("for") or "")
    if by != holder or not fo or by == fo:
        return False
    return fo in PLAYER_IDS


def migrate_legacy_positions(beats: list[dict[str, Any]]) -> None:
    """Old data had pos = frame positions only. Promote to startPos; pos from next beat."""
    for i, beat in enumerate(beats):
        if beat.get("startPos"):
            continue
        frame_pos = beat.get("pos") or {}
        beat["startPos"] = frame_pos
        if i + 1 < len(beats):
            next_start = beats[i + 1].get("startPos") or beats[i + 1].get("pos") or {}
            beat["pos"] = next_start
        else:
            beat["pos"] = dict(frame_pos)


def snap_jitter_positions(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Under JITTER_MAX: snap end pos back to startPos — within-beat token noise."""
    snapped: list[dict[str, Any]] = []

    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        for pid in PLAYER_IDS:
            a = start_pos.get(pid)
            b = end_pos.get(pid)
            if not a or not b:
                continue
            move = _dist(a, b)
            if move < JITTER_MAX:
                end_pos[pid] = {"x": a["x"], "y": a["y"]}
                snapped.append(
                    {
                        "beat": beat.get("id"),
                        "player": pid,
                        "move": round(move, 1),
                    }
                )
        beat["pos"] = end_pos

    return snapped


def drop_short_movement_actions(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop AI cut/dribble with within-beat travel under JITTER_MAX."""
    dropped: list[dict[str, Any]] = []

    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        kept: list[dict[str, Any]] = []
        for action in beat.get("actions") or []:
            atype = action.get("type")
            if atype in {"cut", "dribble"} and not action.get("derived"):
                travel = _action_travel(action, start_pos, end_pos)
                if travel < JITTER_MAX:
                    dropped.append(
                        {
                            "beat": beat.get("id"),
                            "action": action.get("id"),
                            "type": atype,
                            "by": action.get("by"),
                            "travel": round(travel, 1),
                        }
                    )
                    continue
            kept.append(action)
        beat["actions"] = kept

    return dropped


def sanitize_actions(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop illegal ball ops and self-target actions."""
    removed: list[dict[str, Any]] = []

    for i, beat in enumerate(beats):
        holder = _beat_start_holder(beats, i)
        kept: list[dict[str, Any]] = []
        for action in beat.get("actions") or []:
            atype = action.get("type")
            by = str(action.get("by") or "")
            fo = str(action.get("for") or "")

            if fo and by == fo:
                removed.append({"beat": beat.get("id"), "action": action.get("id"), "reason": "self_target"})
                continue

            if atype in TRANSFERS or atype == "dribble":
                if by != holder:
                    removed.append(
                        {"beat": beat.get("id"), "action": action.get("id"), "reason": "wrong_holder"}
                    )
                    continue
                if atype in TRANSFERS:
                    holder = fo

            kept.append(action)

        kept.sort(key=lambda a: (TYPE_ORDER.get(str(a.get("type")), 99), str(a.get("id"))))
        for j, action in enumerate(kept, 1):
            action["order"] = j
        beat["actions"] = kept

    return removed


def derive_ball(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Single writer for beat.ball.

    Rules:
    - Last valid pass/handoff in beat -> ball = receiver
    - No transfer -> previous beat's ball (beat 0 -> startBall)
    - End must match next beat's startBall; else insert review pass
    """
    repairs: list[dict[str, Any]] = []

    for i, beat in enumerate(beats):
        actions: list[dict[str, Any]] = list(beat.get("actions") or [])
        holder = _beat_start_holder(beats, i)

        ball = holder
        for action in actions:
            if _valid_transfer(action, holder):
                ball = str(action["for"])
                holder = ball

        if i < len(beats) - 1:
            next_start = str(beats[i + 1].get("startBall") or "")
            if next_start and ball != next_start:
                actions.append(
                    {
                        "id": _next_action_id(actions),
                        "type": "pass",
                        "by": ball,
                        "for": next_start,
                        "needsReview": True,
                        "reason": (
                            f"Inserted pass {ball}->{next_start} to match next frame possession ring"
                        ),
                    }
                )
                repairs.append(
                    {
                        "beat": beat.get("id"),
                        "kind": "insert_pass",
                        "from": ball,
                        "to": next_start,
                    }
                )
                ball = next_start

        beat["actions"] = actions
        beat["ball"] = ball

    return repairs


def derive_movement_actions(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Rule 9 at import: player moved > REAL_MOVE_MIN within beat with no action -> derived cut/dribble.
    Actions on the SAME beat cover the mover.
    """
    derived: list[dict[str, Any]] = []

    for i, beat in enumerate(beats):
        actions: list[dict[str, Any]] = list(beat.get("actions") or [])
        covered = {str(a.get("by")) for a in actions if a.get("by")}
        holder = _beat_start_holder(beats, i)
        start_pos, end_pos = _beat_positions(beat)

        for pid in PLAYER_IDS:
            if pid in covered:
                continue
            a = start_pos.get(pid)
            b = end_pos.get(pid)
            if not a or not b:
                continue
            move = _dist(a, b)
            if i > 0:
                prev = beats[i - 1]
                prev_ai = {
                    str(x.get("by"))
                    for x in (prev.get("actions") or [])
                    if x.get("type") in {"cut", "dribble"} and not x.get("derived")
                }
                if pid in prev_ai and move <= REAL_MOVE_MIN:
                    continue
            if move <= REAL_MOVE_MIN:
                continue

            atype = "dribble" if pid == holder else "cut"
            entry: dict[str, Any] = {
                "id": _next_action_id(actions),
                "type": atype,
                "by": pid,
                "path": _simple_path(a, b),
                "derived": True,
            }
            if move > MAX_BEAT_MOVE:
                entry["needsReview"] = True
                entry["reason"] = f"Movement {move:.0f} units exceeds {MAX_BEAT_MOVE} (flagged, not split)"
            actions.append(entry)
            covered.add(pid)
            derived.append(
                {
                    "beat": beat.get("id"),
                    "player": pid,
                    "type": atype,
                    "move": round(move, 1),
                    "flagged": move > MAX_BEAT_MOVE,
                }
            )

        beat["actions"] = actions

    return derived


def reclassify_traveling_screens(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Screens where the screener moves too far become cuts — within-beat travel."""
    changed: list[dict[str, Any]] = []

    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        for action in beat.get("actions") or []:
            if action.get("type") != "screen":
                continue
            pid = str(action.get("by") or "")
            a = start_pos.get(pid)
            b = end_pos.get(pid)
            if not a or not b or _dist(a, b) <= MAX_SCREENER_MOVE:
                continue
            move = _dist(a, b)
            action["type"] = "cut"
            action.pop("for", None)
            if not action.get("path"):
                action["path"] = _simple_path(a, b)
            if move > MAX_BEAT_MOVE:
                action["needsReview"] = True
                action["reason"] = f"Screener travel {move:.0f} units exceeds {MAX_BEAT_MOVE}"
            changed.append({"beat": beat.get("id"), "player": pid, "from": "screen", "to": "cut"})

    return changed


def enrich_action_paths(beats: list[dict[str, Any]]) -> int:
    """Fill path only when absent — startPos -> pos within beat."""
    enriched = 0
    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        for action in beat.get("actions") or []:
            if action.get("type") not in {"cut", "dribble"}:
                continue
            if action.get("path") and len(action["path"]) >= 2:
                continue
            pid = str(action.get("by") or "")
            a = start_pos.get(pid)
            b = end_pos.get(pid)
            if not a or not b:
                continue
            action["path"] = _simple_path(a, b)
            enriched += 1
    return enriched


def count_actions(beats: list[dict[str, Any]]) -> int:
    return sum(len(b.get("actions") or []) for b in beats)


def finalize_beats(beats: list[dict[str, Any]]) -> dict[str, Any]:
    """Full post-interpret derivation pipeline."""
    migrate_legacy_positions(beats)
    actions_before = count_actions(beats)

    sanitize_removed = sanitize_actions(beats)
    short_dropped = drop_short_movement_actions(beats)
    jitter_snapped = snap_jitter_positions(beats)
    ball_repairs = derive_ball(beats)
    movement_derived = derive_movement_actions(beats)
    screen_changes = reclassify_traveling_screens(beats)
    paths_enriched = enrich_action_paths(beats)
    sanitize_removed += sanitize_actions(beats)
    ball_repairs += derive_ball(beats)

    actions_after = count_actions(beats)
    derived_remaining = sum(
        1
        for b in beats
        for a in (b.get("actions") or [])
        if a.get("derived")
    )

    return {
        "actions_before": actions_before,
        "actions_after": actions_after,
        "derived_remaining": derived_remaining,
        "ball_repairs": ball_repairs,
        "movement_derived": movement_derived,
        "screen_changes": screen_changes,
        "paths_enriched": paths_enriched,
        "sanitize_removed": sanitize_removed,
        "jitter_snapped": jitter_snapped,
        "short_dropped": short_dropped,
    }


def migrate_legacy_ball_field(beats: list[dict[str, Any]]) -> None:
    """Old parser wrote circled number as beat.ball — treat as startBall."""
    for beat in beats:
        if "startBall" not in beat and beat.get("ball") is not None:
            beat["startBall"] = beat["ball"]
        beat.pop("ball", None)
