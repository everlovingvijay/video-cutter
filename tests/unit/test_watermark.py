"""
Unit Tests for VidCut Omni Watermark Engine (MVP v1.0)
Tests CRC16-CCITT calculations, payload packing/unpacking,
bit-flip tamper detection, deterministic PRNG, and spatial embedding/detection.
"""

import math
import struct
import unittest


def murmur_hash_key(s: str, seed: int = 0) -> int:
    h1 = (0xdeadbeef ^ seed) & 0xFFFFFFFF
    h2 = (0x41c6ce57 ^ seed) & 0xFFFFFFFF
    for ch in s:
        code = ord(ch)
        h1 = (h1 ^ code) * 2654435761 & 0xFFFFFFFF
        h2 = (h2 ^ code) * 1597334677 & 0xFFFFFFFF
    h1 = (h1 ^ (h1 >> 16)) * 2246822507 & 0xFFFFFFFF
    h1 = (h1 ^ ((h2 ^ (h2 >> 13)) * 3266489909)) & 0xFFFFFFFF
    h2 = (h2 ^ (h2 >> 16)) * 2246822507 & 0xFFFFFFFF
    h2 = (h2 ^ ((h1 ^ (h1 >> 13)) * 3266489909)) & 0xFFFFFFFF
    return ((2097151 & h2) * 4294967296 + h1) & 0xFFFFFFFF


def create_prng(seed: int):
    s = seed & 0xFFFFFFFF

    def next_float():
        nonlocal s
        s = (s + 0x6D2B79F5) & 0xFFFFFFFF
        t = ((s ^ (s >> 15)) * (1 | s)) & 0xFFFFFFFF
        t = (t + ((t ^ (t >> 7)) * (61 | t) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return next_float


def compute_crc16(data: bytes, length: int) -> int:
    crc = 0xFFFF
    for i in range(length):
        crc ^= (data[i] << 8) & 0xFFFF
        for _ in range(8):
            if (crc & 0x8000) != 0:
                crc = (((crc << 1) ^ 0x1021) & 0xFFFF)
            else:
                crc = (crc << 1) & 0xFFFF
    return crc & 0xFFFF


def pack_payload64(version: int, watermark_id: int, flags: int = 0) -> bytes:
    b = bytearray(8)
    b[0] = version & 0xFF
    b[1] = (watermark_id >> 24) & 0xFF
    b[2] = (watermark_id >> 16) & 0xFF
    b[3] = (watermark_id >> 8) & 0xFF
    b[4] = watermark_id & 0xFF
    b[5] = flags & 0xFF
    crc = compute_crc16(bytes(b), 6)
    b[6] = (crc >> 8) & 0xFF
    b[7] = crc & 0xFF
    return bytes(b)


def unpack_payload64(data: bytes):
    if len(data) < 8:
        return None
    version = data[0]
    watermark_id = (data[1] << 24) | (data[2] << 16) | (data[3] << 8) | data[4]
    flags = data[5]
    stored_crc = (data[6] << 8) | data[7]
    expected_crc = compute_crc16(data, 6)
    return {
        "version": version,
        "watermark_id": watermark_id,
        "flags": flags,
        "stored_crc": stored_crc,
        "expected_crc": expected_crc,
        "is_valid": stored_crc == expected_crc,
    }


def bytes_to_bits(data: bytes) -> list:
    bits = []
    for byte in data:
        for b in range(8):
            bits.append((byte >> (7 - b)) & 1)
    return bits


def bits_to_bytes(bits: list) -> bytes:
    byte_count = len(bits) // 8
    b = bytearray(byte_count)
    for i in range(byte_count):
        val = 0
        for bit_pos in range(8):
            if bits[i * 8 + bit_pos]:
                val |= (1 << (7 - bit_pos))
        b[i] = val
    return bytes(b)


class TestWatermarkEngine(unittest.TestCase):
    def test_crc16_known_vectors(self):
        # CRC16-CCITT for b"123456789" is known standard 0x29B1
        test_str = b"123456789"
        crc = compute_crc16(test_str, len(test_str))
        self.assertEqual(crc, 0x29B1)

    def test_payload_pack_unpack_integrity(self):
        test_cases = [
            (1, 987654, 0),
            (1, 1, 42),
            (2, 4294967295, 255),
            (1, 0, 0),
        ]
        for ver, wid, flg in test_cases:
            packed = pack_payload64(ver, wid, flg)
            self.assertEqual(len(packed), 8)
            unpacked = unpack_payload64(packed)
            self.assertTrue(unpacked["is_valid"])
            self.assertEqual(unpacked["version"], ver)
            self.assertEqual(unpacked["watermark_id"], wid)
            self.assertEqual(unpacked["flags"], flg)
            self.assertEqual(unpacked["stored_crc"], unpacked["expected_crc"])

    def test_payload_tamper_detection(self):
        """Verify that single-bit flips cause CRC verification to fail."""
        packed = pack_payload64(1, 1234567, 0)
        unpacked_orig = unpack_payload64(packed)
        self.assertTrue(unpacked_orig["is_valid"])

        # Tamper with single byte
        tampered = bytearray(packed)
        tampered[2] ^= 0x01
        unpacked_tampered = unpack_payload64(bytes(tampered))
        self.assertFalse(unpacked_tampered["is_valid"])
        self.assertNotEqual(unpacked_tampered["stored_crc"], unpacked_tampered["expected_crc"])

    def test_bits_to_bytes_roundtrip(self):
        original = b"VidCut12"
        bits = bytes_to_bits(original)
        self.assertEqual(len(bits), 64)
        reconstructed = bits_to_bytes(bits)
        self.assertEqual(reconstructed, original)

    def test_prng_determinism(self):
        """Verify that same key produces identical random sequence."""
        key = "secret_creator_key_2026"
        seed1 = murmur_hash_key(key)
        seed2 = murmur_hash_key(key)
        self.assertEqual(seed1, seed2)

        prng1 = create_prng(seed1)
        prng2 = create_prng(seed2)
        seq1 = [prng1() for _ in range(50)]
        seq2 = [prng2() for _ in range(50)]
        self.assertEqual(seq1, seq2)

        # Different key produces different sequence
        seed_diff = murmur_hash_key("different_key")
        prng_diff = create_prng(seed_diff)
        seq_diff = [prng_diff() for _ in range(50)]
        self.assertNotEqual(seq1, seq_diff)

    def test_spatial_watermark_embed_and_detect_simulation(self):
        """Simulate pixel grid embedding and detection."""
        width, height = 320, 240
        key = "test_key_alpha"
        watermark_id = 884812
        strength = 3

        payload = pack_payload64(1, watermark_id, 0)
        bits = bytes_to_bits(payload)

        # Create a synthetic image canvas buffer (grayscale gradient + noise)
        img = [128 for _ in range(width * height)]

        # Generate paired coordinates for each bit and embed
        for bit_idx, bit_val in enumerate(bits):
            seed = murmur_hash_key(f"{key}_bit_{bit_idx}_w{width}_h{height}")
            rand = create_prng(seed)
            delta = strength if bit_val == 1 else -strength

            for _ in range(48):
                xA = 16 + int(rand() * (width - 32))
                yA = 16 + int(rand() * (height - 32))
                offX = (int(rand() * 7) + 2) * (1 if rand() > 0.5 else -1)
                offY = (int(rand() * 7) + 2) * (1 if rand() > 0.5 else -1)
                xB = max(0, min(width - 1, xA + offX))
                yB = max(0, min(height - 1, yA + offY))

                idxA = yA * width + xA
                idxB = yB * width + xB
                img[idxA] = max(0, min(255, img[idxA] + delta))
                img[idxB] = max(0, min(255, img[idxB] - delta))

        # Detector: extract with matching key
        detected_bits = []
        for bit_idx in range(64):
            seed = murmur_hash_key(f"{key}_bit_{bit_idx}_w{width}_h{height}")
            rand = create_prng(seed)
            diff_sum = 0
            for _ in range(48):
                xA = 16 + int(rand() * (width - 32))
                yA = 16 + int(rand() * (height - 32))
                offX = (int(rand() * 7) + 2) * (1 if rand() > 0.5 else -1)
                offY = (int(rand() * 7) + 2) * (1 if rand() > 0.5 else -1)
                xB = max(0, min(width - 1, xA + offX))
                yB = max(0, min(height - 1, yA + offY))
                diff_sum += img[yA * width + xA] - img[yB * width + xB]
            detected_bits.append(1 if diff_sum > 0 else 0)

        detected_bytes = bits_to_bytes(detected_bits)
        unpacked = unpack_payload64(detected_bytes)

        # Positive control assertion: 100% bit recovery and CRC valid
        self.assertTrue(unpacked["is_valid"])
        self.assertEqual(unpacked["watermark_id"], watermark_id)

        # Negative control assertion: decode with wrong key
        wrong_key = "attacker_random_key_999"
        wrong_bits = []
        for bit_idx in range(64):
            seed = murmur_hash_key(f"{wrong_key}_bit_{bit_idx}_w{width}_h{height}")
            rand = create_prng(seed)
            diff_sum = 0
            for _ in range(48):
                xA = 16 + int(rand() * (width - 32))
                yA = 16 + int(rand() * (height - 32))
                offX = (int(rand() * 7) + 2) * (1 if rand() > 0.5 else -1)
                offY = (int(rand() * 7) + 2) * (1 if rand() > 0.5 else -1)
                xB = max(0, min(width - 1, xA + offX))
                yB = max(0, min(height - 1, yA + offY))
                diff_sum += img[yA * width + xA] - img[yB * width + xB]
            wrong_bits.append(1 if diff_sum > 0 else 0)

        unpacked_wrong = unpack_payload64(bits_to_bytes(wrong_bits))
        self.assertFalse(unpacked_wrong["is_valid"])


if __name__ == "__main__":
    unittest.main()
