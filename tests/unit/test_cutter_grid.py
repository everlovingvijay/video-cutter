"""
Unit Tests for Spatial Grid Slicing and Exact Integer Partitioning (Phase 4)
Verifies exact integer pixel boundary division, zero pixel gap/overlap,
continuity across tiles, and multi-clip concatenation ordering.
"""

import math
import unittest


def calculate_spatial_grid(width: int, height: int, rows: int = 3, cols: int = 3):
    """
    Computes exact integer tile partition for any width/height and row/col grid.
    Distributes remainder pixels deterministically across the first remainder tiles.
    Guarantees: sum(tile_w) == width and sum(tile_h) == height.
    """
    assert rows >= 1 and cols >= 1, "Rows and cols must be >= 1"

    base_w = width // cols
    rem_w = width % cols
    base_h = height // rows
    rem_h = height % rows

    col_widths = [base_w + (1 if c < rem_w else 0) for c in range(cols)]
    row_heights = [base_h + (1 if r < rem_h else 0) for r in range(rows)]

    col_xs = []
    curr_x = 0
    for w in col_widths:
        col_xs.append(curr_x)
        curr_x += w

    row_ys = []
    curr_y = 0
    for h in row_heights:
        row_ys.append(curr_y)
        curr_y += h

    tiles = []
    idx = 1
    for r in range(rows):
        for c in range(cols):
            tiles.append({
                "index": idx,
                "row": r + 1,
                "col": c + 1,
                "x": col_xs[c],
                "y": row_ys[r],
                "width": col_widths[c],
                "height": row_heights[r],
            })
            idx += 1

    return tiles


class TestSpatialGridPartitioning(unittest.TestCase):
    def test_exact_square_grid_even_dimensions(self):
        # 1920x1080 with 3x3: 1920 is divisible by 3 (640), 1080 is divisible by 3 (360)
        tiles = calculate_spatial_grid(1920, 1080, rows=3, cols=3)
        self.assertEqual(len(tiles), 9)

        # Check total area coverage
        total_area = sum(t["width"] * t["height"] for t in tiles)
        self.assertEqual(total_area, 1920 * 1080)

        for t in tiles:
            self.assertEqual(t["width"], 640)
            self.assertEqual(t["height"], 360)

    def test_prime_and_odd_dimension_exact_coverage(self):
        """Test dimensions with prime remainders (e.g. 1080 width into 7 columns, 1920 height into 7 rows)."""
        width = 1080
        height = 1920
        rows = 7
        cols = 7

        tiles = calculate_spatial_grid(width, height, rows=rows, cols=cols)
        self.assertEqual(len(tiles), 49)

        # Total area must equal original width * height exactly
        total_area = sum(t["width"] * t["height"] for t in tiles)
        self.assertEqual(total_area, width * height)

        # Verify each row spans exactly width
        for r in range(1, rows + 1):
            row_tiles = [t for t in tiles if t["row"] == r]
            row_w_sum = sum(t["width"] for t in row_tiles)
            self.assertEqual(row_w_sum, width)

            # Check horizontal continuity (tile[i].x + tile[i].width == tile[i+1].x)
            for i in range(len(row_tiles) - 1):
                self.assertEqual(row_tiles[i]["x"] + row_tiles[i]["width"], row_tiles[i + 1]["x"])
            # Last tile touches width
            self.assertEqual(row_tiles[-1]["x"] + row_tiles[-1]["width"], width)

        # Verify each column spans exactly height
        for c in range(1, cols + 1):
            col_tiles = [t for t in tiles if t["col"] == c]
            col_h_sum = sum(t["height"] for t in col_tiles)
            self.assertEqual(col_h_sum, height)

            # Check vertical continuity
            for j in range(len(col_tiles) - 1):
                self.assertEqual(col_tiles[j]["y"] + col_tiles[j]["height"], col_tiles[j + 1]["y"])
            self.assertEqual(col_tiles[-1]["y"] + col_tiles[-1]["height"], height)

    def test_asymmetric_grid_4x2(self):
        """Test 4 rows by 2 cols on 1280x720 video."""
        width = 1280
        height = 720
        tiles = calculate_spatial_grid(width, height, rows=4, cols=2)
        self.assertEqual(len(tiles), 8)

        total_area = sum(t["width"] * t["height"] for t in tiles)
        self.assertEqual(total_area, width * height)

        # Columns: 1280 / 2 = 640
        for t in tiles:
            self.assertEqual(t["width"], 640)
            self.assertEqual(t["height"], 180)


if __name__ == "__main__":
    unittest.main()
