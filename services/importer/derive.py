"""Derive beat.ball and missing movement actions — single writer after parse + interpret."""

from __future__ import annotations

import math
from typing import Any

PLAYER_IDS = ("1", "2", "3", "4", "5")
TRANSFERS = {"pass", "handoff"}
TYPE_ORDER = {"dribble": 1, "pass": 2, "handoff": 2, "screen": 3, "cut": 4}

# 10 units ≈ 1 foot on the 500×470 court
JITTER_MAX = 25  # under: token jitter — snap pos, no action
REAL_MOVE_MIN = 25  # over: real move — derive cut/dribble (matches validation rule 9)
MAX_BEAT_MOVE = 500  # flag for review, never split path
MAX_SCREENER_MOVE = 60
SPLIT_SCREEN_ENDPOINT_MAX = 40  # N-1 cut endpoint ≈ screener pos on beat N
ZERO_TRAVEL_SCREEN_REASON = "Screen has no movement — verify against your playbook"
HOLDER_CUT_REASON = "Ball handler has a cut — should this be a dribble?"
PASS_AND_CUT_REASON = (
    "Player passes and cuts on the same beat — should the cut be a dribble, "
    "or belong to the next beat?"
)


def _dist(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _path_length(path: list[dict[str, float]]) -> float:
    total = 0.0
    for i in range(1, len(path)):
        total += _dist(path[i - 1], path[i])
    return total


def _simple_path(start: dict[str, float], end: dict[str, float]) -> list[dict[str, float]]:
    return [{"x": start["x"], "y": start["y"]}, {"x": end["x"], "y": end["y"]}]


# A turning point this close to the line it is supposed to bend is not a corner, it is
# a hand-drawn wobble. Bending the route through it would add noise, not shape.
VIA_MIN_DEVIATION = 12


def _perp_distance(
    p: dict[str, float], a: dict[str, float], b: dict[str, float]
) -> float:
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    len_sq = dx * dx + dy * dy
    if len_sq == 0:
        return _dist(p, a)
    cross = abs(dy * p["x"] - dx * p["y"] + b["x"] * a["y"] - b["y"] * a["x"])
    return cross / math.sqrt(len_sq)


def _path_via(
    start: dict[str, float],
    end: dict[str, float],
    via: list[dict[str, float]] | None,
) -> list[dict[str, float]]:
    """Route from start to end through the model's turning points.

    The endpoints come from the parser and are trusted; only the corners come from the
    model, and any that sit on the straight line are discarded. This is the one place a
    bent arrow survives into the data — everything downstream just samples the polyline.
    """
    corners = [
        {"x": float(p["x"]), "y": float(p["y"])}
        for p in (via or [])
        if isinstance(p, dict) and "x" in p and "y" in p
    ]
    kept = [c for c in corners if _perp_distance(c, start, end) >= VIA_MIN_DEVIATION]
    if not kept:
        return _simple_path(start, end)
    return [
        {"x": start["x"], "y": start["y"]},
        *kept,
        {"x": end["x"], "y": end["y"]},
    ]


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


def _holder_loco_covered(actions: list[dict[str, Any]], pid: str) -> bool:
    return any(
        str(a.get("by")) == pid
        and a.get("type") in {"cut", "dribble", "handoff", "screen"}
        for a in actions
    )


def _movement_covered(actions: list[dict[str, Any]], pid: str) -> bool:
    return any(
        str(a.get("by")) == pid and a.get("type") in {"cut", "dribble", "screen"}
        for a in actions
    )


def derive_holder_dribbles(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Ball handler moved > JITTER_MAX within beat with no cut/dribble/handoff -> derived dribble.
    Pass alone does not cover relocation (lost dribble recovery).
    """
    derived: list[dict[str, Any]] = []

    for i, beat in enumerate(beats):
        actions: list[dict[str, Any]] = list(beat.get("actions") or [])
        holder = _beat_start_holder(beats, i)
        if _holder_loco_covered(actions, holder):
            continue
        start_pos, end_pos = _beat_positions(beat)
        a = start_pos.get(holder)
        b = end_pos.get(holder)
        if not a or not b:
            continue
        move = _dist(a, b)
        if move <= JITTER_MAX:
            continue

        entry: dict[str, Any] = {
            "id": _next_action_id(actions),
            "type": "dribble",
            "by": holder,
            "path": _simple_path(a, b),
            "derived": True,
        }
        if move > MAX_BEAT_MOVE:
            entry["needsReview"] = True
            entry["reason"] = f"Movement {move:.0f} units exceeds {MAX_BEAT_MOVE} (flagged, not split)"
        actions.append(entry)
        beat["actions"] = actions
        derived.append(
            {
                "beat": beat.get("id"),
                "player": holder,
                "type": "dribble",
                "move": round(move, 1),
                "flagged": move > MAX_BEAT_MOVE,
            }
        )

    return derived


def derive_movement_actions(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Rule 9 at import: player moved > REAL_MOVE_MIN within beat with no movement action -> derived cut/dribble.
    Pass/handoff alone do not cover player movement.
    """
    derived: list[dict[str, Any]] = []

    for i, beat in enumerate(beats):
        actions: list[dict[str, Any]] = list(beat.get("actions") or [])
        holder = _beat_start_holder(beats, i)
        start_pos, end_pos = _beat_positions(beat)

        for pid in PLAYER_IDS:
            if _movement_covered(actions, pid):
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


def _action_endpoint(
    action: dict[str, Any],
    start_pos: dict[str, Any],
    end_pos: dict[str, Any],
) -> dict[str, float] | None:
    path = action.get("path") or []
    if path:
        return path[-1]
    pid = str(action.get("by") or "")
    return end_pos.get(pid) or start_pos.get(pid)


def merge_split_screens(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    One drawn travel+bar split into cut on N-1 and empty screen on N.
    Merge back into a single screen on N-1 with path + for from the bar frame.
    """
    merged: list[dict[str, Any]] = []

    for i in range(1, len(beats)):
        beat_n = beats[i]
        beat_prev = beats[i - 1]
        start_n, end_n = _beat_positions(beat_n)
        start_p, end_p = _beat_positions(beat_prev)
        to_remove: list[dict[str, Any]] = []

        for action in beat_n.get("actions") or []:
            if action.get("type") != "screen" or action.get("derived"):
                continue
            pid = str(action.get("by") or "")
            a = start_n.get(pid)
            b = end_n.get(pid)
            if not a or not b or _dist(a, b) > 0.1:
                continue

            screener_pos = b
            match: dict[str, Any] | None = None
            for prev_action in beat_prev.get("actions") or []:
                if prev_action.get("derived"):
                    continue
                if str(prev_action.get("by")) != pid:
                    continue
                if prev_action.get("type") not in {"cut", "dribble"}:
                    continue
                endpoint = _action_endpoint(prev_action, start_p, end_p)
                if endpoint and _dist(endpoint, screener_pos) <= SPLIT_SCREEN_ENDPOINT_MAX:
                    match = prev_action
                    break

            if not match:
                continue

            screen_for = action.get("for")
            match["type"] = "screen"
            if screen_for is not None:
                match["for"] = str(screen_for)
            if not match.get("path") or len(match["path"]) < 2:
                a0 = start_p.get(pid)
                a1 = end_p.get(pid)
                if a0 and a1:
                    match["path"] = _simple_path(a0, a1)
            match["needsReview"] = True
            match["reason"] = (
                f"Merged split screen: travel on {beat_prev.get('id')} + bar on {beat_n.get('id')}"
            )
            to_remove.append(action)
            merged.append(
                {
                    "prev_beat": beat_prev.get("id"),
                    "screen_beat": beat_n.get("id"),
                    "player": pid,
                    "for": screen_for,
                    "merged_action": match.get("id"),
                    "removed_action": action.get("id"),
                }
            )

        if to_remove:
            remove_ids = {a.get("id") for a in to_remove}
            beat_n["actions"] = [
                a for a in (beat_n.get("actions") or []) if a.get("id") not in remove_ids
            ]

    return merged


# A screen is set in a teammate's path, so the screener finishes near whoever uses it.
SCREEN_TARGET_MAX = 120
TARGETLESS_SCREEN_REASON = "Screen had no target — inferred the nearest moving teammate"
UNUSED_SCREEN_REASON = "Read as a screen but nobody uses it — treated as a cut"


def repair_targetless_screens(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Never emit a screen with nobody to screen for.

    `validatePlay` rejects one outright, so a single malformed action disqualifies the
    whole play — which is what happened to Horns on the 2026-08-17 candidate run and cost
    the entire re-import.

    A screen is set in the path of a teammate who cuts off it, so the screener ends up
    near that teammate. Where a plausible one exists it is inferred and flagged for the
    coach. Where none does, the mark was more likely a cut than a screen, so it becomes
    one — and if the player did not travel either, the action is dropped rather than
    invented.
    """
    repairs: list[dict[str, Any]] = []

    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        drop: list[dict[str, Any]] = []

        for action in beat.get("actions") or []:
            if action.get("type") != "screen":
                continue
            target = action.get("for")
            if target is not None and str(target) in PLAYER_IDS:
                continue

            pid = str(action.get("by") or "")
            screener_end = end_pos.get(pid) or start_pos.get(pid)
            if not screener_end:
                continue

            # Whoever uses a screen has to move; a stationary teammate did not cut off it.
            best: str | None = None
            best_dist = float(SCREEN_TARGET_MAX)
            for other in PLAYER_IDS:
                if other == pid:
                    continue
                a = start_pos.get(other)
                b = end_pos.get(other)
                if not a or not b or _dist(a, b) < REAL_MOVE_MIN:
                    continue
                d = _dist(screener_end, b)
                if d < best_dist:
                    best_dist = d
                    best = other

            if best:
                action["for"] = best
                action["needsReview"] = True
                action["reason"] = TARGETLESS_SCREEN_REASON
                repairs.append(
                    {
                        "beat": beat.get("id"),
                        "action": action.get("id"),
                        "player": pid,
                        "inferred_for": best,
                        "distance": round(best_dist),
                        "outcome": "inferred",
                    }
                )
                continue

            a = start_pos.get(pid)
            b = end_pos.get(pid)
            travel = _dist(a, b) if a and b else 0.0

            if travel >= REAL_MOVE_MIN:
                action["type"] = "cut"
                action.pop("for", None)
                action["needsReview"] = True
                action["reason"] = UNUSED_SCREEN_REASON
                repairs.append(
                    {
                        "beat": beat.get("id"),
                        "action": action.get("id"),
                        "player": pid,
                        "outcome": "cut",
                    }
                )
            else:
                drop.append(action)
                repairs.append(
                    {
                        "beat": beat.get("id"),
                        "action": action.get("id"),
                        "player": pid,
                        "outcome": "dropped",
                    }
                )

        if drop:
            beat["actions"] = [a for a in beat["actions"] if a not in drop]

    return repairs


def flag_zero_travel_screens(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flag idle screens with no N-1 cut to merge — coach must verify."""
    flagged: list[dict[str, Any]] = []

    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        for action in beat.get("actions") or []:
            if action.get("type") != "screen":
                continue
            pid = str(action.get("by") or "")
            a = start_pos.get(pid)
            b = end_pos.get(pid)
            if not a or not b or _dist(a, b) > 0.1:
                continue
            if action.get("reason", "").startswith("Merged split screen"):
                continue
            action["needsReview"] = True
            action["reason"] = ZERO_TRAVEL_SCREEN_REASON
            flagged.append(
                {
                    "beat": beat.get("id"),
                    "action": action.get("id"),
                    "player": pid,
                    "for": action.get("for"),
                }
            )

    return flagged


def reclassify_traveling_screens(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Screens where the screener moves too far become cuts — within-beat travel."""
    changed: list[dict[str, Any]] = []

    for beat in beats:
        start_pos, end_pos = _beat_positions(beat)
        for action in beat.get("actions") or []:
            if action.get("type") != "screen":
                continue
            if action.get("path") and len(action["path"]) >= 2:
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


def flag_holder_cuts(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """AI cut on ball handler at beat start — likely a misread dribble."""
    flagged: list[dict[str, Any]] = []

    for i, beat in enumerate(beats):
        holder = _beat_start_holder(beats, i)
        for action in beat.get("actions") or []:
            if action.get("type") != "cut":
                continue
            if str(action.get("by")) != holder:
                continue
            if action.get("derived"):
                continue
            action["needsReview"] = True
            action["reason"] = HOLDER_CUT_REASON
            flagged.append(
                {
                    "beat": beat.get("id"),
                    "action": action.get("id"),
                    "player": holder,
                }
            )

    return flagged


def flag_pass_and_cut(beats: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pass-then-cut is legal and unambiguous — nothing to flag.

    This used to mark every pass and cut by the same player on one beat as needing
    review, asking whether the cut was really a dribble. The notation already answers
    that: a player travelling *with* the ball is drawn as a dribble, so a cut by the
    passer is necessarily the move they make after releasing it, and `sequenceBeat`
    orders it that way.

    It was the single largest source of review flags in the book and not one of them
    was a real question. The function stays so the pipeline's summary keeps its shape;
    it simply has nothing to report.
    """
    del beats
    return []


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
            action["path"] = _path_via(a, b, action.pop("via", None))
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
    holder_dribbles = derive_holder_dribbles(beats)
    movement_derived = derive_movement_actions(beats)
    split_merged = merge_split_screens(beats)
    # Before the flaggers: a screen with no target is malformed, not merely suspicious.
    screens_repaired = repair_targetless_screens(beats)
    zero_travel_flagged = flag_zero_travel_screens(beats)
    screen_changes = reclassify_traveling_screens(beats)
    paths_enriched = enrich_action_paths(beats)
    holder_cuts_flagged = flag_holder_cuts(beats)
    pass_cut_flagged = flag_pass_and_cut(beats)
    sanitize_removed += sanitize_actions(beats)
    ball_repairs += derive_ball(beats)

    # `via` is an input to path building, not part of the saved Action. Anything the
    # model attached to an action that never got a path (a pass, a dropped movement)
    # would otherwise ride along into the seed file.
    bent_paths = 0
    for beat in beats:
        for action in beat.get("actions") or []:
            action.pop("via", None)
            if len(action.get("path") or []) >= 3:
                bent_paths += 1

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
        "holder_dribbles": holder_dribbles,
        "movement_derived": movement_derived,
        "split_merged": split_merged,
        "zero_travel_flagged": zero_travel_flagged,
        "screens_repaired": screens_repaired,
        "screen_changes": screen_changes,
        "paths_enriched": paths_enriched,
        "bent_paths": bent_paths,
        "holder_cuts_flagged": holder_cuts_flagged,
        "pass_cut_flagged": pass_cut_flagged,
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
