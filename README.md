# 🎬 VidCut Studio: Automated Video Cutter & Orientation Switcher

> **100% Client-Side Video Auto-Splitter & Orientation Converter**  
> Automatically cuts long videos into shorter clips (e.g. 60-second video into six 10-second segments) with social media orientation conversion (**9:16 Portrait**, **1:1 Square**, **16:9 Landscape**, **4:5 Feed**) and smart framing (**Blurred Background**, **Center Crop**, **Letterbox**).

🚀 **Live Demo on GitHub Pages**: [https://everlovingvijay.github.io/video-cutter/](https://everlovingvijay.github.io/video-cutter/)  
🔒 **100% Private**: Runs entirely in the browser. Zero video uploads, zero server fees, zero telemetry.

---

## ✨ Features

- **✂️ Automated Duration Slicing:**
  - Enter any desired segment duration (e.g., `10s`, `15s`, `30s`, `60s`) or divide into $N$ equal parts.
  - Automatically calculates all segment timestamps (e.g., `00:00 - 00:10`, `00:10 - 00:20`, ...).
  - Configurable remainder handling (keep remainder, merge with previous, or discard).
- **📱 Social Orientation Transformation:**
  - **9:16 Portrait** — TikTok, YouTube Shorts, Instagram Reels (1080×1920 / 720×1280)
  - **1:1 Square** — Instagram Feed, Twitter/X, LinkedIn (1080×1080 / 720×720)
  - **16:9 Landscape** — Standard YouTube, Desktop, TV (1920×1080 / 1280×720)
  - **4:5 Social Feed** — Instagram Vertical Post (1080×1350 / 720×900)
  - **Original** — Preserves source aspect ratio.
- **🌟 Smart Framing Modes:**
  - **Blurred Background (Fit & Blur)**: Scales up video with a soft blur in the background while keeping the full uncropped source centered in the foreground (standard aesthetic for converting landscape videos to vertical Reels/Shorts).
  - **Smart Center Crop**: Fills the target screen without letterboxing.
  - **Clean Letterbox / Pillarbox**: Clean dark padding bars.
- **👁️ Live Interactive Preview:**
  - Live WYSIWYG preview canvas showing exactly what the video looks like with the selected orientation and framing before exporting.
  - Interactive visual timeline: click any segment chip or block to test playback of that exact slice!
- **⚡ 100% Client-Side & Free:**
  - Uses HTML5 Canvas, MediaStream, and Web Audio APIs.
  - No server backend needed — can be hosted for free on **GitHub Pages** forever!
- **📦 Batch Export & Single-Click ZIP:**
  - Live progress bar with estimated time remaining and segment counter.
  - Playable result cards for each generated clip with individual download buttons.
  - **"Download All as ZIP"** button bundled with `JSZip`.
- **💻 Companion Python CLI:**
  - Includes `cutter.py` for terminal users with `ffmpeg` installed.

---

## 🌐 How to Deploy to GitHub Pages (Under 60 Seconds)

Because VidCut Studio is 100% static client-side JavaScript, you can host it for free on GitHub Pages and access it via a public link:

### Step 1: Create a New GitHub Repository
1. Go to [https://github.com/new](https://github.com/new).
2. Name your repository: `video-cutter`.
3. Set visibility to **Public** (recommended for free GitHub Pages).
4. Click **Create repository**.

### Step 2: Push this Project to GitHub
In your local terminal inside this project folder:

```bash
cd /Users/vijays/.gemini/antigravity/scratch/video-cutter

# Initialize git repository
git init -b main

# Add all files and commit
git add .
git commit -m "Initial commit: VidCut Studio automated video cutter"

# Link to your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/everlovingvijay/video-cutter.git

# Push to GitHub
git push -u origin main
```

*(If using SSH: `git remote add origin git@github.com:everlovingvijay/video-cutter.git`)*

### Step 3: Enable GitHub Pages in 2 Clicks
1. On GitHub, navigate to your repository: `https://github.com/everlovingvijay/video-cutter`
2. Click **Settings** (tab at the top) &rarr; **Pages** (in the left sidebar).
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`
   - **Branch**: Select `main` and folder `/ (root)`
4. Click **Save**.

🎉 Within 30 seconds, your public link is live at:  
👉 **`https://everlovingvijay.github.io/video-cutter/`**

---

## 🖥️ How to Run Locally

You can also run VidCut Studio locally with zero installation:

### Option A: Double-Click
Simply open `index.html` directly in any web browser (Chrome, Safari, Edge, Firefox, Brave).

### Option B: Local Python HTTP Server
```bash
cd /Users/vijays/.gemini/antigravity/scratch/video-cutter
python3 -m http.server 8000
```
Then visit: `http://localhost:8000`

---

## 🐍 Command-Line Usage (`cutter.py`)

For developers or automated workflows, a standalone Python CLI script is included:

```bash
# Slices a 60-second video into 10-second 9:16 vertical clips with blurred background
python3 cutter.py input.mp4 --duration 10 --orientation 9:16 --fit blur --output-dir ./output

# Divide into 6 equal parts with center crop
python3 cutter.py input.mp4 --parts 6 --orientation 9:16 --fit crop

# Convert to 1:1 square for Instagram
python3 cutter.py input.mp4 --duration 15 --orientation 1:1 --fit blur
```

### CLI Arguments:
| Argument | Description | Default |
| :--- | :--- | :--- |
| `input` | Path to source video file | *Required* |
| `-d, --duration` | Duration of each segment in seconds | `10.0` |
| `-p, --parts` | Divide into $N$ equal parts instead of fixed duration | `None` |
| `-o, --orientation` | `9:16`, `1:1`, `16:9`, `4:5`, `original` | `9:16` |
| `-f, --fit` | `blur`, `crop`, `fit` (letterbox) | `blur` |
| `-r, --remainder` | `keep`, `merge`, `discard` | `keep` |
| `--output-dir` | Folder to save output files | `./output` |

---

## 📁 Project Structure

```
video-cutter/
├── .nojekyll                  # Prevents GitHub Pages Jekyll filtering
├── index.html                 # Main Studio web application
├── css/
│   └── styles.css             # Polished dark studio UI & responsive layout
├── js/
│   ├── app.js                 # UI controllers, timeline, state management
│   ├── video-engine.js        # Canvas orientation transformation & slicing engine
│   └── jszip.min.js           # Client-side ZIP packaging library
├── cutter.py                  # Standalone Python CLI utility
└── README.md                  # Documentation and deployment guide
```

---

## 📄 License

MIT License &copy; 2026 [Vijay S](https://github.com/everlovingvijay). Free and open-source for personal and commercial use.
