"""
Unit Tests for VidCut Omni EditGraph (Schema v1.0)
Validates EditGraph structure, JSON roundtrip serialization,
segment slicing logic (keep, merge, discard, parts), and validation rules.
"""

import json
import unittest


class EditGraphPython:
    """Python reference implementation of EditGraph logic to test against."""

    def __init__(self, data=None):
        data = data or {}
        self.version = "1.0"
        self.source = {
            "name": data.get("source", {}).get("name", ""),
            "duration": data.get("source", {}).get("duration", 0),
            "width": data.get("source", {}).get("width", 1920),
            "height": data.get("source", {}).get("height", 1080),
            "fps": data.get("source", {}).get("fps", 30),
            "sizeBytes": data.get("source", {}).get("sizeBytes", 0),
            "hasAudio": data.get("source", {}).get("hasAudio", True),
        }
        self.timeline = {
            "inPoint": data.get("timeline", {}).get("inPoint", 0),
            "outPoint": data.get("timeline", {}).get("outPoint", self.source["duration"]),
            "speed": data.get("timeline", {}).get("speed", 1.0),
            "splitMode": data.get("timeline", {}).get("splitMode", "duration"),
            "splitDuration": data.get("timeline", {}).get("splitDuration", 10),
            "splitParts": data.get("timeline", {}).get("splitParts", 6),
            "remainderPolicy": data.get("timeline", {}).get("remainderPolicy", "keep"),
            "spatialGrid": {
                "enabled": data.get("timeline", {}).get("spatialGrid", {}).get("enabled", False),
                "rows": data.get("timeline", {}).get("spatialGrid", {}).get("rows", 3),
                "cols": data.get("timeline", {}).get("spatialGrid", {}).get("cols", 3),
            },
        }
        self.effects = {
            "orientation": data.get("effects", {}).get("orientation", "original"),
            "fitMode": data.get("effects", {}).get("fitMode", "blur"),
            "rotation": data.get("effects", {}).get("rotation", 0),
            "flipH": bool(data.get("effects", {}).get("flipH", False)),
            "flipV": bool(data.get("effects", {}).get("flipV", False)),
            "cropRect": data.get("effects", {}).get("cropRect", None),
            "filterPreset": data.get("effects", {}).get("filterPreset", "none"),
            "customFilters": {
                "brightness": data.get("effects", {}).get("customFilters", {}).get("brightness", 100),
                "contrast": data.get("effects", {}).get("customFilters", {}).get("contrast", 100),
                "saturation": data.get("effects", {}).get("customFilters", {}).get("saturation", 100),
                "sepia": data.get("effects", {}).get("customFilters", {}).get("sepia", 0),
                "hueRotate": data.get("effects", {}).get("customFilters", {}).get("hueRotate", 0),
            },
            "motion": {
                "type": data.get("effects", {}).get("motion", {}).get("type", "none"),
                "intensity": data.get("effects", {}).get("motion", {}).get("intensity", 1.0),
            },
            "transition": {
                "type": data.get("effects", {}).get("transition", {}).get("type", "none"),
                "duration": data.get("effects", {}).get("transition", {}).get("duration", 1.0),
            },
            "blurMask": {
                "enabled": bool(data.get("effects", {}).get("blurMask", {}).get("enabled", False)),
                "blurRadius": data.get("effects", {}).get("blurMask", {}).get("blurRadius", 20),
                "frostedSheen": data.get("effects", {}).get("blurMask", {}).get("frostedSheen", 0.05),
                "maskDataUrl": data.get("effects", {}).get("blurMask", {}).get("maskDataUrl", None),
            },
            "watermark": data.get("effects", {}).get("watermark", None),
        }
        self.audio = {
            "volume": data.get("audio", {}).get("volume", 1.0),
            "muted": bool(data.get("audio", {}).get("muted", False)),
        }
        self.exportSettings = {
            "resolution": data.get("exportSettings", {}).get("resolution", "1080p"),
            "fps": data.get("exportSettings", {}).get("fps", 30),
            "bitrate": data.get("exportSettings", {}).get("bitrate", 5000000),
            "format": data.get("exportSettings", {}).get("format", "auto"),
        }

    def get_segments(self):
        total_dur = (self.timeline["outPoint"] - self.timeline["inPoint"]) or self.source["duration"] or 1.0
        start_offset = self.timeline["inPoint"]

        if self.timeline["splitMode"] == "parts":
            parts = max(1, int(self.timeline["splitParts"]))
            seg_len = total_dur / parts
            segments = []
            for i in range(parts):
                s = start_offset + i * seg_len
                e = min(start_offset + total_dur, start_offset + (i + 1) * seg_len)
                segments.append({"index": i + 1, "start": round(s, 3), "end": round(e, 3), "duration": round(e - s, 3)})
            return segments

        seg_dur = max(0.5, float(self.timeline["splitDuration"]))
        import math
        count = math.ceil(total_dur / seg_dur)
        segments = []
        for i in range(count):
            s = start_offset + i * seg_dur
            e = min(start_offset + total_dur, start_offset + (i + 1) * seg_dur)
            dur = e - s

            if i == count - 1 and dur < seg_dur and len(segments) > 0:
                if self.timeline["remainderPolicy"] == "merge":
                    prev = segments.pop()
                    segments.append({
                        "index": prev["index"],
                        "start": prev["start"],
                        "end": round(e, 3),
                        "duration": round(e - prev["start"], 3),
                    })
                    break
                elif self.timeline["remainderPolicy"] == "discard":
                    break

            if dur > 0.05:
                segments.append({
                    "index": len(segments) + 1,
                    "start": round(s, 3),
                    "end": round(e, 3),
                    "duration": round(dur, 3),
                })

        return segments

    def to_json(self):
        return json.dumps({
            "schema": "vidcut-omni-editgraph-v1",
            "version": self.version,
            "source": self.source,
            "timeline": self.timeline,
            "effects": self.effects,
            "audio": self.audio,
            "exportSettings": self.exportSettings,
        }, indent=2)

    def validate(self):
        errors = []
        if self.timeline["inPoint"] < 0:
            errors.append("inPoint must be >= 0")
        if self.timeline["outPoint"] < self.timeline["inPoint"]:
            errors.append("outPoint must be >= inPoint")
        if self.timeline["speed"] <= 0:
            errors.append("speed must be > 0")
        if self.timeline["splitDuration"] <= 0:
            errors.append("splitDuration must be > 0")
        if self.timeline["splitParts"] < 1:
            errors.append("splitParts must be >= 1")
        return len(errors) == 0, errors


class TestEditGraph(unittest.TestCase):
    def test_default_initialization(self):
        graph = EditGraphPython()
        self.assertEqual(graph.version, "1.0")
        self.assertEqual(graph.timeline["splitDuration"], 10)
        self.assertEqual(graph.timeline["remainderPolicy"], "keep")
        self.assertEqual(graph.effects["orientation"], "original")
        self.assertEqual(graph.audio["volume"], 1.0)
        is_valid, errors = graph.validate()
        self.assertTrue(is_valid)

    def test_slicing_exact_60s_into_10s(self):
        graph = EditGraphPython({
            "source": {"duration": 60.0},
            "timeline": {"inPoint": 0, "outPoint": 60.0, "splitDuration": 10, "remainderPolicy": "keep"}
        })
        segs = graph.get_segments()
        self.assertEqual(len(segs), 6)
        for i, seg in enumerate(segs):
            self.assertEqual(seg["index"], i + 1)
            self.assertAlmostEqual(seg["start"], i * 10.0, places=3)
            self.assertAlmostEqual(seg["end"], (i + 1) * 10.0, places=3)
            self.assertAlmostEqual(seg["duration"], 10.0, places=3)

    def test_slicing_remainder_merge_and_discard(self):
        # Keep
        graph_keep = EditGraphPython({
            "source": {"duration": 65.0},
            "timeline": {"inPoint": 0, "outPoint": 65.0, "splitDuration": 10, "remainderPolicy": "keep"}
        })
        segs_keep = graph_keep.get_segments()
        self.assertEqual(len(segs_keep), 7)
        self.assertAlmostEqual(segs_keep[-1]["duration"], 5.0, places=3)

        # Merge
        graph_merge = EditGraphPython({
            "source": {"duration": 65.0},
            "timeline": {"inPoint": 0, "outPoint": 65.0, "splitDuration": 10, "remainderPolicy": "merge"}
        })
        segs_merge = graph_merge.get_segments()
        self.assertEqual(len(segs_merge), 6)
        self.assertAlmostEqual(segs_merge[-1]["duration"], 15.0, places=3)

        # Discard
        graph_discard = EditGraphPython({
            "source": {"duration": 65.0},
            "timeline": {"inPoint": 0, "outPoint": 65.0, "splitDuration": 10, "remainderPolicy": "discard"}
        })
        segs_discard = graph_discard.get_segments()
        self.assertEqual(len(segs_discard), 6)
        self.assertAlmostEqual(segs_discard[-1]["end"], 60.0, places=3)

    def test_slicing_equal_parts(self):
        graph = EditGraphPython({
            "source": {"duration": 60.0},
            "timeline": {"inPoint": 0, "outPoint": 60.0, "splitMode": "parts", "splitParts": 4}
        })
        segs = graph.get_segments()
        self.assertEqual(len(segs), 4)
        for i, seg in enumerate(segs):
            self.assertAlmostEqual(seg["start"], i * 15.0, places=3)
            self.assertAlmostEqual(seg["end"], (i + 1) * 15.0, places=3)
            self.assertAlmostEqual(seg["duration"], 15.0, places=3)

    def test_json_roundtrip(self):
        graph = EditGraphPython({
            "source": {"name": "test.mp4", "duration": 42.5, "width": 1920, "height": 1080},
            "effects": {
                "orientation": "9:16",
                "fitMode": "crop",
                "rotation": 90,
                "filterPreset": "future",
                "customFilters": {"brightness": 120, "contrast": 110, "saturation": 130, "sepia": 10, "hueRotate": 45},
                "motion": {"type": "zoom_in", "intensity": 1.25},
                "transition": {"type": "fade_in_out", "duration": 1.5},
                "blurMask": {"enabled": True, "blurRadius": 25, "frostedSheen": 0.08}
            },
            "audio": {"volume": 1.5, "muted": False}
        })

        json_str = graph.to_json()
        loaded = json.loads(json_str)
        self.assertEqual(loaded["schema"], "vidcut-omni-editgraph-v1")
        self.assertEqual(loaded["source"]["name"], "test.mp4")
        self.assertEqual(loaded["effects"]["orientation"], "9:16")
        self.assertEqual(loaded["effects"]["rotation"], 90)
        self.assertEqual(loaded["effects"]["filterPreset"], "future")
        self.assertEqual(loaded["effects"]["motion"]["type"], "zoom_in")
        self.assertEqual(loaded["effects"]["blurMask"]["blurRadius"], 25)
        self.assertEqual(loaded["audio"]["volume"], 1.5)

    def test_validation_rules(self):
        # Invalid in/out points
        invalid_graph = EditGraphPython({
            "timeline": {"inPoint": 10.0, "outPoint": 5.0, "speed": 1.0, "splitDuration": 10, "splitParts": 2}
        })
        is_valid, errors = invalid_graph.validate()
        self.assertFalse(is_valid)
        self.assertTrue(any("outPoint" in e for e in errors))

        # Invalid speed
        speed_graph = EditGraphPython({
            "timeline": {"inPoint": 0, "outPoint": 10.0, "speed": -0.5, "splitDuration": 10, "splitParts": 2}
        })
        is_valid, errors = speed_graph.validate()
        self.assertFalse(is_valid)
        self.assertTrue(any("speed" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
