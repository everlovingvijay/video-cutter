"""
Baseline Unit Tests for VidCut Omni Cutter & Geometry Logic
Tests temporal slicing, remainder handling, equal parts, and filter generation.
"""

import math
import sys
import unittest
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import cutter


class TestBaselineCutter(unittest.TestCase):
    def test_calculate_segments_exact_duration(self):
        """Verify 60s video with 10s duration produces exactly six 10s clips."""
        segments = cutter.calculate_segments(60.0, segment_duration=10.0, remainder_policy="keep")
        self.assertEqual(len(segments), 6)
        expected = [
            (0.0, 10.0, 10.0),
            (10.0, 20.0, 10.0),
            (20.0, 30.0, 10.0),
            (30.0, 40.0, 10.0),
            (40.0, 50.0, 10.0),
            (50.0, 60.0, 10.0),
        ]
        for (start, end, dur), (exp_start, exp_end, exp_dur) in zip(segments, expected):
            self.assertAlmostEqual(start, exp_start, places=3)
            self.assertAlmostEqual(end, exp_end, places=3)
            self.assertAlmostEqual(dur, exp_dur, places=3)

    def test_calculate_segments_remainder_keep(self):
        """Verify 65s video with 10s duration keeps the final 5s remainder clip."""
        segments = cutter.calculate_segments(65.0, segment_duration=10.0, remainder_policy="keep")
        self.assertEqual(len(segments), 7)
        self.assertAlmostEqual(segments[-1][0], 60.0, places=3)
        self.assertAlmostEqual(segments[-1][1], 65.0, places=3)
        self.assertAlmostEqual(segments[-1][2], 5.0, places=3)

    def test_calculate_segments_remainder_merge(self):
        """Verify 65s video with 10s duration merges 5s into previous clip (15s)."""
        segments = cutter.calculate_segments(65.0, segment_duration=10.0, remainder_policy="merge")
        self.assertEqual(len(segments), 6)
        self.assertAlmostEqual(segments[-1][0], 50.0, places=3)
        self.assertAlmostEqual(segments[-1][1], 65.0, places=3)
        self.assertAlmostEqual(segments[-1][2], 15.0, places=3)

    def test_calculate_segments_remainder_discard(self):
        """Verify 65s video with 10s duration discards the final remainder clip."""
        segments = cutter.calculate_segments(65.0, segment_duration=10.0, remainder_policy="discard")
        self.assertEqual(len(segments), 6)
        self.assertAlmostEqual(segments[-1][1], 60.0, places=3)

    def test_calculate_segments_equal_parts(self):
        """Verify 60s video divided into 4 parts produces four 15s clips."""
        segments = cutter.calculate_segments(60.0, parts=4)
        self.assertEqual(len(segments), 4)
        for i, (start, end, dur) in enumerate(segments):
            self.assertAlmostEqual(start, i * 15.0, places=3)
            self.assertAlmostEqual(end, (i + 1) * 15.0, places=3)
            self.assertAlmostEqual(dur, 15.0, places=3)

    def test_build_filter_orientation(self):
        """Verify filter graph for 9:16 portrait blurred background."""
        vf = cutter.build_filter("9:16", fit_mode="blur", target_res="1080p")
        self.assertIsNotNone(vf)
        self.assertIn("boxblur", vf)
        self.assertIn("scale=1080:1920", vf)
        self.assertIn("overlay", vf)

        # Original returns None (no filter copy)
        self.assertIsNone(cutter.build_filter("original", fit_mode="blur"))


if __name__ == "__main__":
    unittest.main()
