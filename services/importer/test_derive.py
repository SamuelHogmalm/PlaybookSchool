"""Tests for the derive stage.

    cd services/importer
    .venv/Scripts/python.exe -m unittest -v

Stdlib unittest on purpose — the importer has no test dependency and does not need one.
"""

from __future__ import annotations

import unittest

from derive import (
    TARGETLESS_SCREEN_REASON,
    UNUSED_SCREEN_REASON,
    _path_via,
    repair_targetless_screens,
)


def beat(actions, start, end=None):
    return {
        "id": "b1",
        "startPos": start,
        "pos": end or start,
        "startBall": "1",
        "actions": actions,
    }


def pos(**kwargs):
    """Positions for five players; unnamed ones park off in a corner, well apart."""
    base = {
        "1": {"x": 250.0, "y": 350.0},
        "2": {"x": 60.0, "y": 60.0},
        "3": {"x": 440.0, "y": 60.0},
        "4": {"x": 60.0, "y": 440.0},
        "5": {"x": 440.0, "y": 440.0},
    }
    base.update({k: {"x": float(v[0]), "y": float(v[1])} for k, v in kwargs.items()})
    return base


class TargetlessScreens(unittest.TestCase):
    def test_infers_the_nearest_moving_teammate(self):
        start = pos(**{"5": (250, 200), "1": (250, 350)})
        end = pos(**{"5": (250, 200), "1": (260, 210)})  # 1 cuts up to the screen
        b = beat([{"id": "a1", "type": "screen", "by": "5"}], start, end)

        repairs = repair_targetless_screens([b])

        self.assertEqual(b["actions"][0]["for"], "1")
        self.assertEqual(b["actions"][0]["reason"], TARGETLESS_SCREEN_REASON)
        self.assertTrue(b["actions"][0]["needsReview"])
        self.assertEqual(repairs[0]["outcome"], "inferred")

    def test_ignores_a_teammate_who_does_not_move(self):
        # Player 1 is right next to the screen but stationary, so nobody used it.
        # Player 3 travels a long way and is far off, so there is no plausible target.
        start = pos(**{"5": (250, 200), "1": (255, 205), "3": (440, 60)})
        end = pos(**{"5": (250, 120), "1": (255, 205), "3": (440, 440)})
        b = beat([{"id": "a1", "type": "screen", "by": "5"}], start, end)

        repair_targetless_screens([b])

        self.assertEqual(b["actions"][0]["type"], "cut")
        self.assertNotIn("for", b["actions"][0])
        self.assertEqual(b["actions"][0]["reason"], UNUSED_SCREEN_REASON)

    def test_drops_a_screen_that_helps_nobody_and_goes_nowhere(self):
        start = pos(**{"5": (250, 200)})
        b = beat([{"id": "a1", "type": "screen", "by": "5"}], start, start)

        repairs = repair_targetless_screens([b])

        self.assertEqual(b["actions"], [])
        self.assertEqual(repairs[0]["outcome"], "dropped")

    def test_leaves_a_well_formed_screen_alone(self):
        start = pos(**{"5": (250, 200), "1": (250, 350)})
        end = pos(**{"5": (250, 200), "1": (260, 210)})
        action = {"id": "a1", "type": "screen", "by": "5", "for": "1"}
        b = beat([action], start, end)

        repairs = repair_targetless_screens([b])

        self.assertEqual(repairs, [])
        self.assertEqual(action, {"id": "a1", "type": "screen", "by": "5", "for": "1"})

    def test_treats_an_out_of_range_target_as_missing(self):
        start = pos(**{"5": (250, 200), "1": (250, 350)})
        end = pos(**{"5": (250, 200), "1": (260, 210)})
        b = beat([{"id": "a1", "type": "screen", "by": "5", "for": "9"}], start, end)

        repair_targetless_screens([b])

        self.assertEqual(b["actions"][0]["for"], "1")


class BentPaths(unittest.TestCase):
    def test_keeps_a_real_corner(self):
        path = _path_via(
            {"x": 0.0, "y": 0.0},
            {"x": 100.0, "y": 0.0},
            [{"x": 50.0, "y": 60.0}],
        )
        self.assertEqual(len(path), 3)
        self.assertEqual(path[1], {"x": 50.0, "y": 60.0})

    def test_discards_a_wobble_on_the_straight_line(self):
        path = _path_via(
            {"x": 0.0, "y": 0.0},
            {"x": 100.0, "y": 0.0},
            [{"x": 50.0, "y": 3.0}],
        )
        self.assertEqual(len(path), 2)

    def test_endpoints_are_never_the_models(self):
        start, end = {"x": 1.0, "y": 2.0}, {"x": 99.0, "y": 98.0}
        path = _path_via(start, end, [{"x": 50.0, "y": 10.0}])
        self.assertEqual(path[0], start)
        self.assertEqual(path[-1], end)

    def test_no_via_is_a_straight_line(self):
        path = _path_via({"x": 0.0, "y": 0.0}, {"x": 10.0, "y": 10.0}, None)
        self.assertEqual(len(path), 2)


if __name__ == "__main__":
    unittest.main()
