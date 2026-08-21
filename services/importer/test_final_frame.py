"""The last frame's arrows have nowhere else to come from."""

import unittest

from derive import FINAL_FRAME_REASON, apply_final_frame_endpoints

HERE = {"1": {"x": 250, "y": 400}, "2": {"x": 100, "y": 200}}


def beat(actions, start=None):
    start = start or dict(HERE)
    return {"id": "b1", "startPos": start, "pos": dict(start), "startBall": "1",
            "actions": actions}


class FinalFrameTest(unittest.TestCase):
    def test_moves_the_player_to_the_arrowhead(self):
        b = beat([{"id": "a1", "type": "cut", "by": "2", "to": {"x": 300, "y": 100}}])
        applied = apply_final_frame_endpoints([b])
        self.assertEqual(len(applied), 1)
        self.assertEqual(b["pos"]["2"], {"x": 300, "y": 100})
        self.assertEqual(b["pos"]["1"], HERE["1"], "no arrow means stay put")

    def test_flags_it_for_review(self):
        action = {"id": "a1", "type": "cut", "by": "2", "to": {"x": 300, "y": 100}}
        apply_final_frame_endpoints([beat([action])])
        self.assertTrue(action["needsReview"])
        self.assertEqual(action["reason"], FINAL_FRAME_REASON)
        self.assertNotIn("to", action, "`to` is an input, not part of the saved action")

    def test_keeps_the_models_own_reason(self):
        action = {"id": "a1", "type": "cut", "by": "2", "to": {"x": 300, "y": 100},
                  "reason": "two arrows cross here"}
        apply_final_frame_endpoints([beat([action])])
        self.assertEqual(action["reason"], "two arrows cross here")

    def test_ignores_a_hop(self):
        """Under the jitter floor is a token nudged, not a move."""
        b = beat([{"id": "a1", "type": "cut", "by": "2", "to": {"x": 104, "y": 203}}])
        self.assertEqual(apply_final_frame_endpoints([b]), [])
        self.assertEqual(b["pos"]["2"], HERE["2"])

    def test_ignores_a_teleport(self):
        b = beat([{"id": "a1", "type": "cut", "by": "2", "to": {"x": 480, "y": 460}}],
                 start={"2": {"x": 10, "y": 10}})
        self.assertEqual(apply_final_frame_endpoints([b]), [])

    def test_passes_do_not_move_the_passer(self):
        b = beat([{"id": "a1", "type": "pass", "by": "1", "for": "2",
                   "to": {"x": 300, "y": 100}}])
        self.assertEqual(apply_final_frame_endpoints([b]), [])
        self.assertEqual(b["pos"]["1"], HERE["1"])

    def test_only_the_last_beat_is_touched(self):
        first = beat([{"id": "a1", "type": "cut", "by": "2", "to": {"x": 300, "y": 100}}])
        last = beat([])
        apply_final_frame_endpoints([first, last])
        self.assertEqual(first["pos"]["2"], HERE["2"], "earlier beats have real positions")

    def test_no_beats(self):
        self.assertEqual(apply_final_frame_endpoints([]), [])


if __name__ == "__main__":
    unittest.main()
