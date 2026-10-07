# 🎬 VidCut Omni Studio: Lightweight Client-Side Video Editing Suite

> **Fast, 100% Client-Side Multi-Tool Video Editor & Auto-Splitter**  
> Complete video editing suite running entirely in the browser: **Filter Presets** (Grayscale, 35mm Film Grain, Olden Days, Future Cyberpunk, Film Noir), **Motion Zoom & Camera Effects** (Ken Burns zoom in/out, line zoom, camera shake), **Transitions** (fade in/out, impact flash), **Interactive Blur Brush** (selectively blur logos, faces, or watermarks), **Speed & Volume Controls**, **Screen/Webcam Recorder**, and **Auto Cutter & Slicer** with 9:16 vertical conversion.

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
- **Fine-Tuning Sliders**: Manual Brightness, Contrast, and Saturation adjustments.
- **Motion & Camera Zoom**:
  - **Slow Zoom In**: Ken Burns smooth zoom from $1.0\times \to 1.25\times$.
  - **Slow Zoom Out**: Smooth pull-back from $1.25\times \to 1.0\times$.
  - **Line Zoom**: Dynamic rhythmic zoom pulse.
  - **Pan Left-Right**: Cinematic horizontal camera tracking.
  - **Camera Shake**: Subtle organic handheld camera drift.
- **Transitions**: Fade In from Black, Fade Out, Fade In & Out, Impact Flash Dip to White.

### 2. 🖌️ Interactive Blur Brush & Mask
- Paint blur directly onto the video canvas using your mouse or touch.
- Selectively blur **watermarks, channel logos, faces, license plates, or private text**.
- Adjustable **Brush Size** ($10\text{px} - 100\text{px}$) and **Blur Intensity** ($6\text{px} - 45\text{px}$).
- **Box Blur Mode**: Click and drag a rectangle to blur corner logos in one action.
- Zero GPU strain: uses native HTML5 Canvas 2D alpha mask compositing.

### 3. ✂️ Auto Cutter & Slicer
- Slices long videos (e.g. 60 seconds) into shorter segments (e.g. six 10-second clips) automatically.
- Social media orientation switching:
  - **9:16 Portrait** (TikTok, YouTube Shorts, Instagram Reels)
  - **1:1 Square** (Instagram Feed, LinkedIn)
  - **16:9 Landscape** (YouTube, Desktop)
  - **4:5 Social Feed**
- Framing styles: **Blurred Background (Fit & Blur)**, **Smart Center Crop**, or **Letterbox**.
- Single-click **"Download All as ZIP"**.

### 4. 📐 Crop, Rotate & Flip Studio
- 90°, 180°, and 270° instant rotation.
- Horizontal and Vertical mirror flip.

### 5. ⚡ Speed & Audio Studio
- Adjust playback speed from **0.25x Slow Motion** to **3.0x Fast Forward**.
- Volume booster from **0% to 250%** and 1-click **Mute Audio**.

### 6. 📹 Screen & Camera Recorder
- Native in-browser screen capture (`getDisplayMedia`) and webcam recording (`getUserMedia`).
- Automatically loads the recorded clip straight into the Omni Studio editor for immediate styling, brushing, or cutting.

---

## 🌐 Deploy to GitHub Pages

VidCut Omni Studio is 100% static and requires zero backend:

```bash
cd /Users/vijays/.gemini/antigravity/scratch/video-cutter
git add .
git commit -m "Add Omni Video Editor: Filters, Motion Zoom, Blur Brush & Transitions"
git push origin main
```

Your app is live immediately at:  
👉 **[https://everlovingvijay.github.io/video-cutter/](https://everlovingvijay.github.io/video-cutter/)**

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
