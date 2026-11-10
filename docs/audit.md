# VidCut Omni: Phase 0 Repository Audit & Architectural Discovery

**Audit Date**: November 10, 2026  
**Target Repository**: `https://github.com/everlovingvijay/video-cutter`  
**Live Site**: `https://everlovingvijay.github.io/video-cutter/`  
**Auditor**: Antigravity Engineering & QA Lead  
**Specification Reference**: *VidCut Omni Antigravity Upgrade Blueprint v1.0*

---

## 1. Executive Summary

VidCut Omni is currently a single-page, 100% client-side web application hosted on GitHub Pages. It enables in-browser video manipulation using HTML5 Canvas 2D compositing, Web Audio API, and the `MediaRecorder` API. 

The primary goal of the upgrade is to integrate an **imperceptible, keyed pixel watermark** (both MVP spatial luminance perturbations and robust frequency-domain block-DCT QIM with ECC), an **independent in-browser verification detector**, a **unified non-destructive edit graph/export pipeline**, and **frame-accurate temporal/spatial grid slicing & rejoining**, all while strictly preserving existing functionality, zero-server privacy, and low compute footprint.

---

## 2. Source Tree Mapping & Build System

### 2.1 File Map

```
/Users/vijays/.gemini/antigravity/scratch/video-cutter/
├── .nojekyll                 # Bypasses Jekyll processing on GitHub Pages
├── index.html                # Main SPA markup, tool panels, stage & canvas overlays
├── README.md                 # Project documentation and deployment guide
├── cutter.py                 # Standalone Python CLI utility using FFmpeg/FFprobe
├── css/
│   └── styles.css            # Dark studio theme, layout, responsive design tokens
├── js/
│   ├── app.js                # UI state, event routing, tool orchestration, export dispatch
│   ├── video-engine.js       # Core frame renderer (drawFrame), filter pipeline, MediaRecorder exporter
│   └── jszip.min.js          # Bundled JSZip v3.10.1 (client-side ZIP packaging)
├── samples/                  # Baseline media samples directory (populated in Phase 0)
├── tests/                    # Unit, integration, and E2E verification test suites
└── docs/
    └── audit.md              # This Phase 0 discovery document
```

### 2.2 Build System & Runtime Dependencies
- **Build System**: None currently configured. The repository uses pure vanilla ES6 JavaScript modules loaded directly via standard `<script>` tags. There is no Webpack, Vite, or Babel bundling step.
- **Runtime Dependencies**:
  - `JSZip` (v3.10.1, bundled locally in `js/jszip.min.js`, 97.6 KB). Used for multi-clip ZIP downloads.
  - Native browser APIs: HTML5 `<video>`, `<canvas>`, Web Audio API (`AudioContext`, `createMediaElementSource`, `GainNode`, `createMediaStreamDestination`), `MediaRecorder`, `navigator.mediaDevices` (`getDisplayMedia`, `getUserMedia`).
- **Deployment**:
  - Hosted directly via **GitHub Pages** from the `main` branch (`/ (root)` path).
  - `.nojekyll` is present to ensure all subdirectories and assets are served raw without Jekyll processing.
  - CI/CD: Currently manual/API-driven git commits directly to `main`. No GitHub Actions workflows are present yet.

---

## 3. Verified Feature Matrix

Every feature was audited by inspecting actual code implementations rather than relying solely on UI labels.

| Feature Category | Feature Name | UI Element Present? | Underlying Code Implemented? | Operational Status | Audit Notes & Technical Assessment |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Ingestion** | Drag & Drop / File Picker | Yes | Yes | **Working** | Reads file as `Blob`, creates ObjectURL, sets `video.src`. |
| **Ingestion** | Public Video URL Fetch | Yes | Yes | **Working** | `fetch(url)` -> `blob` -> `File`. Requires CORS-enabled URL. |
| **Ingestion** | 60s Synthetic Demo Generator | Yes | Yes | **Working** | Synthesizes 60s 720p 30fps canvas pattern + 440Hz sine wave. |
| **Editor** | Grayscale Filter | Yes | Yes | **Working** | CSS filter `grayscale(100%)` on 2D canvas. |
| **Editor** | 35mm Fine Grain | Yes | Yes | **Working** | Procedural 256x256 noise tile tiled with random shift in `overlay` mode. |
| **Editor** | Olden Days (1920s) | Yes | Yes | **Working** | Sepia + contrast boost + radial vignette gradient + film grain. |
| **Editor** | Future (Cyberpunk) | Yes | Yes | **Working** | `hue-rotate(185deg) saturate(160%) contrast(135%)`. |
| **Editor** | Film Noir | Yes | Yes | **Working** | High contrast B&W `grayscale(100%) contrast(165%) brightness(80%)`. |
| **Editor** | Sliders (Brightness, Contrast, Sat) | Yes | Yes | **Working** | Parametric CSS filter concatenation. |
| **Motion** | Slow Zoom In (Ken Burns) | Yes | Yes | **Working** | Parametric scale $1.0\times \to 1.25\times$ over normalized progress $t \in [0, 1]$. |
| **Motion** | Slow Zoom Out | Yes | Yes | **Working** | Scale $1.25\times \to 1.0\times$. |
| **Motion** | Line Zoom Pulse | Yes | Yes | **Working** | $1.0 + 0.18 \cdot \sin(t \cdot 4\pi)$. |
| **Motion** | Horizontal Pan | Yes | Yes | **Working** | Offset translation across width. |
| **Motion** | Handheld Camera Shake | Yes | Yes | **Working** | Trigonometric sinusoidal perturbation ($\Delta x, \Delta y$). |
| **Transitions** | Fade In / Fade Out | Yes | Yes | **Working** | Alpha black rectangle overlaid based on timestamp. |
| **Transitions** | Impact Flash White | Yes | Yes | **Working** | Alpha white rectangle overlay at clip head. |
| **Blur Brush** | Frosted Glass Blur Mask | Yes | Yes | **Working** | Offscreen `blurBufferCanvas` clipped with user alpha mask; zero white paint. |
| **Blur Brush** | Box Blur Mode | Yes | Yes | **Working** | Rectangle drag fill on mask canvas. |
| **Transforms** | Rotation (90°, 180°, 270°) | Yes | Yes | **Working** | Canvas matrix rotate. |
| **Transforms** | Flip Horizontal / Vertical | Yes | Yes | **Working** | Canvas matrix scale $(-1, 1)$ or $(1, -1)$. |
| **Transforms** | Spatial Crop Bounding Box | Label | **No** | **Stubbed** | Only aspect ratio fits (9:16, 1:1, etc.) exist; custom arbitrary rect crop is missing. |
| **Cutter** | Temporal Slicing (Duration) | Yes | Yes | **Working** | Calculates exact intervals $[start, end]$; sequentially records each segment. |
| **Cutter** | Temporal Slicing (Equal Parts) | Yes | Yes | **Working** | Divides total duration into $N$ equal chunks. |
| **Cutter** | Remainder Handling | Yes | Yes | **Working** | Options: `keep`, `merge`, `discard`. |
| **Cutter** | Spatial Grid Cutting (3x3, etc.) | **No** | **No** | **Missing** | Required by Blueprint Section 6. |
| **Cutter** | Multi-clip Rejoining / Merging | Label | **No** | **Missing** | Required by Blueprint Section 6. |
| **Audio/Speed** | Playback Speed (0.25x - 3.0x) | Yes | Yes | **Working** | `video.playbackRate` adjustment. |
| **Audio/Speed** | Volume Gain & Mute | Yes | Yes | **Working** | Web Audio `GainNode` scaling ($0\% - 250\%$). |
| **Recorder** | Screen & Camera Capture | Yes | Yes | **Working** | `getDisplayMedia` / `getUserMedia` recorded to blob and loaded into editor. |
| **Watermark** | Watermark Embed & Verify | **No** | **No** | **Missing** | Core focus of Blueprint Sections 4 & 5. |

---

## 4. Frame Decode, Render, and Encode Pipeline Audit

### 4.1 Current Architecture

```
[HTML5 Video Element] (video.src = ObjectURL)
         │
         ▼ (video.currentTime seek + play())
[Offscreen Canvas / Stage Canvas] (2D Context)
         │  ├── Frame Transformations (Crop / Fit / Rotation / Flip)
         │  ├── CSS Filters (Grayscale, Noir, Future, etc.)
         │  ├── Procedural Grain & Vignette Overlay
         │  ├── Blur Mask Alpha Compositing (Destination-in)
         │  └── Transitions (Fade / Flash Overlay)
         ▼
[canvas.captureStream(30)] ───┬───> [Combined MediaStream]
                              │            │
[Web Audio Destination] ──────┘            ▼
                                    [MediaRecorder]
                                           │
                                           ▼ (ondataavailable chunks)
                                    [Blob: video/mp4 or video/webm]
```

### 4.2 Identified Bottlenecks & Failure Modes in Current Pipeline
1. **Real-time Playback Dependency**: Current export relies on `video.play()` and `requestAnimationFrame` drawing frames in real-time or at `playbackRate = 1.0`. If the client CPU/GPU experiences a frame drop or GC pause during recording, `MediaRecorder` receives dropped frames, causing stutter or duration drift.
2. **Audio Sync Drift**: `AudioContext.createMediaElementSource(video)` coupled with seeking during segmented export can produce small audio clock offsets ($\pm 50-120\text{ ms}$) at segment boundaries.
3. **Black Frame at Head**: Calling `recorder.start()` immediately after `seeked` without flushing a synchronous frame draw can result in an initial black frame in certain Chromium builds.
4. **Lack of WebCodecs Determinism**: While `MediaRecorder` offers universal browser compatibility, modern Chromium and Safari 16.4+ support `VideoDecoder` / `VideoEncoder`. WebCodecs processes frames as discrete `VideoFrame` objects independent of real-time clock, eliminating frame drops entirely.

---

## 5. Architectural Upgrade Plan (Target Architecture)

To satisfy the Blueprint's non-negotiable acceptance criteria without breaking existing capabilities, we establish a **unified non-destructive edit graph**:

```
                              ┌────────────────────────────────────────┐
                              │           Non-Destructive              │
                              │           Timeline Edit Graph          │
                              └──────────────────┬─────────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
             [Single Video Pipeline]                           [Multi-Clip / Grid Slicer]
                        │                                                 │
                        ▼                                                 ▼
          ┌───────────────────────────┐                     ┌───────────────────────────┐
          │     Frame Processing      │                     │     Spatial/Time Slice    │
          │                           │                     │                           │
          │ 1. Geometry/Orientation   │                     │ • N Temporal Clips OR     │
          │ 2. Filters & Motion Zoom  │                     │ • 3x3 / 4x4 Spatial Tiles │
          │ 3. Blur Mask Composite    │                     │ • Rejoin Concatenation    │
          │ 4. Watermark Embed (Keyed)│                     └─────────────┬─────────────┘
          │    - Spatial MVP (Luma)   │                                   │
          │    - Robust DCT QIM + ECC │                                   │
          └─────────────┬─────────────┘                                   │
                        │                                                 │
                        └────────────────────────┬────────────────────────┘
                                                 │
                                                 ▼
                               ┌───────────────────────────────────┐
                               │       Unified A/V Exporter        │
                               │                                   │
                               │  Primary: WebCodecs (Deterministic)
                               │  Fallback: Canvas + MediaRecorder │
                               │  Audio: Resampled Web Audio Mux   │
                               └─────────────────┬─────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
               [Exported Video File]                             [Independent Detector]
               (MP4 / WebM with Keyed                            (Decodes frame bytes,
                Pixel Watermark)                                  reverses keyed tiles/DCT,
                                                                  validates CRC & confidence)
```

---

## 6. Baseline Sample Media Clips

Per Phase 0 requirements, the following baseline test clips are established in `samples/` for automated verification:

1. `sample_5s_720p_30fps_tone.mp4` / `.webm`: 5-second 1280x720 video at 30 fps with continuous 440 Hz audio reference tone.
2. `sample_60s_1080p.mp4` / `.webm`: 60-second 1920x1080 video with animated digital timer and moving coordinate markers (ideal for temporal 10s slicing QA).
3. `sample_silent.mp4` / `.webm`: 5-second video with no audio track (verifies zero-audio export resilience).
4. `sample_portrait_9x16.mp4` / `.webm`: 720x1280 vertical video (tests orientation preservation and vertical grid operations).
5. `sample_vfr_test.webm`: Variable frame rate clip (validates timestamp interpolation and sync).
6. `sample_4k_stress.webm`: 3840x2160 high-resolution short clip (benchmarks peak memory and canvas allocation limits).

---

## 7. Technical Risks & Failure Mitigation Matrix

| Identified Risk | Severity | Root Cause | Proposed Mitigation in Architecture |
| :--- | :---: | :--- | :--- |
| **Compression Artifact Loss** | High | Video codecs (H.264/VP9) heavily quantize high frequencies and smooth subtle gradients. | MVP uses spatial luminance modulation with repetition; Phase 3 robust mode embeds in mid-frequency DCT coefficients with ECC and temporal accumulation. Explicitly label fragility in UI. |
| **False Positive Detection** | Medium | Pseudo-random patterns might randomly correlate with natural video textures. | Payload incorporates CRC16/CRC32 integrity check and calibrated confidence threshold ($Z$-score / Pearson correlation $> 4.5\sigma$). System reports *Inconclusive* rather than guessing. |
| **Duration Drift / A/V Desync** | Medium | `MediaRecorder` relies on system clock ticks while canvas rendering can stutter under load. | Implement bounded frame queue with strict timestamp tracking; enforce explicit audio track sample duration matching video timestamps. |
| **Spatial Grid Boundary Rounding** | Low | Splitting an odd-pixel dimension (e.g. 1080 width / 3 = 360, but 1920 height / 7 = 274.28) causes 1px gaps or overlaps. | Implement exact integer partitioning math: $\sum_{i=1}^{N} w_i = W_{\text{orig}}$ with residual pixel assigned deterministically. |
| **Browser Sandbox & Offline Support** | Low | External CDN dependencies failing or blocked in sandboxes. | All dependencies (`jszip`, watermark math, DCT matrices) are bundled locally. No external runtime network requests required. |

---

## 8. Exact Source Files to Modify & Create

### Existing Files to Modify
- `index.html`:
  - Add **Watermark Studio** tab (Embed settings: algorithm, strength, coverage, payload ID, secret key, difference visualizer).
  - Add **Watermark Verify** tab (Input video, secret key/manifest, detection status, confidence score, bit stats).
  - Add **Spatial Grid Cutting** & **Rejoin/Join** controls to Cutter panel.
- `css/styles.css`:
  - Styling for Watermark Studio, verification badges, confidence meters, and spatial grid preview.
- `js/app.js`:
  - Integrate Watermark UI event handlers, verify workflows, grid cutting, and non-destructive project state.
- `js/video-engine.js`:
  - Integrate watermark embedding step into frame pipeline.
  - Implement deterministic frame stepper and audio mux synchronization.
  - Add spatial grid division and rejoining methods.
- `README.md`:
  - Document watermark limitations, key management, algorithm details, and QA instructions.

### New Files to Create
- `js/watermark-engine.js`:
  - Pure, modular cryptographic PRNG (HMAC/SHA-256 or ChaCha20 seeded), payload packing, CRC16/32, spatial pixel embedding, 8x8 block-DCT QIM embedding, ECC encoding/decoding, and independent verification detector.
- `tests/unit/test_watermark.py`:
  - Python-based verification of DCT round-trips, ECC recovery, CRC validation, and PRNG reproducibility.
- `tests/unit/test_cutter_grid.py`:
  - Exact tile geometry, pixel rounding coverage, and temporal slicing boundary tests.
- `tests/runner.html`:
  - Browser-based automated test suite running unit and integration assertions directly against the active browser JS engine.
- `samples/generate_samples.py`:
  - Automated script to generate synthetic baseline test media.

---

## 9. Phase-by-Phase Execution Plan

1. **Phase 0 (Complete)**: Discovery audit, feature matrix validation, baseline media specifications.
2. **Phase 1**: Unified Non-Destructive Export Pipeline & Timestamp/Audio Hardening.
3. **Phase 2**: Watermark MVP (Spatial Luminance Perturbations) + Independent Detector + UI.
4. **Phase 3**: Robust Frequency-Domain Watermark (8x8 Block-DCT QIM + ECC) + Benchmark Metrics.
5. **Phase 4**: Slicing Upgrades (Spatial Grid 3x3/4x4, Rejoin Concatenation, Boundary Verification).
6. **Phase 5**: Full QA Suite, Documentation, Benchmarks, and GitHub Pages Deployment.
