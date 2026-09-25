#!/usr/bin/env python3
"""
🎬 Video Cutter & Orientation Converter CLI
Splits long videos into shorter segments with automated duration calculation,
orientation conversion (9:16 Portrait, 1:1 Square, 16:9 Landscape),
and framing modes (Blurred Background, Smart Crop, Letterbox).
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys


def check_ffmpeg():
    """Verify ffmpeg is installed and accessible."""
    if not shutil.which("ffmpeg"):
        print("❌ Error: 'ffmpeg' binary was not found in your PATH.")
        print("Please install ffmpeg (e.g. 'brew install ffmpeg' or 'sudo apt install ffmpeg').")
        sys.exit(1)


def get_video_info(input_file):
    """Retrieve video duration, width, and height using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,duration:format=duration",
        "-of", "json",
        input_file
    ]
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, text=True)
        data = json.loads(result.stdout)
        stream = data.get("streams", [{}])[0]
        fmt = data.get("format", {})

        width = int(stream.get("width", 1920))
        height = int(stream.get("height", 1080))
        duration_str = stream.get("duration") or fmt.get("duration")
        if not duration_str:
            raise ValueError("Unable to determine video duration.")
        duration = float(duration_str)
        return {"width": width, "height": height, "duration": duration}
    except Exception as e:
        print(f"❌ Error inspecting video {input_file}: {e}")
        sys.exit(1)


def calculate_segments(total_duration, segment_duration=None, parts=None, remainder_policy="keep"):
    """Calculate [start, end, duration] intervals."""
    if parts:
        seg_len = total_duration / parts
        segments = []
        for i in range(parts):
            start = i * seg_len
            end = min(total_duration, (i + 1) * seg_len)
            segments.append((start, end, end - start))
        return segments

    if not segment_duration or segment_duration <= 0:
        segment_duration = 10.0

    count = int(math.ceil(total_duration / segment_duration))
    segments = []
    for i in range(count):
        start = i * segment_duration
        end = min(total_duration, (i + 1) * segment_duration)
        seg_dur = end - start

        # Remainder handling
        if i == count - 1 and seg_dur < segment_duration and len(segments) > 0:
            if remainder_policy == "merge":
                prev_start, _, _ = segments.pop()
                segments.append((prev_start, total_duration, total_duration - prev_start))
                break
            elif remainder_policy == "discard":
                break

        if seg_dur > 0.05:
            segments.append((start, end, seg_dur))

    return segments


def build_filter(target_aspect, fit_mode, target_res="1080p"):
    """
    Generate the ffmpeg filter complex for the chosen orientation and framing style.
    target_aspect: '9:16', '1:1', '16:9', '4:5', or None
    fit_mode: 'blur', 'crop', 'fit'
    """
    if not target_aspect or target_aspect == "original":
        return None

    resolutions = {
        "9:16": {"1080p": (1080, 1920), "720p": (720, 1280)},
        "1:1":  {"1080p": (1080, 1080), "720p": (720, 720)},
        "16:9": {"1080p": (1920, 1080), "720p": (1280, 720)},
        "4:5":  {"1080p": (1080, 1350), "720p": (720, 900)},
    }

    w, h = resolutions.get(target_aspect, {}).get(target_res, (1080, 1920))

    if fit_mode == "blur":
        # Background: scale to fill canvas and blur. Foreground: scale to fit and overlay centered.
        return (
            f"[0:v]split=2[bg][fg];"
            f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=25:5[blurred];"
            f"[fg]scale={w}:{h}:force_original_aspect_ratio=decrease[sharp];"
            f"[blurred][sharp]overlay=(W-w)/2:(H-h)/2"
        )
    elif fit_mode == "crop":
        # Scale to fill canvas and crop center
        return f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
    else:  # 'fit' / letterbox
        # Scale to fit canvas and pad with black
        return f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black"


def cut_video(input_file, output_dir, segment_duration, parts, orientation, fit_mode, remainder_policy):
    """Slice video into segments and convert orientation."""
    check_ffmpeg()
    info = get_video_info(input_file)
    total_dur = info["duration"]
    print(f"🎬 Source Video: {input_file}")
    print(f"⏱️  Duration: {total_dur:.2f}s | Resolution: {info['width']}x{info['height']}")

    segments = calculate_segments(total_dur, segment_duration, parts, remainder_policy)
    print(f"✂️  Splitting into {len(segments)} segments...")

    os.makedirs(output_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    vf = build_filter(orientation, fit_mode)

    generated_files = []
    for idx, (start, end, dur) in enumerate(segments, start=1):
        out_name = f"{base_name}_part_{idx:02d}_{orientation or 'orig'}.mp4"
        out_path = os.path.join(output_dir, out_name)
        print(f"   [{idx}/{len(segments)}] {start:.2f}s -> {end:.2f}s ({dur:.2f}s) -> {out_name}...")

        cmd = ["ffmpeg", "-y", "-ss", f"{start:.3f}", "-i", input_file, "-t", f"{dur:.3f}"]
        if vf:
            cmd.extend(["-filter_complex", vf])
            cmd.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "22", "-c:a", "aac", "-b:a", "192k"])
        else:
            # Lossless stream copy if no filter is required
            cmd.extend(["-c", "copy"])

        cmd.append(out_path)
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
        generated_files.append(out_path)

    print("\n✅ Successfully generated all segments:")
    for f in generated_files:
        size_mb = os.path.getsize(f) / (1024 * 1024)
        print(f"   - {f} ({size_mb:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Auto Video Cutter & Orientation Converter")
    parser.add_argument("input", help="Path to input video file")
    parser.add_argument("-d", "--duration", type=float, default=10.0, help="Duration of each segment in seconds (default: 10)")
    parser.add_argument("-p", "--parts", type=int, help="Divide into N equal parts instead of fixed duration")
    parser.add_argument("-o", "--orientation", choices=["9:16", "1:1", "16:9", "4:5", "original"], default="9:16",
                        help="Target orientation (default: 9:16 Portrait for Shorts/Reels/TikTok)")
    parser.add_argument("-f", "--fit", choices=["blur", "crop", "fit"], default="blur",
                        help="Framing mode: blur (blurred background), crop (center crop), fit (letterbox)")
    parser.add_argument("-r", "--remainder", choices=["keep", "merge", "discard"], default="keep",
                        help="Remainder segment policy: keep, merge, or discard")
    parser.add_argument("--output-dir", default="./output", help="Directory to save cut videos")

    args = parser.parse_args()
    cut_video(args.input, args.output_dir, args.duration, args.parts, args.orientation, args.fit, args.remainder)


if __name__ == "__main__":
    main()
