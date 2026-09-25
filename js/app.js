/**
 * VidCut Studio - Main UI & Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = new VideoEngine();

  // State
  let currentFile = null;
  let videoDuration = 0;
  let videoWidth = 0;
  let videoHeight = 0;
  let videoBlobUrl = null;
  let calculatedSegments = [];
  let generatedResults = [];
  let isProcessing = false;
  let currentPreviewMode = 'source'; // 'source' or 'transform'

  // Settings State
  const state = {
    splitMode: 'duration', // 'duration' or 'parts'
    duration: 10,
    parts: 6,
    remainder: 'keep', // 'keep', 'merge', 'discard'
    orientation: '9:16', // '9:16', '1:1', '16:9', '4:5', 'original'
    fitMode: 'blur', // 'blur', 'crop', 'fit'
    resolution: '1080p',
    playbackSpeed: 1.0
  };

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const sampleBtn = document.getElementById('sampleBtn');
  const urlInput = document.getElementById('urlInput');
  const loadUrlBtn = document.getElementById('loadUrlBtn');

  const workspace = document.getElementById('workspace');
  const sourceVideo = document.getElementById('sourceVideo');
  const previewCanvas = document.getElementById('previewCanvas');
  const stageBadge = document.getElementById('stageBadge');

  const tabSource = document.getElementById('tabSource');
  const tabTransform = document.getElementById('tabTransform');

  const infoFileName = document.getElementById('infoFileName');
  const infoDuration = document.getElementById('infoDuration');
  const infoResolution = document.getElementById('infoResolution');
  const infoAspect = document.getElementById('infoAspect');
  const infoFileSize = document.getElementById('infoFileSize');

  const timelineBar = document.getElementById('timelineBar');
  const timelineNeedle = document.getElementById('timelineNeedle');
  const timelineTime = document.getElementById('timelineTime');
  const segmentChips = document.getElementById('segmentChips');

  const modeDurationBtn = document.getElementById('modeDurationBtn');
  const modePartsBtn = document.getElementById('modePartsBtn');
  const durationControlGroup = document.getElementById('durationControlGroup');
  const partsControlGroup = document.getElementById('partsControlGroup');
  const durationInput = document.getElementById('durationInput');
  const partsInput = document.getElementById('partsInput');
  const remainderSelect = document.getElementById('remainderSelect');
  const resolutionSelect = document.getElementById('resolutionSelect');
  const summaryBox = document.getElementById('summaryBox');
  const masterCutBtn = document.getElementById('masterCutBtn');

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

  // Aspect and framing cards
  const aspectCards = document.querySelectorAll('.aspect-card');
  const framingCards = document.querySelectorAll('.framing-card');
  const presetPills = document.querySelectorAll('.preset-pill');

  /* -------------------------------------------------------------
     1. Video Loading & Ingestion
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

  // Drag & Drop
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

  // URL Loader
  loadUrlBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = urlInput.value.trim();
    if (!url) return alert('Please enter a valid video URL or raw GitHub link.');

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
      alert(`Could not load video from URL: ${err.message}. Please ensure the URL supports CORS or upload the file directly.`);
    } finally {
      loadUrlBtn.disabled = false;
      loadUrlBtn.textContent = 'Load Video';
    }
  });

  // Sample Video Generator
  sampleBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    sampleBtn.disabled = true;
    sampleBtn.innerHTML = '⏳ Generating sample...';

    try {
      const sample = await engine.generateSampleVideo(60); // 60-second test video
      const file = new File([sample.blob], 'sample_60s_countdown.mp4', { type: sample.mime });
      handleFile(file);
    } catch (err) {
      console.error(err);
      alert('Error generating sample: ' + err.message);
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

      // Update info bar
      infoFileName.textContent = file.name;
      infoDuration.textContent = formatTime(videoDuration);
      infoResolution.textContent = `${videoWidth} × ${videoHeight}`;
      infoAspect.textContent = getAspectLabel(videoWidth, videoHeight);
      infoFileSize.textContent = formatBytes(file.size);

      // Show workspace
      workspace.style.display = 'block';
      resultsSection.style.display = 'none';

      // Auto update calculation
      recalculate();

      // Render initial preview
      setTimeout(() => {
        updatePreview();
      }, 200);

      // Scroll smoothly to workspace
      workspace.scrollIntoView({ behavior: 'smooth' });
    };
  }

  /* -------------------------------------------------------------
     2. Preview Mode Tabs & Canvas Updates
  ------------------------------------------------------------- */
  tabSource.addEventListener('click', () => {
    currentPreviewMode = 'source';
    tabSource.classList.add('active');
    tabTransform.classList.remove('active');
    sourceVideo.style.display = 'block';
    previewCanvas.style.display = 'none';
    stageBadge.textContent = 'Original Source Video';
  });

  tabTransform.addEventListener('click', () => {
    currentPreviewMode = 'transform';
    tabTransform.classList.add('active');
    tabSource.classList.remove('active');
    sourceVideo.style.display = 'none';
    previewCanvas.style.display = 'block';
    stageBadge.textContent = `Live Transform (${state.orientation} • ${getFramingLabel(state.fitMode)})`;
    updatePreview();
  });

  function updatePreview() {
    if (currentPreviewMode === 'transform' && sourceVideo.readyState >= 2) {
      engine.renderPreview(sourceVideo, previewCanvas, state.orientation, state.fitMode, state.resolution);
      stageBadge.textContent = `Live Transform (${state.orientation} • ${getFramingLabel(state.fitMode)})`;
    }
  }

  // Update preview whenever video seeks or plays
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
     3. Settings Controls & Slicing Calculations
  ------------------------------------------------------------- */
  // Split Mode switch
  modeDurationBtn.addEventListener('click', () => {
    state.splitMode = 'duration';
    modeDurationBtn.classList.add('active');
    modePartsBtn.classList.remove('active');
    durationControlGroup.style.display = 'flex';
    partsControlGroup.style.display = 'none';
    recalculate();
  });

  modePartsBtn.addEventListener('click', () => {
    state.splitMode = 'parts';
    modePartsBtn.classList.add('active');
    modeDurationBtn.classList.remove('active');
    durationControlGroup.style.display = 'none';
    partsControlGroup.style.display = 'flex';
    recalculate();
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

  resolutionSelect.addEventListener('change', (e) => {
    state.resolution = e.target.value;
    updatePreview();
  });

  // Aspect ratio cards
  aspectCards.forEach(card => {
    card.addEventListener('click', () => {
      aspectCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.orientation = card.dataset.aspect;
      updatePreview();
    });
  });

  // Framing style cards
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
     4. Timeline & Interactive Segments
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

      // Timeline block
      const block = document.createElement('div');
      block.className = 'timeline-segment-block';
      block.style.width = `${widthPct}%`;
      block.style.backgroundColor = color;
      block.title = `Clip ${seg.index}: ${formatTime(seg.start)} - ${formatTime(seg.end)} (${seg.duration}s)`;
      block.textContent = `#${seg.index}`;

      block.addEventListener('click', () => {
        playSegment(seg);
      });
      timelineBar.appendChild(block);

      // Segment Chip
      const chip = document.createElement('div');
      chip.className = 'segment-chip';
      chip.innerHTML = `
        <span class="chip-dot" style="background-color: ${color}"></span>
        <span><strong>Part ${seg.index}</strong>: ${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
        <small style="color: var(--accent-secondary)">(${seg.duration}s)</small>
      `;
      chip.addEventListener('click', () => {
        playSegment(seg);
      });
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

  // Click on timeline to scrub
  timelineBar.addEventListener('click', (e) => {
    if (e.target.classList.contains('timeline-segment-block') || e.target === timelineBar) {
      const rect = timelineBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      sourceVideo.currentTime = pos * videoDuration;
    }
  });

  /* -------------------------------------------------------------
     5. Slicing & Processing Workflow
  ------------------------------------------------------------- */
  masterCutBtn.addEventListener('click', async () => {
    if (isProcessing || calculatedSegments.length === 0) return;

    isProcessing = true;
    masterCutBtn.disabled = true;
    processingCard.style.display = 'flex';
    resultsSection.style.display = 'none';
    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    processingStatus.textContent = `Starting export of ${calculatedSegments.length} clips...`;

    // Ensure audio context is running on user interaction
    engine.initAudio(sourceVideo);

    const startTime = performance.now();

    try {
      generatedResults = await engine.processAllSegments(
        sourceVideo,
        calculatedSegments,
        {
          orientation: state.orientation,
          fitMode: state.fitMode,
          resolution: state.resolution,
          playbackSpeed: state.playbackSpeed
        },
        ({ currentIndex, totalSegments, overallProgress }) => {
          const pct = Math.round(overallProgress * 100);
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          processingStatus.textContent = `Processing Clip ${currentIndex} of ${totalSegments}...`;

          // Estimate remaining time
          const elapsed = (performance.now() - startTime) / 1000;
          if (overallProgress > 0.05) {
            const totalEst = elapsed / overallProgress;
            const remaining = Math.max(0, Math.round(totalEst - elapsed));
            processingDetails.innerHTML = `<span>Elapsed: ${Math.round(elapsed)}s</span><span>Estimated remaining: ~${remaining}s</span>`;
          }
        }
      );

      // Finished!
      displayResults(generatedResults);

    } catch (err) {
      if (err.message.includes('cancelled')) {
        processingStatus.textContent = 'Export cancelled by user.';
      } else {
        console.error(err);
        alert('Processing error: ' + err.message);
      }
    } finally {
      isProcessing = false;
      masterCutBtn.disabled = false;
      processingCard.style.display = 'none';
    }
  });

  cancelBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to stop processing?')) {
      engine.cancel();
    }
  });

  /* -------------------------------------------------------------
     6. Results & Batch Download
  ------------------------------------------------------------- */
  function displayResults(results) {
    resultsGrid.innerHTML = '';
    resultsCount.textContent = `🎉 ${results.length} Segments Generated Successfully`;

    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, "") : "video";
    const orientSlug = state.orientation.replace(':', 'x');

    let totalBytes = 0;

    results.forEach((res, i) => {
      totalBytes += res.sizeBytes;
      const fileName = `${baseName}_part_${String(res.segment.index).padStart(2, '0')}_${orientSlug}.${res.extension}`;

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
            <span class="result-name">Part ${res.segment.index}</span>
            <span class="result-duration">${res.segment.duration}s</span>
          </div>
          <div class="result-meta">
            ${res.width}×${res.height} • ${formatBytes(res.sizeBytes)} • ${state.orientation}
          </div>
          <a class="btn btn-secondary btn-sm" href="${res.url}" download="${fileName}">
            ⬇️ Download ${res.extension.toUpperCase()}
          </a>
        </div>
      `;
      resultsGrid.appendChild(card);
    });

    downloadAllZipBtn.textContent = `📦 Download All as ZIP (${formatBytes(totalBytes)})`;
    resultsSection.style.display = 'flex';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  // Master ZIP Download
  downloadAllZipBtn.addEventListener('click', async () => {
    if (!window.JSZip) {
      return alert('JSZip library is still loading. Please try again.');
    }
    if (!generatedResults.length) return;

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

  function getFramingLabel(fit) {
    if (fit === 'blur') return 'Blurred Background';
    if (fit === 'crop') return 'Smart Center Crop';
    return 'Letterbox / Pillarbox';
  }
});
