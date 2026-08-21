"""Court detection has to work at any export scale, not just the first book we saw."""

import unittest

from parser import find_courts


class FakePage:
    def __init__(self, rects):
        self.rects = rects


def rect(x0, top, w, h):
    return {"x0": x0, "x1": x0 + w, "top": top, "bottom": top + h}


def diagram(x0, top, w, h):
    """A FastDraw diagram: the court, inside a taller frame, under a name box."""
    return [
        rect(x0 - 0.10 * w, top - 0.06 * h, 1.20 * w, 1.11 * h),  # frame, aspect ~1.15
        rect(x0, top, w, h),                                       # court, aspect ~1.06
        rect(x0, top - 0.45 * h, 0.24 * w, 0.40 * h),              # name box, aspect ~0.62
    ]


class FindCourtsTest(unittest.TestCase):
    def test_six_small_diagrams(self):
        """The original book: 139 x 131pt courts, three across."""
        rects = []
        for row in range(2):
            for col in range(3):
                rects += diagram(50 + col * 180, 100 + row * 200, 139, 131)
        courts = find_courts(FakePage(rects))
        self.assertEqual(len(courts), 6)
        for c in courts:
            self.assertAlmostEqual(c["x1"] - c["x0"], 139, places=3)

    def test_two_large_diagrams(self):
        """The same court drawn at nearly twice the size, two per page."""
        rects = diagram(40, 80, 258, 243) + diagram(40, 400, 258, 243)
        courts = find_courts(FakePage(rects))
        self.assertEqual(len(courts), 2)
        self.assertAlmostEqual(courts[0]["x1"] - courts[0]["x0"], 258, places=3)

    def test_reading_order(self):
        """Row-major: left to right, then down."""
        rects = (
            diagram(400, 100, 139, 131)
            + diagram(50, 100, 139, 131)
            + diagram(50, 400, 139, 131)
        )
        courts = find_courts(FakePage(rects))
        self.assertEqual([round(c["x0"]) for c in courts], [50, 400, 50])
        self.assertEqual([round(c["top"]) for c in courts], [100, 100, 400])

    def test_the_frame_is_not_a_court(self):
        courts = find_courts(FakePage(diagram(50, 100, 139, 131)))
        self.assertEqual(len(courts), 1)
        self.assertAlmostEqual(courts[0]["bottom"] - courts[0]["top"], 131, places=3)

    def test_a_duplicated_boundary_counts_once(self):
        """FastDraw draws the court boundary twice; two rects, one diagram."""
        rects = diagram(50, 100, 139, 131) + [rect(50, 100, 139, 131)]
        self.assertEqual(len(find_courts(FakePage(rects))), 1)

    def test_a_page_with_no_diagrams(self):
        self.assertEqual(find_courts(FakePage([rect(0, 0, 20, 30)])), [])


if __name__ == "__main__":
    unittest.main()
