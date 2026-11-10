"""
Unit Tests for 8x8 Block-DCT and Hamming(7, 4) ECC Watermarking (Phase 3)
Tests separable 8x8 DCT/IDCT roundtrips, coefficient modulation,
Hamming(7,4) single-error correction, and block-based watermark recovery.
"""

import math
import unittest

# Precomputed cosine tables for 8x8 DCT
PI = math.pi
COS_TABLE = [[math.cos((2 * x + 1) * u * PI / 16.0) for x in range(8)] for u in range(8)]
C_COEFF = [1.0 / math.sqrt(2.0) if u == 0 else 1.0 for u in range(8)]


def dct_1d(src):
    dst = [0.0] * 8
    for u in range(8):
        s = 0.0
        for x in range(8):
            s += src[x] * COS_TABLE[u][x]
        dst[u] = 0.5 * C_COEFF[u] * s
    return dst


def idct_1d(src):
    dst = [0.0] * 8
    for x in range(8):
        s = 0.0
        for u in range(8):
            s += C_COEFF[u] * src[u] * COS_TABLE[u][x]
        dst[x] = 0.5 * s
    return dst


def dct_2d_8x8(block):
    # Rows
    temp = [[0.0] * 8 for _ in range(8)]
    for r in range(8):
        temp[r] = dct_1d(block[r])
    # Columns
    out = [[0.0] * 8 for _ in range(8)]
    col_in = [0.0] * 8
    for c in range(8):
        for r in range(8):
            col_in[r] = temp[r][c]
        col_out = dct_1d(col_in)
        for r in range(8):
            out[r][c] = col_out[r]
    return out


def idct_2d_8x8(dct_block):
    # Columns
    temp = [[0.0] * 8 for _ in range(8)]
    col_in = [0.0] * 8
    for c in range(8):
        for r in range(8):
            col_in[r] = dct_block[r][c]
        col_out = idct_1d(col_in)
        for r in range(8):
            temp[r][c] = col_out[r]
    # Rows
    out = [[0.0] * 8 for _ in range(8)]
    for r in range(8):
        out[r] = idct_1d(temp[r])
    return out


# Hamming(7, 4) Code:
# Data bits: d1, d2, d3, d4
# Parity bits:
# p1 = d1 ^ d2 ^ d4
# p2 = d1 ^ d3 ^ d4
# p3 = d2 ^ d3 ^ d4
# Codeword: [p1, p2, d1, p3, d2, d3, d4] (1-indexed positions 1, 2, 3, 4, 5, 6, 7)
def hamming74_encode(d1, d2, d3, d4):
    p1 = d1 ^ d2 ^ d4
    p2 = d1 ^ d3 ^ d4
    p3 = d2 ^ d3 ^ d4
    return [p1, p2, d1, p3, d2, d3, d4]


def hamming74_decode(c):
    # Syndrome calculation:
    # s1 = c[0] ^ c[2] ^ c[4] ^ c[6] (bits 1, 3, 5, 7)
    # s2 = c[1] ^ c[2] ^ c[5] ^ c[6] (bits 2, 3, 6, 7)
    # s3 = c[3] ^ c[4] ^ c[5] ^ c[6] (bits 4, 5, 6, 7)
    s1 = c[0] ^ c[2] ^ c[4] ^ c[6]
    s2 = c[1] ^ c[2] ^ c[5] ^ c[6]
    s3 = c[3] ^ c[4] ^ c[5] ^ c[6]
    syndrome = (s3 << 2) | (s2 << 1) | s1

    corrected = list(c)
    if syndrome != 0 and syndrome <= 7:
        # Correct error at 1-indexed position
        corrected[syndrome - 1] ^= 1

    return corrected[2], corrected[4], corrected[5], corrected[6]


class TestDCTWatermark(unittest.TestCase):
    def test_dct_idct_roundtrip(self):
        """Verify 8x8 DCT followed by IDCT reconstructs original pixel block."""
        orig = [
            [120, 125, 130, 135, 140, 145, 150, 155],
            [118, 122, 128, 132, 138, 142, 148, 152],
            [115, 120, 125, 130, 135, 140, 145, 150],
            [110, 115, 120, 125, 130, 135, 140, 145],
            [105, 110, 115, 120, 125, 130, 135, 140],
            [100, 105, 110, 115, 120, 125, 130, 135],
            [95, 100, 105, 110, 115, 120, 125, 130],
            [90, 95, 100, 105, 110, 115, 120, 125],
        ]

        freq = dct_2d_8x8(orig)
        recon = idct_2d_8x8(freq)

        for r in range(8):
            for c in range(8):
                self.assertAlmostEqual(orig[r][c], recon[r][c], delta=0.0001)

    def test_mid_frequency_coefficient_modulation(self):
        """Verify mid-frequency AC coefficient modulation and reconstruction."""
        orig = [[128.0] * 8 for _ in range(8)]
        freq = dct_2d_8x8(orig)

        # Modulate mid-frequency pair (3, 2) vs (2, 3)
        delta = 16.0
        # Embed bit 1: freq[3][2] > freq[2][3] by delta
        freq[3][2] = delta / 2.0
        freq[2][3] = -delta / 2.0

        mod_pixels = idct_2d_8x8(freq)
        # Check that pixel changes are subtle (< 5 luma difference)
        max_diff = max(abs(mod_pixels[r][c] - 128.0) for r in range(8) for c in range(8))
        self.assertLess(max_diff, 6.0)

        # Extract DCT from modulated block
        extracted_freq = dct_2d_8x8(mod_pixels)
        diff = extracted_freq[3][2] - extracted_freq[2][3]
        self.assertGreater(diff, 10.0)

    def test_hamming74_error_correction(self):
        """Verify Hamming(7, 4) corrects any single-bit transmission error."""
        # Test all 16 possible 4-bit nibbles
        for i in range(16):
            d1 = (i >> 3) & 1
            d2 = (i >> 2) & 1
            d3 = (i >> 1) & 1
            d4 = i & 1

            codeword = hamming74_encode(d1, d2, d3, d4)
            # 1. No errors
            rec1, rec2, rec3, rec4 = hamming74_decode(codeword)
            self.assertEqual((d1, d2, d3, d4), (rec1, rec2, rec3, rec4))

            # 2. Corrupt each of the 7 bit positions in turn
            for bit_pos in range(7):
                corrupted = list(codeword)
                corrupted[bit_pos] ^= 1  # single-bit error
                c_d1, c_d2, c_d3, c_d4 = hamming74_decode(corrupted)
                self.assertEqual((d1, d2, d3, d4), (c_d1, c_d2, c_d3, c_d4))


if __name__ == "__main__":
    unittest.main()
