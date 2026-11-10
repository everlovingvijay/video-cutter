# 🎬 VidCut Omni Studio: Lightweight Client-Side Video Editing Suite

> **Fast, 100% Client-Side Multi-Tool Video Editor, Auto-Splitter & Watermark Suite**  
> Complete video editing suite running entirely in the browser: **Filter Presets** (Grayscale, 35mm Film Grain, Olden Days, Future Cyberpunk, Film Noir), **Motion Zoom & Camera Effects** (Ken Burns zoom in/out, line zoom, camera shake), **Transitions** (fade in/out, impact flash), **Interactive Blur Brush** (selectively blur logos, faces, or watermarks), **Speed & Volume Controls**, **Screen/Webcam Recorder**, **Auto Cutter & Slicer** with 9:16 vertical conversion, **Spatial Grid Slicing (3×3 / 2×2 / 4×4)**, **Multi-Clip Video Joiner**, and an **Imperceptible Keyed Watermark Studio with Independent In-Browser Detector**.

🚀 **Live on GitHub Pages**: [https://everlovingvijay.github.io/video-cutter/](https://everlovingvijay.github.io/video-cutter/)  
🔒 **100% Private**: Zero video uploads, zero server processing, zero GPU overhead. Everything runs locally in your browser.

---

## ✨ Omni Studio Modules

### 1. 🎨 Omni Video Editor
- **Aesthetic Filter Presets**:
  - **Grayscale**: Clean timeless black & white.
  - **Fine Grain (35mm Film)**: Procedural film grain noise overlay with rich contrast.
  - **Olden Days (1920s)**: Warm aged sepia, faded blacks, and vintage vignette.
  - **Future (Cyberpunk)**: Electric neon tones, cyan/magenta hue shifts, and punchy contrast.
  - **Film Noir**: High-contrast dramatic black & white with deep shadows.
  - **Vintage & Cyberpunk**: Warm analog tones and neon aesthetics.
- **Fine-Tuning Sliders**: Manual Brightness, Contrast, Saturation, Sepia, and Hue Rotate adjustments.
- **Motion & Camera Zoom**:
  - **Slow Zoom In**: Ken Burns smooth zoom from $1.0\times \to 1.25\times$.
  - **Slow Zoom Out**: Smooth pull-back from $1.25\times \to 1.0\times$.
  - **Line Zoom**: Dynamic rhythmic zoom pulse.
  - **Pan Left-Right**: Cinematic horizontal camera tracking.
  - **Camera Shake**: Handheld organic camera drift.
- **Transitions**: Fade In from Black, Fade Out, Fade In & Out, Impact Flash Dip to White.

### 2. 🖌️ Interactive Frosted Glass Blur Brush & Mask
- Paint blur directly onto the video canvas using your mouse or touch.
- Selectively blur **watermarks, channel logos, faces, license plates, or private text**.
- Adjustable **Brush Size** ($10\text{px} - 100\text{px}$), **Blur Intensity** ($6\text{px} - 45\text{px}$), and **Frosted Sheen** ($0\% - 20\%$).
- **Box Blur Mode**: Click and drag a rectangle to blur corner logos in one action.
- Zero GPU strain: uses native HTML5 Canvas 2D alpha mask compositing. Set frosted sheen to 0% for pure optical glass blur without white paint.

### 3. ✂️ Auto Cutter & Slicer
- **Temporal Slicing**:
  - Slices long videos (e.g. 60 seconds) into shorter segments (e.g. six 10-second clips) automatically.
  - Equal parts mode (e.g. divide into 4 equal clips).
  - Remainder handling policies: `Keep`, `Merge`, or `Discard`.
- **Spatial Grid Slicing (Phase 4)**:
  - Divides video frames spatially into $3 \times 3$ (9 tiles), $2 \times 2$ (4 tiles), or $4 \times 4$ (16 tiles).
  - **Exact integer partitioning math**: distributes remainder pixels deterministically so that $\sum w_i = W$ and $\sum h_j = H$ with zero pixel gap and zero overlap.
  - Exports each tile as an individual video clip or batch ZIP download.
- Social media orientation switching:
  - **9:16 Portrait** (TikTok, YouTube Shorts, Instagram Reels)
  - **1:1 Square** (Instagram Feed, LinkedIn)
  - **16:9 Landscape** (YouTube, Desktop)
  - **4:5 Social Feed**
- Framing styles: **Blurred Background (Fit & Blur)**, **Smart Center Crop**, or **Letterbox**.
- Single-click **"Download All as ZIP"**.

### 4. 🔗 Merge & Rejoin Videos
- Client-side sequence concatenation of multiple video files or previously sliced grid tiles.
- Reorder clips with drag-and-drop or list management.
- Exports a unified seamless continuous video file.

### 5. 📐 Crop, Rotate & Flip Studio
- 90°, 180°, and 270° instant rotation.
- Horizontal and Vertical mirror flip.

### 6. ⚡ Speed & Audio Studio
- Adjust playback speed from **0.25x Slow Motion** to **3.0x Fast Forward**.
- Volume booster from **0% to 250%** and 1-click **Mute Audio**.

### 7. 📹 Screen & Camera Recorder
- Native in-browser screen capture (`getDisplayMedia`) and webcam recording (`getUserMedia`).
- Automatically loads the recorded clip straight into the Omni Studio editor for immediate styling, brushing, or cutting.

### 8. 🛡️ Watermark Studio & Independent Verifier
- **Imperceptible Keyed Watermark**:
  - **Spatial Luminance Perturbation (MVP)**: Keyed pseudo-random differential luminance modulation ($Y' = Y \pm \Delta$) with high spatial and temporal repetition.
  - **8x8 Block-DCT Mid-Frequency QIM (Robust)**: Discrete Cosine Transform modulating mid-frequency AC coefficient pairs (e.g. $(3, 2)$ vs $(2, 3)$) with **Hamming(7, 4) Error Correction Code (SEC-DED)**.
  - 64-bit packed binary payload: Version (8b), Watermark ID (32b), Flags (8b), and **CRC16-CCITT integrity checksum** (16b).
  - Keyed with deterministic PRNG (MurmurHash3 + Mulberry32) seeded by your private secret key.
- **Independent In-Browser Detector**:
  - Operates purely on the exported video file—**does not require the original media**.
  - Decodes sample frames onto offscreen canvas, extracts pixel differences / DCT likelihoods, performs Hamming syndrome error correction, and checks CRC-16 validity.
  - **False-Positive Controls**: Computes statistical $Z$-score ($\sigma$) and correlation metrics.
  - **Verdict Badges**:
    - `✅ Verified (Watermark Detected)`: Valid CRC-16 + significant statistical correlation ($Z \ge 2.8\sigma$).
    - `⚠️ Inconclusive`: Elevated correlation but failed CRC, or CRC match with low statistical confidence (never guesses!).
    - `❌ Watermark Not Detected`: Negative control, wrong key, or unwatermarked video.
- **Visual Difference Inspector**:
  - Toggle between Original Frame, Watermarked Frame, and **30× Amplified Luminance Delta** to visually inspect the steganographic pattern.
- **Security & Limitations**:
  - 🔐 *Key Confidentiality*: The watermark cannot be extracted or verified without the exact secret key.
  - ⚠️ *Robustness Boundaries*: Imperceptible watermarks survive native browser exports, format remuxing, and moderate temporal trimming. Severe downscaling or heavy lossy recompression may degrade the signal; the detector safely reports `Inconclusive` rather than giving false positives.

### 9. 💾 Non-Destructive Edit Graph (Schema v1.0)
- Complete non-destructive timeline representation (`js/edit-graph.js`).
- "💾 Save Project JSON" / "📂 Load Project JSON" buttons to serialize and restore projects anytime.

---

## 🧪 Automated QA & Test Suite

VidCut Omni Studio includes a comprehensive unit and integration QA suite:

| Test File | Domain | Assertions | Status |
| :--- | :--- | :---: | :---: |
| `tests/unit/test_baseline.py` | Slicing, Remainder, Aspect Filters | 6 tests | ✅ PASS |
| `tests/unit/test_edit_graph.py` | EditGraph Schema v1.0, JSON Roundtrip, Validation | 6 tests | ✅ PASS |
| `tests/unit/test_watermark.py` | CRC16-CCITT, 64-bit Payload, PRNG, Spatial Simulation | 6 tests | ✅ PASS |
| `tests/unit/test_dct_watermark.py` | 8x8 2D-DCT/IDCT Invertibility, AC Modulation, Hamming(7,4) | 3 tests | ✅ PASS |
| `tests/unit/test_cutter_grid.py` | Exact Integer Pixel Partitioning, Boundary Rounding | 3 tests | ✅ PASS |
| `tests/runner.html` | Browser In-DOM Suite (VideoEngine, EditGraph, Watermark) | 17 tests | ✅ PASS |

To run the Python test suite:
```bash
/Users/vijays/.local/share/uv/python/cpython-3.12-macos-aarch64-none/bin/python3.12 -m unittest discover tests/unit
```

To run the In-Browser test suite:
Open `tests/runner.html` in any browser and click **▶️ Run Browser Unit Tests**.

---

## 🖥️ Local Run

Simply open `index.html` in any modern web browser or start a local server:
```bash
python3 -m http.server 8000
```
Then visit: `http://localhost:8000`

---

## 📄 License
MIT License &copy; 2026 [Vijay S](https://github.com/everlovingvijay). Free and open-source.
