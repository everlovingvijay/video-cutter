/**
 * VidCut Omni Studio - Main Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = new VideoEngine();

  // App & Video State
  let currentEditGraph = new EditGraph();
  let currentFile = null;
  let videoDuration = 0;
  let videoWidth = 0;
  let videoHeight = 0;
  let videoBlobUrl = null;
  let calculatedSegments = [];
  let generatedResults = [];
  let isProcessing = false;
  let currentPreviewMode = 'transform'; // 'source' or 'transform'
  let activeTool = 'video_editor';

  // Active Omni Studio Configuration
  const state = {
    // Cutter options
    splitMode: 'duration',
    duration: 10,
    parts: 6,
    remainder: 'keep',
    orientation: 'original',
    fitMode: 'blur',
    resolution: '1080p',

    // Filter options
    filterPreset: 'none',
    customFilters: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      sepia: 0,
      hueRotate: 0
    },

    // Motion effects
    motionType: 'none',

    // Transitions
    transitionType: 'none',
    transDuration: 1.0,

    // Blur Brush Mask
    brushSize: 35,
    blurStrength: 20,
    frostedSheen: 0.05,
    isBoxBlurMode: false,

    // Transform
    rotation: 0,
    flipH: false,
    flipV: false,

    // Audio & Speed
    playbackSpeed: 1.0,
    volumeMultiplier: 1.0,
    isMuted: false,

    // Watermark Studio
    watermark: {
      enabled: false,
      algorithm: 'dct',
      key: 'vidcut-omni-key-2026',
      id: 12345,
      strength: 2,
      samplesPerBit: 48
    }
  };

  // Mask Canvas for Blur Brush
  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d');
  let isPainting = false;
  let boxStartX = 0;
  let boxStartY = 0;

  // DOM Elements - Navigation & Shell
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const toolPanels = document.querySelectorAll('.tool-panel');
  const activeToolTitle = document.getElementById('activeToolTitle');
  const activeToolSubtitle = document.getElementById('activeToolSubtitle');

  // Ingestion Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const sampleBtn = document.getElementById('sampleBtn');
  const urlInput = document.getElementById('urlInput');
  const loadUrlBtn = document.getElementById('loadUrlBtn');

  // Workspace & Video Stage
  const workspace = document.getElementById('workspace');
  const stageContainer = document.getElementById('stageContainer');
  const sourceVideo = document.getElementById('sourceVideo');
  const previewCanvas = document.getElementById('previewCanvas');
  const paintCanvas = document.getElementById('paintCanvas');
  const paintCtx = paintCanvas.getContext('2d');
  const stageBadge = document.getElementById('stageBadge');

  const tabSource = document.getElementById('tabSource');
  const tabTransform = document.getElementById('tabTransform');

  // Stats bar
  const infoFileName = document.getElementById('infoFileName');
  const infoDuration = document.getElementById('infoDuration');
  const infoResolution = document.getElementById('infoResolution');
  const infoAspect = document.getElementById('infoAspect');
  const infoFileSize = document.getElementById('infoFileSize');

  // Timeline
  const timelineBar = document.getElementById('timelineBar');
  const timelineNeedle = document.getElementById('timelineNeedle');
  const timelineTime = document.getElementById('timelineTime');
  const segmentChips = document.getElementById('segmentChips');
  const timelineTitle = document.getElementById('timelineTitle');

  // Tool 1: Omni Editor Elements
  const filterCards = document.querySelectorAll('.filter-card');
  const motionCards = document.querySelectorAll('.motion-card');
  const transitionSelect = document.getElementById('transitionSelect');
  const brightnessSlider = document.getElementById('brightnessSlider');
  const contrastSlider = document.getElementById('contrastSlider');
  const saturationSlider = document.getElementById('saturationSlider');
  const brightnessVal = document.getElementById('brightnessVal');
  const contrastVal = document.getElementById('contrastVal');
  const saturationVal = document.getElementById('saturationVal');
  const exportEditedBtn = document.getElementById('exportEditedBtn');

  // Tool 2: Blur Brush Elements
  const brushSizeSlider = document.getElementById('brushSizeSlider');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const brushPreviewCircle = document.getElementById('brushPreviewCircle');
  const blurStrengthSlider = document.getElementById('blurStrengthSlider');
  const blurStrengthVal = document.getElementById('blurStrengthVal');
  const clearBrushBtn = document.getElementById('clearBrushBtn');
  const boxBlurBtn = document.getElementById('boxBlurBtn');
  const exportMaskedBtn = document.getElementById('exportMaskedBtn');

  // Tool 3: Auto Cutter Elements
  const modeDurationBtn = document.getElementById('modeDurationBtn');
  const modePartsBtn = document.getElementById('modePartsBtn');
  const durationControlGroup = document.getElementById('durationControlGroup');
  const partsControlGroup = document.getElementById('partsControlGroup');
  const durationInput = document.getElementById('durationInput');
  const partsInput = document.getElementById('partsInput');
  const remainderSelect = document.getElementById('remainderSelect');
  const summaryBox = document.getElementById('summaryBox');
  const masterCutBtn = document.getElementById('masterCutBtn');
  const aspectCards = document.querySelectorAll('.aspect-card');
  const framingCards = document.querySelectorAll('.framing-card');
  const presetPills = document.querySelectorAll('.preset-pill');

  // Tool 4: Crop & Rotate Elements
  const rotate90Btn = document.getElementById('rotate90Btn');
  const rotate180Btn = document.getElementById('rotate180Btn');
  const resetRotateBtn = document.getElementById('resetRotateBtn');
  const flipHBtn = document.getElementById('flipHBtn');
  const flipVBtn = document.getElementById('flipVBtn');
  const exportTransformBtn = document.getElementById('exportTransformBtn');

  // Tool 5: Speed & Volume Elements
  const speedSlider = document.getElementById('speedSlider');
  const speedVal = document.getElementById('speedVal');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeVal = document.getElementById('volumeVal');
  const muteToggleBtn = document.getElementById('muteToggleBtn');
  const exportSpeedVolumeBtn = document.getElementById('exportSpeedVolumeBtn');

  // Tool 6: Screen & Camera Recorder Elements
  const startScreenRecBtn = document.getElementById('startScreenRecBtn');
  const startCamRecBtn = document.getElementById('startCamRecBtn');
  const stopRecordingBtn = document.getElementById('stopRecordingBtn');
  const recorderLiveIndicator = document.getElementById('recorderLiveIndicator');
  let activeMediaRecorder = null;
  let activeRecordedChunks = [];

  // Processing elements
  const processingCard = document.getElementById('processingCard');
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const processingStatus = document.getElementById('processingStatus');
  const processingDetails = document.getElementById('processingDetails');
  const cancelBtn = document.getElementById('cancelBtn');

  // Results elements
  const resultsSection = document.getElementById('resultsSection');
  const resultsCount = document.getElementById('resultsCount');
  const resultsGrid = document.getElementById('resultsGrid');
  const downloadAllZipBtn = document.getElementById('downloadAllZipBtn');

  /* -------------------------------------------------------------
     1. Navigation & Tool Switching
  ------------------------------------------------------------- */
  const toolMetadata = {
    video_editor: {
      title: 'Omni Video Editor',
      sub: 'Color grading presets, motion zoom, cinematic film grain, and transitions'
    },
    blur_brush: {
      title: 'Blur Brush & Privacy Mask',
      sub: 'Paint blur directly over logos, faces, license plates, or watermarks'
    },
    video_cutter: {
      title: 'Auto Cutter & Orientation Slicer',
      sub: 'Divide longer videos into shorter clips with 9:16 vertical conversion'
    },
    merge_videos: {
      title: 'Merge & Rejoin Videos',
      sub: 'Concatenate multiple video files or spatial grid tiles into a single video'
    },
    crop_rotate: {
      title: 'Crop, Rotate & Flip Studio',
      sub: 'Rotate video 90°/180°, flip horizontally, or change framing'
    },
    speed_volume: {
      title: 'Speed & Audio Studio',
      sub: 'Slow motion, fast forward, volume booster, and mute controls'
    },
    watermark_studio: {
      title: 'Watermark Studio & Detector',
      sub: 'Imperceptible keyed pixel watermarking, independent verification & diff inspector'
    },
    screen_recorder: {
      title: 'Screen & Camera Recorder',
      sub: 'Capture display screen or webcam directly into Omni Studio'
    }
  };

  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const toolKey = item.dataset.tool;
      activeTool = toolKey;

      // Update Header Text
      if (toolMetadata[toolKey]) {
        activeToolTitle.textContent = toolMetadata[toolKey].title;
        activeToolSubtitle.textContent = toolMetadata[toolKey].sub;
      }

      // Show Matching Right-Side Panel
      toolPanels.forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById(`panel_${toolKey}`);
      if (targetPanel) targetPanel.classList.add('active');

      // Adjust Canvas Painting Mode
      if (toolKey === 'blur_brush') {
        paintCanvas.classList.add('active-brush');
        setPreviewMode('transform');
      } else {
        paintCanvas.classList.remove('active-brush');
      }

      // Adjust Timeline Chips visibility
      if (toolKey === 'video_cutter') {
        segmentChips.style.display = 'flex';
        timelineTitle.innerHTML = '<strong>Visual Split Timeline</strong> (Click any clip to preview)';
      } else {
        segmentChips.style.display = 'none';
        timelineTitle.innerHTML = '<strong>Timeline Scrubber</strong>';
      }

      updatePreview();
    });
  });

  /* -------------------------------------------------------------
     2. Ingestion & File Loading
  ------------------------------------------------------------- */
  dropzone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & drop
  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // URL loader
  loadUrlBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = urlInput.value.trim();
    if (!url) return alert('Please enter a valid video URL.');

    try {
      loadUrlBtn.disabled = true;
      loadUrlBtn.textContent = 'Fetching...';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const filename = url.split('/').pop().split('?')[0] || 'remote_video.mp4';
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      handleFile(file);
    } catch (err) {
      alert(`Could not load video from URL: ${err.message}. Please upload directly.`);
    } finally {
      loadUrlBtn.disabled = false;
      loadUrlBtn.textContent = 'Load Video';
    }
  });

  // 60s Demo generator
  sampleBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    sampleBtn.disabled = true;
    sampleBtn.innerHTML = '⏳ Generating 60s demo...';

    try {
      const sample = await engine.generateSampleVideo(60);
      const file = new File([sample.blob], 'sample_60s_demo.mp4', { type: sample.mime });
      handleFile(file);
    } catch (err) {
      console.error(err);
      alert('Error generating demo: ' + err.message);
    } finally {
      sampleBtn.disabled = false;
      sampleBtn.innerHTML = '⚡ Try 60s Demo Video';
    }
  });

  function handleFile(file) {
    currentFile = file;
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    videoBlobUrl = URL.createObjectURL(file);

    sourceVideo.src = videoBlobUrl;
    sourceVideo.load();

    sourceVideo.onloadedmetadata = () => {
      videoDuration = sourceVideo.duration;
      videoWidth = sourceVideo.videoWidth;
      videoHeight = sourceVideo.videoHeight;

      // Update EditGraph source
      currentEditGraph.setSource({
        name: file.name,
        duration: videoDuration,
        width: videoWidth,
        height: videoHeight,
        sizeBytes: file.size,
        hasAudio: true
      });

      // Update info bar
      infoFileName.textContent = file.name;
      infoDuration.textContent = formatTime(videoDuration);
      infoResolution.textContent = `${videoWidth} × ${videoHeight}`;
      infoAspect.textContent = getAspectLabel(videoWidth, videoHeight);
      infoFileSize.textContent = formatBytes(file.size);

      // Initialize mask canvas to match video source
      maskCanvas.width = videoWidth;
      maskCanvas.height = videoHeight;
      maskCtx.clearRect(0, 0, videoWidth, videoHeight);

      // Show workspace
      workspace.style.display = 'block';
      resultsSection.style.display = 'none';

      // Switch to transform preview by default
      setPreviewMode('transform');

      // Recalculate cutter segments
  recalculate();

      // Render initial preview
      setTimeout(() => {
        syncPaintCanvasSize();
        updatePreview();
      }, 200);

      workspace.scrollIntoView({ behavior: 'smooth' });
    };
  }

  /* -------------------------------------------------------------
     3. Video Stage, Preview Modes & Paint Surface
  ------------------------------------------------------------- */
  tabSource.addEventListener('click', () => setPreviewMode('source'));
  tabTransform.addEventListener('click', () => setPreviewMode('transform'));

  function setPreviewMode(mode) {
    currentPreviewMode = mode;
    if (mode === 'source') {
      tabSource.classList.add('active');
      tabTransform.classList.remove('active');
      sourceVideo.style.display = 'block';
      previewCanvas.style.display = 'none';
      stageBadge.textContent = 'Original Source Video';
    } else {
      tabTransform.classList.add('active');
      tabSource.classList.remove('active');
      sourceVideo.style.display = 'none';
      previewCanvas.style.display = 'block';
      stageBadge.textContent = 'Live Studio Preview (Filters & Effects)';
      updatePreview();
    }
  }

  function syncPaintCanvasSize() {
    if (!previewCanvas) return;
    paintCanvas.width = previewCanvas.width || 1280;
    paintCanvas.height = previewCanvas.height || 720;
    paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
  }

  function updatePreview() {
    if (currentPreviewMode === 'transform' && sourceVideo.readyState >= 2) {
      engine.renderPreview(sourceVideo, previewCanvas, {
        orientation: state.orientation,
        fitMode: state.fitMode,
        resolution: '720p',
        filterPreset: state.filterPreset,
        customFilters: state.customFilters,
        motionType: state.motionType,
        transitionType: state.transitionType,
        transDuration: state.transDuration,
        rotation: state.rotation,
        flipH: state.flipH,
        flipV: state.flipV,
        maskCanvas: maskCanvas,
        blurStrength: state.blurStrength,
        frostedSheen: state.frostedSheen
      });

      syncPaintCanvasSize();
    }
  }

  // Update needle and frame during playback
  sourceVideo.addEventListener('timeupdate', () => {
    if (videoDuration > 0) {
      const pct = (sourceVideo.currentTime / videoDuration) * 100;
      timelineNeedle.style.left = `${pct}%`;
      timelineTime.textContent = `${formatTime(sourceVideo.currentTime)} / ${formatTime(videoDuration)}`;
    }
    if (currentPreviewMode === 'transform') {
      updatePreview();
    }
  });

  sourceVideo.addEventListener('seeked', () => {
    if (currentPreviewMode === 'transform') {
      updatePreview();
    }
  });

  /* -------------------------------------------------------------
     4. Interactive Glass Blur Brush Painting Logic
  ------------------------------------------------------------- */
  function getCanvasCoords(e) {
    const rect = paintCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top
    };
  }

  paintCanvas.addEventListener('pointerdown', (e) => {
    if (activeTool !== 'blur_brush') return;
    isPainting = true;
    paintCanvas.setPointerCapture(e.pointerId);

    const pos = getCanvasCoords(e);
    if (state.isBoxBlurMode) {
      boxStartX = pos.x;
      boxStartY = pos.y;
    } else {
      drawBrushStroke(pos.x, pos.y);
    }
  });

  paintCanvas.addEventListener('pointermove', (e) => {
    if (activeTool !== 'blur_brush') return;
    const pos = getCanvasCoords(e);

    // Draw active brush cursor ring on paintCanvas
    paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

    if (state.isBoxBlurMode && isPainting) {
      // Draw drag box outline
      const rect = paintCanvas.getBoundingClientRect();
      const pStartX = (boxStartX / maskCanvas.width) * paintCanvas.width;
      const pStartY = (boxStartY / maskCanvas.height) * paintCanvas.height;
      const pCurX = pos.screenX;
      const pCurY = pos.screenY;

      paintCtx.strokeStyle = '#6366f1';
      paintCtx.lineWidth = 2;
      paintCtx.setLineDash([4, 4]);
      paintCtx.strokeRect(pStartX, pStartY, pCurX - pStartX, pCurY - pStartY);
      paintCtx.setLineDash([]);
    } else {
      // Draw subtle circular cursor ring showing brush footprint
      paintCtx.save();
      paintCtx.strokeStyle = 'rgba(99, 102, 241, 0.85)';
      paintCtx.lineWidth = 2;
      paintCtx.setLineDash([3, 3]);
      paintCtx.beginPath();
      const displayRadius = (state.brushSize / maskCanvas.width) * paintCanvas.width;
      paintCtx.arc(pos.screenX, pos.screenY, displayRadius, 0, Math.PI * 2);
      paintCtx.stroke();
      paintCtx.restore();

      if (isPainting) {
        drawBrushStroke(pos.x, pos.y);
      }
    }
  });

  paintCanvas.addEventListener('pointerleave', () => {
    if (!isPainting) {
      paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    }
  });

  function drawBrushStroke(x, y) {
    maskCtx.save();
    // Soft radial feathering for authentic smooth optical glass blur
    const r = state.brushSize;
    const grad = maskCtx.createRadialGradient(x, y, r * 0.35, x, y, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    maskCtx.fillStyle = grad;
    maskCtx.beginPath();
    maskCtx.arc(x, y, r, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();

    updatePreview();
  }

  paintCanvas.addEventListener('pointerup', (e) => {
    if (!isPainting) return;
    isPainting = false;

    if (state.isBoxBlurMode) {
      const pos = getCanvasCoords(e);
      const w = pos.x - boxStartX;
      const h = pos.y - boxStartY;

      maskCtx.save();
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(boxStartX, boxStartY, w, h);
      maskCtx.restore();

      state.isBoxBlurMode = false;
      boxBlurBtn.classList.remove('btn-primary');
      boxBlurBtn.classList.add('btn-secondary');
      paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
      updatePreview();
    }
  });

  brushSizeSlider.addEventListener('input', (e) => {
    state.brushSize = parseInt(e.target.value, 10);
    brushSizeVal.textContent = `${state.brushSize}px`;
    brushPreviewCircle.textContent = `${state.brushSize}px`;
    brushPreviewCircle.style.width = `${Math.min(50, Math.max(24, state.brushSize))}px`;
    brushPreviewCircle.style.height = brushPreviewCircle.style.width;
  });

  blurStrengthSlider.addEventListener('input', (e) => {
    state.blurStrength = parseInt(e.target.value, 10);
    blurStrengthVal.textContent = `${state.blurStrength}px`;
    updatePreview();
  });

  const frostedSheenSlider = document.getElementById('frostedSheenSlider');
  const frostedSheenVal = document.getElementById('frostedSheenVal');
  const sheenPills = document.querySelectorAll('[data-sheen]');

  if (frostedSheenSlider) {
    frostedSheenSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.frostedSheen = val / 100;
      if (frostedSheenVal) frostedSheenVal.textContent = val === 0 ? '0% (Pure Glass)' : `${val}%`;
      sheenPills.forEach(p => p.classList.remove('active'));
      updatePreview();
    });
  }

  sheenPills.forEach(pill => {
    pill.addEventListener('click', () => {
      sheenPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const val = parseInt(pill.dataset.sheen, 10);
      state.frostedSheen = val / 100;
      if (frostedSheenSlider) frostedSheenSlider.value = val;
      if (frostedSheenVal) frostedSheenVal.textContent = val === 0 ? '0% (Pure Glass)' : `${val}%`;
      updatePreview();
    });
  });

  clearBrushBtn.addEventListener('click', () => {
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    updatePreview();
  });

  boxBlurBtn.addEventListener('click', () => {
    state.isBoxBlurMode = !state.isBoxBlurMode;
    if (state.isBoxBlurMode) {
      boxBlurBtn.classList.add('btn-primary');
      boxBlurBtn.classList.remove('btn-secondary');
      alert('Box Blur Mode Active: Click and drag a rectangle over the logo/watermark.');
    } else {
      boxBlurBtn.classList.remove('btn-primary');
      boxBlurBtn.classList.add('btn-secondary');
    }
  });

  /* -------------------------------------------------------------
     5. Filters & Motion Effects Controls
  ------------------------------------------------------------- */
  filterCards.forEach(card => {
    card.addEventListener('click', () => {
      filterCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.filterPreset = card.dataset.filter;
      updatePreview();
    });
  });

  motionCards.forEach(card => {
    card.addEventListener('click', () => {
      motionCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.motionType = card.dataset.motion;
      updatePreview();
    });
  });

  transitionSelect.addEventListener('change', (e) => {
    state.transitionType = e.target.value;
    updatePreview();
  });

  brightnessSlider.addEventListener('input', (e) => {
    state.customFilters.brightness = parseInt(e.target.value, 10);
    brightnessVal.textContent = `${state.customFilters.brightness}%`;
    updatePreview();
  });

  contrastSlider.addEventListener('input', (e) => {
    state.customFilters.contrast = parseInt(e.target.value, 10);
    contrastVal.textContent = `${state.customFilters.contrast}%`;
    updatePreview();
  });

  saturationSlider.addEventListener('input', (e) => {
    state.customFilters.saturation = parseInt(e.target.value, 10);
    saturationVal.textContent = `${state.customFilters.saturation}%`;
    updatePreview();
  });

  /* -------------------------------------------------------------
     6. Crop, Rotate & Flip Controls
  ------------------------------------------------------------- */
  rotate90Btn.addEventListener('click', () => {
    state.rotation = (state.rotation + 90) % 360;
    updatePreview();
  });

  rotate180Btn.addEventListener('click', () => {
    state.rotation = (state.rotation + 180) % 360;
    updatePreview();
  });

  resetRotateBtn.addEventListener('click', () => {
    state.rotation = 0;
    state.flipH = false;
    state.flipV = false;
    updatePreview();
  });

  flipHBtn.addEventListener('click', () => {
    state.flipH = !state.flipH;
    flipHBtn.classList.toggle('active', state.flipH);
    updatePreview();
  });

  flipVBtn.addEventListener('click', () => {
    state.flipV = !state.flipV;
    flipVBtn.classList.toggle('active', state.flipV);
    updatePreview();
  });

  /* -------------------------------------------------------------
     7. Speed & Audio Volume Controls
  ------------------------------------------------------------- */
  speedSlider.addEventListener('input', (e) => {
    setSpeed(parseFloat(e.target.value));
  });

  document.querySelectorAll('[data-speed]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('[data-speed]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      setSpeed(parseFloat(pill.dataset.speed));
    });
  });

  function setSpeed(spd) {
    state.playbackSpeed = spd;
    speedVal.textContent = `${spd.toFixed(1)}x`;
    speedSlider.value = spd;
    sourceVideo.playbackRate = spd;
  }

  volumeSlider.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value, 10);
    state.volumeMultiplier = vol / 100;
    volumeVal.textContent = `${vol}%`;
    engine.setVolume(state.volumeMultiplier);
  });

  muteToggleBtn.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    if (state.isMuted) {
      engine.setVolume(0);
      muteToggleBtn.textContent = '🔊 Unmute Audio';
    } else {
      engine.setVolume(state.volumeMultiplier);
      muteToggleBtn.textContent = '🔇 Mute Audio';
    }
  });

  /* -------------------------------------------------------------
     8. Screen & Camera Recorder
  ------------------------------------------------------------- */
  startScreenRecBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      startLiveRecording(stream);
    } catch (err) {
      alert('Screen recording error: ' + err.message);
    }
  });

  startCamRecBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      startLiveRecording(stream);
    } catch (err) {
      alert('Camera access error: ' + err.message);
    }
  });

  function startLiveRecording(stream) {
    activeRecordedChunks = [];
    const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    activeMediaRecorder = new MediaRecorder(stream, { mimeType: mime });

    activeMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) activeRecordedChunks.push(e.data);
    };

    activeMediaRecorder.onstop = () => {
      recorderLiveIndicator.style.display = 'none';
      stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(activeRecordedChunks, { type: mime });
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `recorded_capture_${Date.now()}.${ext}`, { type: mime });
      handleFile(file);
    };

    activeMediaRecorder.start(100);
    recorderLiveIndicator.style.display = 'flex';
  }

  stopRecordingBtn.addEventListener('click', () => {
    if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
      activeMediaRecorder.stop();
    }
  });

  /* -------------------------------------------------------------
     9. Auto Cutter Slicing Controls
  ------------------------------------------------------------- */
  modeDurationBtn.addEventListener('click', () => {
  const modeSpatialGridBtn = document.getElementById('modeSpatialGridBtn');
  const spatialGridControlGroup = document.getElementById('spatialGridControlGroup');
  const gridRowsInput = document.getElementById('gridRowsInput');
  const gridColsInput = document.getElementById('gridColsInput');
  const gridTileInfo = document.getElementById('gridTileInfo');
  const exportGridTilesBtn = document.getElementById('exportGridTilesBtn');
  const gridPresetBtns = document.querySelectorAll('.grid-preset-btn');

  function updateGridTileInfo() {
    if (!gridTileInfo) return;
    const r = parseInt(gridRowsInput?.value, 10) || 3;
    const c = parseInt(gridColsInput?.value, 10) || 3;
    const w = videoWidth || 1920;
    const h = videoHeight || 1080;
    const tiles = engine.calculateSpatialGrid(w, h, r, c);
    const tileSample = tiles[0];
    gridTileInfo.innerHTML = `📐 <strong>${r}×${c} Grid (${tiles.length} Tiles)</strong>: Base tile ~${tileSample.width}×${tileSample.height}px.<br><span style="color:#10b981;">✓ Exact integer partitioning (Zero overlap, zero pixel gaps).</span>`;
    if (exportGridTilesBtn) {
      exportGridTilesBtn.textContent = `🔲 Slice Video into ${tiles.length} Spatial Tiles`;
    }
  }

  if (modeDurationBtn) {
    modeDurationBtn.addEventListener('click', () => {
      state.splitMode = 'duration';
      [modeDurationBtn, modePartsBtn, modeSpatialGridBtn].forEach(b => b && b.classList.remove('active'));
      modeDurationBtn.classList.add('active');
      durationControlGroup.style.display = 'flex';
      partsControlGroup.style.display = 'none';
      if (spatialGridControlGroup) spatialGridControlGroup.style.display = 'none';
      recalculate();
    });
  }

  if (modePartsBtn) {
    modePartsBtn.addEventListener('click', () => {
      state.splitMode = 'parts';
      [modeDurationBtn, modePartsBtn, modeSpatialGridBtn].forEach(b => b && b.classList.remove('active'));
      modePartsBtn.classList.add('active');
      durationControlGroup.style.display = 'none';
      partsControlGroup.style.display = 'flex';
      if (spatialGridControlGroup) spatialGridControlGroup.style.display = 'none';
      recalculate();
    });
  }

  if (modeSpatialGridBtn) {
    modeSpatialGridBtn.addEventListener('click', () => {
      state.splitMode = 'spatial_grid';
      [modeDurationBtn, modePartsBtn, modeSpatialGridBtn].forEach(b => b && b.classList.remove('active'));
      modeSpatialGridBtn.classList.add('active');
      durationControlGroup.style.display = 'none';
      partsControlGroup.style.display = 'none';
      if (spatialGridControlGroup) spatialGridControlGroup.style.display = 'block';
      updateGridTileInfo();
    });
  }

  gridPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gridPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (gridRowsInput) gridRowsInput.value = btn.dataset.rows;
      if (gridColsInput) gridColsInput.value = btn.dataset.cols;
      updateGridTileInfo();
    });
  });

  if (gridRowsInput) gridRowsInput.addEventListener('input', updateGridTileInfo);
  if (gridColsInput) gridColsInput.addEventListener('input', updateGridTileInfo);

  if (exportGridTilesBtn) {
    exportGridTilesBtn.addEventListener('click', async () => {
      if (isProcessing || !videoDuration) return;
      isProcessing = true;
      processingCard.style.display = 'flex';
      resultsSection.style.display = 'none';
      downloadAllZipBtn.style.display = 'inline-flex';
      progressFill.style.width = '0%';
      progressPercent.textContent = '0%';

      const r = parseInt(gridRowsInput?.value, 10) || 3;
      const c = parseInt(gridColsInput?.value, 10) || 3;
      const totalTiles = r * c;
      processingStatus.textContent = `Slicing video into ${totalTiles} spatial tiles...`;

      try {
        const gridResults = await engine.processSpatialGrid(
          sourceVideo,
          r,
          c,
          { hasAudio: state.hasAudio },
          ({ currentTile, totalTiles, overallProgress }) => {
            const pct = Math.round(overallProgress * 100);
            progressFill.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
            processingStatus.textContent = `Rendering Spatial Tile ${currentTile} of ${totalTiles}...`;
          }
        );

        const displayList = gridResults.map((gr) => ({
          segment: { index: gr.tile.index },
          blob: gr.blob,
          url: gr.url,
          extension: gr.extension,
          sizeBytes: gr.sizeBytes,
          width: gr.width,
          height: gr.height
        }));

        displayResults(displayList);
      } catch (err) {
        if (!err.message.includes('cancelled')) {
          console.error(err);
          alert('Spatial grid export error: ' + err.message);
        }
      } finally {
        isProcessing = false;
        processingCard.style.display = 'none';
      }
    });
  }
  });

  durationInput.addEventListener('input', (e) => {
    state.duration = parseFloat(e.target.value) || 10;
    presetPills.forEach(p => p.classList.remove('active'));
recalculate();
  });

  presetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      presetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const val = parseFloat(pill.dataset.val);
      state.duration = val;
      durationInput.value = val;
  recalculate();
    });
  });

  partsInput.addEventListener('input', (e) => {
    state.parts = parseInt(e.target.value, 10) || 6;
recalculate();
  });

  remainderSelect.addEventListener('change', (e) => {
    state.remainder = e.target.value;
recalculate();
  });

  aspectCards.forEach(card => {
    card.addEventListener('click', () => {
      aspectCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.orientation = card.dataset.aspect;
      updatePreview();
    });
  });

  framingCards.forEach(card => {
    card.addEventListener('click', () => {
      framingCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.fitMode = card.dataset.fit;
      updatePreview();
    });
  });

  function recalculate() {
    if (!videoDuration) return;

    calculatedSegments = engine.calculateSegments(
      videoDuration,
      state.duration,
      state.splitMode,
      state.parts,
      state.remainder
    );

    renderTimeline();
    renderSummary();
  }

  function renderSummary() {
    const count = calculatedSegments.length;
    let text = '';
    if (state.splitMode === 'duration') {
      text = `✂️ Will slice into <strong>${count} videos</strong> (${state.duration}s target)`;
      if (count > 0 && calculatedSegments[count - 1].duration !== state.duration) {
        text += ` • Last clip: ${calculatedSegments[count - 1].duration}s (${state.remainder})`;
      }
    } else {
      const avg = count > 0 ? calculatedSegments[0].duration.toFixed(1) : 0;
      text = `✂️ Will divide into <strong>${count} equal parts</strong> (~${avg}s each)`;
    }
    summaryBox.innerHTML = text;
    masterCutBtn.innerHTML = `✂️ Cut & Export ${count} Videos`;
  }

  /* -------------------------------------------------------------
     10. Timeline & Scrubber
  ------------------------------------------------------------- */
  const colors = [
    'rgba(99, 102, 241, 0.45)',
    'rgba(168, 85, 247, 0.45)',
    'rgba(6, 182, 212, 0.45)',
    'rgba(16, 185, 129, 0.45)',
    'rgba(245, 158, 11, 0.45)',
    'rgba(236, 72, 153, 0.45)'
  ];

  function renderTimeline() {
    timelineBar.innerHTML = '';
    segmentChips.innerHTML = '';
    timelineBar.appendChild(timelineNeedle);

    calculatedSegments.forEach((seg, i) => {
      const color = colors[i % colors.length];
      const widthPct = (seg.duration / videoDuration) * 100;

      const block = document.createElement('div');
      block.className = 'timeline-segment-block';
      block.style.width = `${widthPct}%`;
      block.style.backgroundColor = color;
      block.title = `Clip ${seg.index}: ${formatTime(seg.start)} - ${formatTime(seg.end)} (${seg.duration}s)`;
      block.textContent = `#${seg.index}`;

      block.addEventListener('click', () => playSegment(seg));
      timelineBar.appendChild(block);

      const chip = document.createElement('div');
      chip.className = 'segment-chip';
      chip.innerHTML = `
        <span class="chip-dot" style="background-color: ${color}"></span>
        <span><strong>Part ${seg.index}</strong>: ${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
        <small style="color: var(--accent-secondary)">(${seg.duration}s)</small>
      `;
      chip.addEventListener('click', () => playSegment(seg));
      segmentChips.appendChild(chip);
    });
  }

  function playSegment(seg) {
    sourceVideo.currentTime = seg.start;
    sourceVideo.play();

    const checkEnd = () => {
      if (sourceVideo.currentTime >= seg.end) {
        sourceVideo.pause();
        sourceVideo.removeEventListener('timeupdate', checkEnd);
      }
    };
    sourceVideo.addEventListener('timeupdate', checkEnd);
  }

  timelineBar.addEventListener('click', (e) => {
    const rect = timelineBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    sourceVideo.currentTime = pos * videoDuration;
  });

  /* -------------------------------------------------------------
     11. Master Export Workflows (Single Omni Video OR Multi-Cutter)
  ------------------------------------------------------------- */
  function syncEditGraphFromState() {
    currentEditGraph.timeline.splitMode = state.splitMode;
    currentEditGraph.timeline.splitDuration = state.duration;
    currentEditGraph.timeline.splitParts = state.parts;
    currentEditGraph.timeline.remainderPolicy = state.remainder;
    currentEditGraph.timeline.speed = state.playbackSpeed;
    currentEditGraph.timeline.inPoint = 0;
    currentEditGraph.timeline.outPoint = videoDuration || 0;

    currentEditGraph.effects.orientation = state.orientation;
    currentEditGraph.effects.fitMode = state.fitMode;
    currentEditGraph.effects.rotation = state.rotation;
    currentEditGraph.effects.flipH = state.flipH;
    currentEditGraph.effects.flipV = state.flipV;
    currentEditGraph.effects.filterPreset = state.filterPreset;
    currentEditGraph.effects.customFilters = { ...state.customFilters };
    currentEditGraph.effects.motion.type = state.motionType;
    currentEditGraph.effects.transition.type = state.transitionType;
    currentEditGraph.effects.transition.duration = state.transDuration;
    currentEditGraph.effects.blurMask.blurRadius = state.blurStrength;
    currentEditGraph.effects.blurMask.frostedSheen = state.frostedSheen;
    currentEditGraph.effects.watermark = { ...state.watermark };

    currentEditGraph.audio.volume = state.volumeMultiplier;
    currentEditGraph.audio.muted = state.isMuted;
    currentEditGraph.exportSettings.resolution = state.resolution;
  }

  function applyEditGraphToUI(graph) {
    if (!graph) return;

    // Timeline & Split
    state.splitMode = graph.timeline.splitMode || 'duration';
    state.duration = graph.timeline.splitDuration || 10;
    state.parts = graph.timeline.splitParts || 6;
    state.remainder = graph.timeline.remainderPolicy || 'keep';
    state.playbackSpeed = graph.timeline.speed || 1.0;

    // Effects & Geometry
    state.orientation = graph.effects.orientation || 'original';
    state.fitMode = graph.effects.fitMode || 'blur';
    state.rotation = graph.effects.rotation || 0;
    state.flipH = !!graph.effects.flipH;
    state.flipV = !!graph.effects.flipV;
    state.filterPreset = graph.effects.filterPreset || 'none';
    if (graph.effects.customFilters) {
      state.customFilters = { ...state.customFilters, ...graph.effects.customFilters };
    }
    state.motionType = graph.effects.motion?.type || 'none';
    state.transitionType = graph.effects.transition?.type || 'none';
    state.transDuration = graph.effects.transition?.duration || 1.0;
    state.blurStrength = graph.effects.blurMask?.blurRadius || 20;
    state.frostedSheen = graph.effects.blurMask?.frostedSheen ?? 0.05;

    // Audio & Settings
    state.volumeMultiplier = graph.audio?.volume ?? 1.0;
    state.isMuted = !!graph.audio?.muted;
    state.resolution = graph.exportSettings?.resolution || '1080p';

    // Synchronize UI DOM inputs
    if (durationInput) durationInput.value = state.duration;
    if (partsInput) partsInput.value = state.parts;
    if (remainderSelect) remainderSelect.value = state.remainder;
    if (speedSlider) { speedSlider.value = state.playbackSpeed; if (speedVal) speedVal.textContent = `${state.playbackSpeed}x`; }
    if (volumeSlider) { volumeSlider.value = Math.round(state.volumeMultiplier * 100); if (volumeVal) volumeVal.textContent = `${Math.round(state.volumeMultiplier * 100)}%`; }
    if (brightnessSlider) { brightnessSlider.value = state.customFilters.brightness; if (brightnessVal) brightnessVal.textContent = `${state.customFilters.brightness}%`; }
    if (contrastSlider) { contrastSlider.value = state.customFilters.contrast; if (contrastVal) contrastVal.textContent = `${state.customFilters.contrast}%`; }
    if (saturationSlider) { saturationSlider.value = state.customFilters.saturation; if (saturationVal) saturationVal.textContent = `${state.customFilters.saturation}%`; }
    if (blurStrengthSlider) { blurStrengthSlider.value = state.blurStrength; if (blurStrengthVal) blurStrengthVal.textContent = `${state.blurStrength}px`; }

    // Toggle filter preset card selection
    document.querySelectorAll('.filter-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.filter === state.filterPreset);
    });

    // Toggle orientation button selection
    document.querySelectorAll('.aspect-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.orientation === state.orientation);
    });

    // Toggle fit mode button selection
    document.querySelectorAll('.fit-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.fit === state.fitMode);
    });

    // Watermark
    if (graph.effects.watermark) {
      state.watermark = { ...state.watermark, ...graph.effects.watermark };
      const wmEnableCb = document.getElementById('wmEnableCheckbox');
      const wmKeyInp = document.getElementById('wmSecretKeyInput');
      const wmIdInp = document.getElementById('wmPayloadIdInput');
      const wmStrInp = document.getElementById('wmStrengthSlider');
      const wmStrVal = document.getElementById('wmStrengthVal');

      if (wmEnableCb) wmEnableCb.checked = !!state.watermark.enabled;
      if (wmKeyInp) wmKeyInp.value = state.watermark.key || '';
      if (wmIdInp) wmIdInp.value = state.watermark.id || 12345;
      if (wmStrInp) {
        wmStrInp.value = state.watermark.strength || 2;
        if (wmStrVal) wmStrVal.textContent = state.watermark.strength || 2;
      }
      const wmAlgoSel = document.getElementById('wmAlgorithmSelect');
      if (wmAlgoSel) wmAlgoSel.value = state.watermark.algorithm || 'dct';
    }

    recalculate();
    updatePreview();
  }

  // Project JSON Save / Load Bindings
  const saveProjectBtn = document.getElementById('saveProjectBtn');
  const loadProjectBtn = document.getElementById('loadProjectBtn');
  const projectFileInput = document.getElementById('projectFileInput');

  if (saveProjectBtn) {
    saveProjectBtn.addEventListener('click', () => {
      syncEditGraphFromState();
      const jsonStr = currentEditGraph.toJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = (currentFile?.name || 'vidcut_project').replace(/\.[^/.]+$/, "");
      a.download = `${baseName}_project.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (loadProjectBtn && projectFileInput) {
    loadProjectBtn.addEventListener('click', () => projectFileInput.click());

    projectFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const loadedGraph = EditGraph.fromJSON(event.target.result);
          currentEditGraph = loadedGraph;
          applyEditGraphToUI(loadedGraph);
          alert('Project loaded successfully!');
        } catch (err) {
          alert('Failed to load project JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      projectFileInput.value = '';
    });
  }

  // Single-clip full video export (for Editor, Blur Brush, Transforms, Speed, Watermark)
  const exportWatermarkedBtn = document.getElementById('exportWatermarkedBtn');
  [exportEditedBtn, exportMaskedBtn, exportTransformBtn, exportSpeedVolumeBtn, exportWatermarkedBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (btn === exportWatermarkedBtn) {
          state.watermark.enabled = true;
          const wmEnableCb = document.getElementById('wmEnableCheckbox');
          if (wmEnableCb) wmEnableCb.checked = true;
        }
        exportSingleOmniVideo();
      });
    }
  });

  async function exportSingleOmniVideo() {
    if (isProcessing || !videoDuration) return;

    syncEditGraphFromState();
    isProcessing = true;
    processingCard.style.display = 'flex';
    resultsSection.style.display = 'none';
    downloadAllZipBtn.style.display = 'none';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    processingStatus.textContent = 'Exporting video with Omni Studio effects...';

    const singleGraph = currentEditGraph.clone();
    singleGraph.timeline.splitMode = 'duration';
    singleGraph.timeline.splitDuration = videoDuration;
    singleGraph.timeline.inPoint = 0;
    singleGraph.timeline.outPoint = videoDuration;

    try {
      const results = await engine.exportPipeline(
        singleGraph,
        sourceVideo,
        maskCanvas,
        ({ segmentProgress }) => {
          const pct = Math.round(segmentProgress * 100);
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          processingStatus.textContent = `Rendering frame effects (${pct}%)...`;
        }
      );

      displayResults(results);

    } catch (err) {
      if (!err.message.includes('cancelled')) {
        console.error(err);
        alert('Export error: ' + err.message);
      }
    } finally {
      isProcessing = false;
      processingCard.style.display = 'none';
    }
  }

  // Multi-segment cutter batch export
  masterCutBtn.addEventListener('click', async () => {
    if (isProcessing || calculatedSegments.length === 0) return;

    syncEditGraphFromState();
    isProcessing = true;
    masterCutBtn.disabled = true;
    processingCard.style.display = 'flex';
    resultsSection.style.display = 'none';
    downloadAllZipBtn.style.display = 'inline-flex';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    processingStatus.textContent = `Starting export of ${calculatedSegments.length} clips...`;

    const startTime = performance.now();

    try {
      generatedResults = await engine.exportPipeline(
        currentEditGraph,
        sourceVideo,
        maskCanvas,
        ({ currentIndex, totalSegments, overallProgress }) => {
          const pct = Math.round(overallProgress * 100);
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          processingStatus.textContent = `Processing Clip ${currentIndex} of ${totalSegments}...`;

          const elapsed = (performance.now() - startTime) / 1000;
          if (overallProgress > 0.05) {
            const totalEst = elapsed / overallProgress;
            const remaining = Math.max(0, Math.round(totalEst - elapsed));
            processingDetails.innerHTML = `<span>Elapsed: ${Math.round(elapsed)}s</span><span>Estimated remaining: ~${remaining}s</span>`;
          }
        }
      );

      displayResults(generatedResults);

    } catch (err) {
      if (!err.message.includes('cancelled')) {
        console.error(err);
        alert('Export error: ' + err.message);
      }
    } finally {
      isProcessing = false;
      masterCutBtn.disabled = false;
      processingCard.style.display = 'none';
    }
  });

  cancelBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel the export?')) {
      engine.cancel();
    }
  });

  /* -------------------------------------------------------------
     12. Results Display & Download
  ------------------------------------------------------------- */
  function displayResults(results) {
    resultsGrid.innerHTML = '';
    generatedResults = results;
    resultsCount.textContent = `🎉 ${results.length} Video${results.length > 1 ? 's' : ''} Exported Successfully`;

    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, "") : "video";
    const orientSlug = state.orientation.replace(':', 'x');

    let totalBytes = 0;

    results.forEach((res) => {
      totalBytes += res.sizeBytes;
      const fileName = results.length > 1
        ? `${baseName}_part_${String(res.segment.index).padStart(2, '0')}_${orientSlug}.${res.extension}`
        : `${baseName}_omni_edited.${res.extension}`;

      const card = document.createElement('div');
      card.className = 'result-card';

      let ratioClass = '';
      if (state.orientation === '1:1') ratioClass = 'ratio-1-1';
      else if (state.orientation === '16:9') ratioClass = 'ratio-16-9';
      else if (state.orientation === '4:5') ratioClass = 'ratio-4-5';

      card.innerHTML = `
        <div class="result-video-wrapper ${ratioClass}">
          <video src="${res.url}" controls preload="metadata"></video>
        </div>
        <div class="result-content">
          <div class="result-info">
            <span class="result-name">${results.length > 1 ? 'Part ' + res.segment.index : 'Edited Video'}</span>
            <span class="result-duration">${res.segment.duration.toFixed(1)}s</span>
          </div>
          <div class="result-meta">
            ${res.width}×${res.height} • ${formatBytes(res.sizeBytes)} • ${state.filterPreset !== 'none' ? state.filterPreset : 'Original Tone'}
          </div>
          <a class="btn btn-secondary btn-sm" href="${res.url}" download="${fileName}">
            ⬇️ Download ${res.extension.toUpperCase()}
          </a>
        </div>
      `;
      resultsGrid.appendChild(card);
    });

    if (results.length > 1) {
      downloadAllZipBtn.style.display = 'inline-flex';
      downloadAllZipBtn.textContent = `📦 Download All as ZIP (${formatBytes(totalBytes)})`;
    } else {
      downloadAllZipBtn.style.display = 'none';
    }

    resultsSection.style.display = 'flex';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  // Master ZIP Download
  downloadAllZipBtn.addEventListener('click', async () => {
    if (!window.JSZip || !generatedResults.length) return;

    downloadAllZipBtn.disabled = true;
    downloadAllZipBtn.textContent = '⏳ Compressing into ZIP...';

    try {
      const zip = new JSZip();
      const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, "") : "video";
      const orientSlug = state.orientation.replace(':', 'x');

      for (const res of generatedResults) {
        const fileName = `${baseName}_part_${String(res.segment.index).padStart(2, '0')}_${orientSlug}.${res.extension}`;
        zip.file(fileName, res.blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);

      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `${baseName}_split_segments.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);

    } catch (err) {
      console.error(err);
      alert('Error creating ZIP: ' + err.message);
    } finally {
      downloadAllZipBtn.disabled = false;
      downloadAllZipBtn.textContent = '📦 Download All as ZIP';
    }
  });

  /* -------------------------------------------------------------
     13. Watermark Studio & Independent Detector Workflows
  ------------------------------------------------------------- */
  const wmSubtabEmbed = document.getElementById('wmSubtabEmbed');
  const wmSubtabVerify = document.getElementById('wmSubtabVerify');
  const wmSubtabDiff = document.getElementById('wmSubtabDiff');
  const wmSectionEmbed = document.getElementById('wmSectionEmbed');
  const wmSectionVerify = document.getElementById('wmSectionVerify');
  const wmSectionDiff = document.getElementById('wmSectionDiff');

  // Subtab switching
  if (wmSubtabEmbed && wmSubtabVerify && wmSubtabDiff) {
    const switchWmSubtab = (activeTab, activeSec) => {
      [wmSubtabEmbed, wmSubtabVerify, wmSubtabDiff].forEach(t => t.classList.remove('active'));
      [wmSectionEmbed, wmSectionVerify, wmSectionDiff].forEach(s => s.style.display = 'none');
      activeTab.classList.add('active');
      activeSec.style.display = 'block';
    };

    wmSubtabEmbed.addEventListener('click', () => switchWmSubtab(wmSubtabEmbed, wmSectionEmbed));
    wmSubtabVerify.addEventListener('click', () => switchWmSubtab(wmSubtabVerify, wmSectionVerify));
    wmSubtabDiff.addEventListener('click', () => {
      switchWmSubtab(wmSubtabDiff, wmSectionDiff);
      renderDiffInspector('diff');
    });
  }

  // Embed controls
  const wmEnableCheckbox = document.getElementById('wmEnableCheckbox');
  const wmSecretKeyInput = document.getElementById('wmSecretKeyInput');
  const wmRandomKeyBtn = document.getElementById('wmRandomKeyBtn');
  const wmPayloadIdInput = document.getElementById('wmPayloadIdInput');
  const wmStrengthSlider = document.getElementById('wmStrengthSlider');
  const wmStrengthVal = document.getElementById('wmStrengthVal');
  const wmAlgorithmSelect = document.getElementById('wmAlgorithmSelect');

  if (wmAlgorithmSelect) {
    wmAlgorithmSelect.addEventListener('change', (e) => {
      state.watermark.algorithm = e.target.value;
      updatePreview();
    });
  }

  if (wmEnableCheckbox) {
    wmEnableCheckbox.addEventListener('change', (e) => {
      state.watermark.enabled = e.target.checked;
      updatePreview();
    });
  }

  if (wmSecretKeyInput) {
    wmSecretKeyInput.addEventListener('input', (e) => {
      state.watermark.key = e.target.value.trim();
      const detKey = document.getElementById('detectorSecretKeyInput');
      if (detKey) detKey.value = state.watermark.key;
    });
  }

  if (wmRandomKeyBtn) {
    wmRandomKeyBtn.addEventListener('click', () => {
      const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let randKey = 'vc-';
      for (let i = 0; i < 12; i++) {
        randKey += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      state.watermark.key = randKey;
      if (wmSecretKeyInput) wmSecretKeyInput.value = randKey;
      const detKey = document.getElementById('detectorSecretKeyInput');
      if (detKey) detKey.value = randKey;
    });
  }

  if (wmPayloadIdInput) {
    wmPayloadIdInput.addEventListener('input', (e) => {
      state.watermark.id = parseInt(e.target.value, 10) || 12345;
    });
  }

  if (wmStrengthSlider && wmStrengthVal) {
    wmStrengthSlider.addEventListener('input', (e) => {
      state.watermark.strength = parseInt(e.target.value, 10) || 2;
      wmStrengthVal.textContent = state.watermark.strength;
      updatePreview();
    });
  }

  // Independent Detector
  const detectorDropzone = document.getElementById('detectorDropzone');
  const detectorFileInput = document.getElementById('detectorFileInput');
  const detectorFileLabel = document.getElementById('detectorFileLabel');
  const detectorSecretKeyInput = document.getElementById('detectorSecretKeyInput');
  const runDetectorBtn = document.getElementById('runDetectorBtn');
  const detectorResultCard = document.getElementById('detectorResultCard');
  const detectorStatusBadge = document.getElementById('detectorStatusBadge');
  const detectorConfidenceVal = document.getElementById('detectorConfidenceVal');
  const detectorConfidenceBar = document.getElementById('detectorConfidenceBar');
  const detectorWatermarkId = document.getElementById('detectorWatermarkId');
  const detectorZScore = document.getElementById('detectorZScore');
  const detectorCrcStatus = document.getElementById('detectorCrcStatus');
  const detectorFramesAnalyzed = document.getElementById('detectorFramesAnalyzed');
  const detectorMessage = document.getElementById('detectorMessage');

  let detectorSelectedFile = null;

  if (detectorDropzone && detectorFileInput) {
    detectorDropzone.addEventListener('click', () => detectorFileInput.click());
    detectorFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        detectorSelectedFile = e.target.files[0];
        detectorFileLabel.textContent = `Selected: ${detectorSelectedFile.name} (${formatBytes(detectorSelectedFile.size)})`;
      }
    });

    detectorDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      detectorDropzone.style.borderColor = 'var(--accent-primary)';
    });

    detectorDropzone.addEventListener('dragleave', () => {
      detectorDropzone.style.borderColor = 'var(--border-color)';
    });

    detectorDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      detectorDropzone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        detectorSelectedFile = e.dataTransfer.files[0];
        detectorFileLabel.textContent = `Selected: ${detectorSelectedFile.name} (${formatBytes(detectorSelectedFile.size)})`;
      }
    });
  }

  if (runDetectorBtn) {
    runDetectorBtn.addEventListener('click', async () => {
      const fileToVerify = detectorSelectedFile || currentFile;
      if (!fileToVerify) {
        alert('Please choose or drop an exported video file to verify.');
        return;
      }
      const key = (detectorSecretKeyInput?.value || state.watermark.key || '').trim();
      if (!key) {
        alert('Please provide the secret verification key.');
        return;
      }

      runDetectorBtn.disabled = true;
      runDetectorBtn.textContent = '⏳ Analyzing video frames...';
      detectorResultCard.style.display = 'block';
      detectorStatusBadge.className = 'badge';
      detectorStatusBadge.style.background = '#6366f1';
      detectorStatusBadge.textContent = 'Decoding & Analyzing...';
      detectorConfidenceVal.textContent = '0%';
      detectorConfidenceBar.style.width = '0%';
      detectorConfidenceBar.style.background = '#6366f1';

      try {
        const result = await WatermarkEngine.detectWatermark(
          fileToVerify,
          key,
          { numFrames: 12, samplesPerBit: 48 },
          ({ framesAnalyzed, totalFrames, progress }) => {
            const pct = Math.round(progress * 100);
            detectorConfidenceVal.textContent = `Analyzing ${framesAnalyzed}/${totalFrames} frames...`;
            detectorConfidenceBar.style.width = `${pct}%`;
          }
        );

        // Update Readout
        detectorConfidenceVal.textContent = `${result.confidence}%`;
        detectorConfidenceBar.style.width = `${result.confidence}%`;
        detectorWatermarkId.textContent = result.watermarkId !== null ? result.watermarkId : 'None';
        detectorZScore.textContent = `${result.zScore}σ`;
        detectorCrcStatus.textContent = result.crcValid ? '✅ Valid (Integrity Verified)' : '❌ Mismatch / Invalid';
        detectorFramesAnalyzed.textContent = `${result.framesAnalyzed} frames`;
        detectorMessage.textContent = result.verdictMessage;

        if (result.status === 'DETECTED') {
          detectorStatusBadge.className = 'badge';
          detectorStatusBadge.style.background = '#10b981';
          detectorStatusBadge.textContent = '✅ Verified (Watermark Detected)';
          detectorConfidenceBar.style.background = '#10b981';
        } else if (result.status === 'INCONCLUSIVE') {
          detectorStatusBadge.className = 'badge';
          detectorStatusBadge.style.background = '#f59e0b';
          detectorStatusBadge.textContent = '⚠️ Inconclusive';
          detectorConfidenceBar.style.background = '#f59e0b';
        } else {
          detectorStatusBadge.className = 'badge';
          detectorStatusBadge.style.background = '#ef4444';
          detectorStatusBadge.textContent = '❌ Watermark Not Detected';
          detectorConfidenceBar.style.background = '#ef4444';
        }

      } catch (err) {
        console.error('Detector error:', err);
        detectorStatusBadge.className = 'badge';
        detectorStatusBadge.style.background = '#ef4444';
        detectorStatusBadge.textContent = '❌ Error';
        detectorMessage.textContent = 'Detection failed: ' + err.message;
      } finally {
        runDetectorBtn.disabled = false;
        runDetectorBtn.textContent = '🔍 Run Independent Verification';
      }
    });
  }

  // Visual Difference Inspector
  const diffViewOriginalBtn = document.getElementById('diffViewOriginalBtn');
  const diffViewWatermarkedBtn = document.getElementById('diffViewWatermarkedBtn');
  const diffViewAmplifiedBtn = document.getElementById('diffViewAmplifiedBtn');
  const wmDiffCanvas = document.getElementById('wmDiffCanvas');
  const diffViewCaption = document.getElementById('diffViewCaption');

  function renderDiffInspector(mode) {
    if (!wmDiffCanvas || !sourceVideo || sourceVideo.readyState < 2) return;

    [diffViewOriginalBtn, diffViewWatermarkedBtn, diffViewAmplifiedBtn].forEach(b => {
      if (b) b.classList.remove('active');
    });

    const w = 480;
    const h = Math.round(w * (sourceVideo.videoHeight / (sourceVideo.videoWidth || 1))) || 270;
    wmDiffCanvas.width = w;
    wmDiffCanvas.height = h;
    const ctx = wmDiffCanvas.getContext('2d');

    // Create temp original canvas
    const origCanvas = document.createElement('canvas');
    origCanvas.width = w;
    origCanvas.height = h;
    const oCtx = origCanvas.getContext('2d');
    oCtx.drawImage(sourceVideo, 0, 0, w, h);

    // Create temp watermarked canvas
    const wmCanvas = document.createElement('canvas');
    wmCanvas.width = w;
    wmCanvas.height = h;
    const wCtx = wmCanvas.getContext('2d');
    wCtx.drawImage(sourceVideo, 0, 0, w, h);
    WatermarkEngine.embedFrame(wCtx, w, h, {
      enabled: true,
      key: state.watermark.key,
      id: state.watermark.id,
      strength: state.watermark.strength,
      samplesPerBit: 48
    }, sourceVideo.currentTime);

    if (mode === 'orig') {
      if (diffViewOriginalBtn) diffViewOriginalBtn.classList.add('active');
      ctx.drawImage(origCanvas, 0, 0);
      if (diffViewCaption) diffViewCaption.textContent = 'Showing: Original Video Frame (No Watermark)';
    } else if (mode === 'wm') {
      if (diffViewWatermarkedBtn) diffViewWatermarkedBtn.classList.add('active');
      ctx.drawImage(wmCanvas, 0, 0);
      if (diffViewCaption) diffViewCaption.textContent = 'Showing: Watermarked Video Frame (Imperceptible to Human Eye)';
    } else {
      if (diffViewAmplifiedBtn) diffViewAmplifiedBtn.classList.add('active');
      WatermarkEngine.computeVisualDifference(origCanvas, wmCanvas, wmDiffCanvas, 30);
      if (diffViewCaption) diffViewCaption.textContent = 'Showing: 30× Amplified Luminance Delta (Revealing Keyed Pixel Pattern)';
    }
  }

  if (diffViewOriginalBtn) diffViewOriginalBtn.addEventListener('click', () => renderDiffInspector('orig'));
  if (diffViewWatermarkedBtn) diffViewWatermarkedBtn.addEventListener('click', () => renderDiffInspector('wm'));
  if (diffViewAmplifiedBtn) diffViewAmplifiedBtn.addEventListener('click', () => renderDiffInspector('diff'));

  /* -------------------------------------------------------------
     14. Merge Videos Panel Workflows
  ------------------------------------------------------------- */
  const mergeDropzone = document.getElementById('mergeDropzone');
  const mergeFileInput = document.getElementById('mergeFileInput');
  const mergeClipsList = document.getElementById('mergeClipsList');
  const startMergeBtn = document.getElementById('startMergeBtn');

  let mergeVideoFiles = [];

  if (mergeDropzone && mergeFileInput) {
    mergeDropzone.addEventListener('click', () => mergeFileInput.click());

    const handleMergeFiles = (files) => {
      for (const f of files) {
        if (f.type.startsWith('video/') || f.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
          mergeVideoFiles.push(f);
        }
      }
      renderMergeList();
    };

    mergeFileInput.addEventListener('change', (e) => {
      if (e.target.files) handleMergeFiles(e.target.files);
    });

    mergeDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      mergeDropzone.style.borderColor = 'var(--accent-primary)';
    });

    mergeDropzone.addEventListener('dragleave', () => {
      mergeDropzone.style.borderColor = 'var(--border-color)';
    });

    mergeDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      mergeDropzone.style.borderColor = 'var(--border-color)';
      if (e.dataTransfer.files) handleMergeFiles(e.dataTransfer.files);
    });
  }

  function renderMergeList() {
    if (!mergeClipsList) return;
    mergeClipsList.innerHTML = '';

    if (mergeVideoFiles.length === 0) {
      if (startMergeBtn) startMergeBtn.style.display = 'none';
      return;
    }

    mergeVideoFiles.forEach((f, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-color); border-radius: 6px; font-size: 12.5px;';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="background: var(--accent-primary); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">${idx + 1}</span>
          <span style="color: var(--text-main); font-weight: 500;">${f.name}</span>
          <span style="color: var(--text-dim); font-size: 11px;">(${formatBytes(f.size)})</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm remove-clip-btn" data-index="${idx}" style="padding: 2px 8px; font-size: 11px;">✕</button>
      `;
      mergeClipsList.appendChild(row);
    });

    mergeClipsList.querySelectorAll('.remove-clip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        mergeVideoFiles.splice(idx, 1);
        renderMergeList();
      });
    });

    if (startMergeBtn) {
      startMergeBtn.style.display = mergeVideoFiles.length >= 2 ? 'block' : 'none';
      startMergeBtn.textContent = `🔗 Concatenate & Export ${mergeVideoFiles.length} Merged Clips`;
    }
  }

  if (startMergeBtn) {
    startMergeBtn.addEventListener('click', async () => {
      if (isProcessing || mergeVideoFiles.length < 2) return;

      isProcessing = true;
      startMergeBtn.disabled = true;
      processingCard.style.display = 'flex';
      resultsSection.style.display = 'none';
      downloadAllZipBtn.style.display = 'none';
      progressFill.style.width = '0%';
      progressPercent.textContent = '0%';
      processingStatus.textContent = `Merging ${mergeVideoFiles.length} clips into continuous video...`;

      try {
        const result = await engine.rejoinVideos(mergeVideoFiles, { width: 1280, height: 720 }, ({ currentClip, totalClips, overallProgress }) => {
          const pct = Math.round(overallProgress * 100);
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          processingStatus.textContent = `Merging Clip ${currentClip} of ${totalClips}...`;
        });

        displayResults([{
          segment: { index: 1 },
          blob: result.blob,
          url: result.url,
          extension: result.extension,
          sizeBytes: result.sizeBytes,
          width: result.width,
          height: result.height
        }]);

      } catch (err) {
        if (!err.message.includes('cancelled')) {
          console.error(err);
          alert('Merge error: ' + err.message);
        }
      } finally {
        isProcessing = false;
        startMergeBtn.disabled = false;
        processingCard.style.display = 'none';
      }
    });
  }

  /* -------------------------------------------------------------
     Helpers
  ------------------------------------------------------------- */
  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function getAspectLabel(w, h) {
    const ratio = w / h;
    if (Math.abs(ratio - 16/9) < 0.05) return '16:9 (Landscape)';
    if (Math.abs(ratio - 9/16) < 0.05) return '9:16 (Portrait)';
    if (Math.abs(ratio - 1) < 0.05) return '1:1 (Square)';
    if (Math.abs(ratio - 4/5) < 0.05) return '4:5 (Feed)';
    return `${w}:${h}`;
  }
});
