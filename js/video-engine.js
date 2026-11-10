/**
 * VidCut Omni Studio - Core Video Engine
 * 100% Client-Side Lightweight Video Processing
 * Features: Filters, Film Grain, Motion Zoom, Transitions, Blur Mask,
 * Orientation Framing, Audio Control, Slicing, and Recording.
 */

class VideoEngine {
  constructor() {
    this.audioCtx = null;
    this.audioSourceNode = null;
    this.audioGainNode = null;
    this.audioDestNode = null;
    this.isAudioConnected = false;
    this.abortController = null;

    // Offscreen helper canvases for zero-lag compositing
    this.blurBufferCanvas = document.createElement('canvas');
    this.blurBufferCtx = this.blurBufferCanvas.getContext('2d', { alpha: true });

    // Procedural noise tile for 35mm fine grain (cached for speed)
    this.noiseTile = this.createNoiseTile(256, 256);
  }

  /**
   * Generates a reusable procedural noise tile for ultra-fast 35mm film grain
   */
  createNoiseTile(width = 256, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      data[i] = val;     // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      data[i + 3] = 40;  // Subtle alpha
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Initialize Web Audio context with gain control
   */
  initAudio(videoElement, volumeMultiplier = 1.0) {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (!this.isAudioConnected && videoElement) {
      try {
        this.audioSourceNode = this.audioCtx.createMediaElementSource(videoElement);
        this.audioGainNode = this.audioCtx.createGain();
        this.audioDestNode = this.audioCtx.createMediaStreamDestination();

        this.audioSourceNode.connect(this.audioGainNode);
        this.audioGainNode.connect(this.audioDestNode);
        // Connect to speaker destination so user can hear if not muted
        this.audioGainNode.connect(this.audioCtx.destination);

        this.isAudioConnected = true;
      } catch (err) {
        console.warn('Audio node connection notice:', err);
      }
    }

    if (this.audioGainNode) {
      this.audioGainNode.gain.setValueAtTime(volumeMultiplier, this.audioCtx.currentTime);
    }
  }

  /**
   * Set volume gain on the active audio stream
   */
  setVolume(multiplier) {
    if (this.audioGainNode && this.audioCtx) {
      this.audioGainNode.gain.setValueAtTime(Math.max(0, multiplier), this.audioCtx.currentTime);
    }
  }

  /**
   * Determine target dimensions based on orientation and resolution
   */
  getTargetDimensions(orientation, resolution = '1080p', srcW = 1920, srcH = 1080) {
    const is720p = resolution === '720p';

    switch (orientation) {
      case '9:16':
        return is720p ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
      case '1:1':
        return is720p ? { width: 720, height: 720 } : { width: 1080, height: 1080 };
      case '16:9':
        return is720p ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
      case '4:5':
        return is720p ? { width: 720, height: 900 } : { width: 1080, height: 1350 };
      case 'original':
      default: {
        const aspect = srcW / srcH;
        const maxDim = is720p ? 1280 : 1920;
        if (srcW >= srcH) {
          const w = Math.min(srcW, maxDim);
          const h = Math.round(w / aspect);
          return { width: (w % 2 === 0 ? w : w - 1), height: (h % 2 === 0 ? h : h - 1) };
        } else {
          const h = Math.min(srcH, maxDim);
          const w = Math.round(h * aspect);
          return { width: (w % 2 === 0 ? w : w - 1), height: (h % 2 === 0 ? h : h - 1) };
        }
      }
    }
  }

  /**
   * Build CSS Filter string based on Preset and Custom Fine-tuning
   */
  buildFilterString(preset = 'none', custom = {}) {
    let base = '';
    switch (preset) {
      case 'grayscale':
        base = 'grayscale(100%)';
        break;
      case 'fine_grain':
        base = 'contrast(115%) brightness(96%)';
        break;
      case 'olden_days':
        base = 'sepia(85%) contrast(125%) brightness(88%)';
        break;
      case 'future':
        base = 'hue-rotate(185deg) saturate(160%) contrast(135%)';
        break;
      case 'noir':
        base = 'grayscale(100%) contrast(165%) brightness(80%)';
        break;
      case 'vintage':
        base = 'sepia(45%) saturate(135%) contrast(110%)';
        break;
      case 'cyberpunk':
        base = 'contrast(140%) saturate(180%) hue-rotate(90deg)';
        break;
      case 'warm_sunset':
        base = 'sepia(35%) saturate(145%) brightness(105%)';
        break;
      case 'cool_arctic':
        base = 'hue-rotate(200deg) saturate(120%) brightness(102%)';
        break;
      case 'none':
      default:
        base = 'none';
        break;
    }

    // Append custom sliders if provided
    const parts = base !== 'none' ? [base] : [];
    if (custom.brightness && custom.brightness !== 100) parts.push(`brightness(${custom.brightness}%)`);
    if (custom.contrast && custom.contrast !== 100) parts.push(`contrast(${custom.contrast}%)`);
    if (custom.saturation && custom.saturation !== 100) parts.push(`saturate(${custom.saturation}%)`);
    if (custom.sepia && custom.sepia > 0) parts.push(`sepia(${custom.sepia}%)`);
    if (custom.hueRotate && custom.hueRotate !== 0) parts.push(`hue-rotate(${custom.hueRotate}deg)`);

    return parts.length > 0 ? parts.join(' ') : 'none';
  }

  /**
   * Applies Parametric Motion Zoom, Pan, or Camera Shake
   */
  applyMotionTransform(ctx, targetW, targetH, motionType, progress = 0) {
    if (!motionType || motionType === 'none') return;

    ctx.save();
    // Center origin
    ctx.translate(targetW / 2, targetH / 2);

    let scale = 1.0;
    let dx = 0;
    let dy = 0;

    switch (motionType) {
      case 'zoom_in':
        // Smooth Ken Burns zoom in 1.0x -> 1.25x
        scale = 1.0 + 0.25 * progress;
        break;

      case 'zoom_out':
        // Smooth Ken Burns zoom out 1.25x -> 1.0x
        scale = 1.25 - 0.25 * progress;
        break;

      case 'line_zoom':
        // Rhythmic / punchy dynamic zoom pulse
        scale = 1.0 + 0.18 * Math.sin(progress * Math.PI * 4);
        break;

      case 'pan_left_right':
        // Slow cinematic horizontal tracking
        scale = 1.15; // Zoom slightly so canvas edges are covered
        dx = (progress - 0.5) * 0.14 * targetW;
        break;

      case 'pan_right_left':
        scale = 1.15;
        dx = (0.5 - progress) * 0.14 * targetW;
        break;

      case 'shake':
        // Subtle handheld organic camera drift
        scale = 1.08;
        dx = Math.sin(progress * 28) * 8;
        dy = Math.cos(progress * 34) * 6;
        break;
    }

    ctx.scale(scale, scale);
    ctx.translate(dx, dy);
    ctx.translate(-targetW / 2, -targetH / 2);
  }

  /**
   * Draws Transitions (Fade In, Fade Out, Flash White)
   */
  applyTransitions(ctx, targetW, targetH, transitionType, currentTime, totalDuration, transDur = 1.0) {
    if (!transitionType || transitionType === 'none') return;

    // 1. Head transitions (Fade in / Flash white)
    if (currentTime < transDur) {
      const alpha = Math.max(0, 1 - (currentTime / transDur));
      if (transitionType === 'fade_in' || transitionType === 'fade_in_out') {
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fillRect(0, 0, targetW, targetH);
      } else if (transitionType === 'flash_white') {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, targetW, targetH);
      }
    }

    // 2. Tail transitions (Fade out)
    const timeRemaining = totalDuration - currentTime;
    if (timeRemaining < transDur && (transitionType === 'fade_out' || transitionType === 'fade_in_out')) {
      const alpha = Math.max(0, 1 - (timeRemaining / transDur));
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, targetW, targetH);
    }
  }

  /**
   * Draws procedural 35mm film grain texture
   */
  drawFilmGrain(ctx, width, height) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.14;
    // Tile pattern with random shift for natural animated motion
    const offsetX = Math.floor(Math.random() * 256);
    const offsetY = Math.floor(Math.random() * 256);
    const pattern = ctx.createPattern(this.noiseTile, 'repeat');
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = pattern;
    ctx.fillRect(-offsetX, -offsetY, width + 256, height + 256);
    ctx.restore();
  }

  /**
   * Draws subtle dark vignette for vintage & olden days presets
   */
  drawVignette(ctx, width, height) {
    ctx.save();
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.max(width, height) * 0.72
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /**
   * Core frame rendering method supporting all Omni Studio features
   */
  drawFrame(ctx, video, targetW, targetH, options = {}) {
    const {
      fitMode = 'blur',
      filterPreset = 'none',
      customFilters = {},
      motionType = 'none',
      progress = 0,
      transitionType = 'none',
      currentTime = 0,
      totalDuration = 0,
      transDuration = 1.0,
      rotation = 0,
      flipH = false,
      flipV = false,
      maskCanvas = null,
      blurStrength = 18
    } = options;

    const srcW = video.videoWidth || 1920;
    const srcH = video.videoHeight || 1080;

    // Reset base matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Apply motion transform (zoom, pan, shake)
    this.applyMotionTransform(ctx, targetW, targetH, motionType, progress);

    // Rotation & Flip handling
    if (rotation !== 0 || flipH || flipV) {
      ctx.translate(targetW / 2, targetH / 2);
      if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
      if (flipH || flipV) ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.translate(-targetW / 2, -targetH / 2);
    }

    // Set active filter
    const filterStr = this.buildFilterString(filterPreset, customFilters);
    ctx.filter = filterStr;

    // 1. Orientation Framing
    if (fitMode === 'blur') {
      // Blurred Background
      ctx.save();
      const coverScale = Math.max(targetW / srcW, targetH / srcH) * 1.08;
      const bgW = srcW * coverScale;
      const bgH = srcH * coverScale;
      const bgX = (targetW - bgW) / 2;
      const bgY = (targetW - bgH) / 2;

      ctx.filter = (filterStr !== 'none' ? `${filterStr} ` : '') + 'blur(28px) brightness(0.6)';
      ctx.drawImage(video, bgX, bgY, bgW, bgH);
      ctx.restore();

      // Crisp Foreground
      ctx.filter = filterStr;
      const containScale = Math.min(targetW / srcW, targetH / srcH);
      const fgW = srcW * containScale;
      const fgH = srcH * containScale;
      const fgX = (targetW - fgW) / 2;
      const fgY = (targetH - fgH) / 2;
      ctx.drawImage(video, fgX, fgY, fgW, fgH);

    } else if (fitMode === 'crop') {
      // Smart Center Crop
      const scale = Math.max(targetW / srcW, targetH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      const x = (targetW - w) / 2;
      const y = (targetH - h) / 2;
      ctx.drawImage(video, x, y, w, h);

    } else {
      // Clean Letterbox
      ctx.save();
      ctx.filter = 'none';
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.restore();

      ctx.filter = filterStr;
      const scale = Math.min(targetW / srcW, targetH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      const x = (targetW - w) / 2;
      const y = (targetH - h) / 2;
      ctx.drawImage(video, x, y, w, h);
    }

    // 2. Extra aesthetic overlays
    if (filterPreset === 'fine_grain') {
      this.drawFilmGrain(ctx, targetW, targetH);
    } else if (filterPreset === 'olden_days' || filterPreset === 'noir') {
      this.drawVignette(ctx, targetW, targetH);
      if (filterPreset === 'olden_days') this.drawFilmGrain(ctx, targetW, targetH);
    }

    // 3. Interactive Frosted Glass Blur Mask (Selective Logo / Face Blurring)
    if (maskCanvas && maskCanvas.width > 0 && maskCanvas.height > 0) {
      this.applyBlurMask(
        ctx,
        video,
        targetW,
        targetH,
        maskCanvas,
        blurStrength,
        fitMode,
        filterStr,
        options.frostedSheen !== undefined ? options.frostedSheen : 0.05
      );
    }

    // 4. Transitions (Fade In/Out, Flash)
    ctx.filter = 'none';
    this.applyTransitions(ctx, targetW, targetH, transitionType, currentTime, totalDuration, transDuration);

    // 5. Imperceptible Keyed Watermark Embedding (if configured)
    if (options.watermark && options.watermark.enabled) {
      if (typeof window !== 'undefined' && window.WatermarkEngine) {
        try {
          window.WatermarkEngine.embedFrame(ctx, targetW, targetH, options.watermark, currentTime);
        } catch (wmErr) {
          console.warn('Watermark embed notice:', wmErr);
        }
      }
    }

    // Restore context if motion or transforms were applied
    if (motionType !== 'none') {
      ctx.restore();
    }
  }

  /**
   * Composites authentic frosted glass blur over painted mask region (optical refraction, zero white paint)
   */
  applyBlurMask(ctx, video, targetW, targetH, maskCanvas, blurRadius = 18, fitMode = 'blur', filterStr = 'none', frostedSheen = 0.05) {
    if (this.blurBufferCanvas.width !== targetW || this.blurBufferCanvas.height !== targetH) {
      this.blurBufferCanvas.width = targetW;
      this.blurBufferCanvas.height = targetH;
    }

    const bCtx = this.blurBufferCtx;
    bCtx.setTransform(1, 0, 0, 1, 0, 0);
    bCtx.clearRect(0, 0, targetW, targetH);

    // 1. Draw blurred copy of the video frame with glassmorphism vibrancy & brightness
    const glassFilter = `blur(${blurRadius}px) brightness(1.06) contrast(1.04) saturate(1.08)` + (filterStr !== 'none' ? ` ${filterStr}` : '');
    bCtx.filter = glassFilter;
    const srcW = video.videoWidth || 1920;
    const srcH = video.videoHeight || 1080;

    if (fitMode === 'crop') {
      const scale = Math.max(targetW / srcW, targetH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      bCtx.drawImage(video, (targetW - w) / 2, (targetH - h) / 2, w, h);
    } else {
      const scale = Math.min(targetW / srcW, targetH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      bCtx.drawImage(video, (targetW - w) / 2, (targetH - h) / 2, w, h);
    }

    // 2. Add subtle frosted glass specular sheen (delicate translucent highlight, NOT solid white)
    if (frostedSheen > 0) {
      bCtx.filter = 'none';
      bCtx.fillStyle = `rgba(255, 255, 255, ${frostedSheen})`;
      bCtx.fillRect(0, 0, targetW, targetH);
    }

    // 3. Clip blurred copy using the user's painted alpha mask
    bCtx.filter = 'none';
    bCtx.globalCompositeOperation = 'destination-in';
    bCtx.drawImage(maskCanvas, 0, 0, targetW, targetH);
    bCtx.globalCompositeOperation = 'source-over';

    // 4. Composite frosted glass blur seamlessly onto main video canvas
    ctx.save();
    ctx.filter = 'none';
    ctx.drawImage(this.blurBufferCanvas, 0, 0);
    ctx.restore();
  }

  /**
   * Render real-time preview frame to preview canvas
   */
  renderPreview(video, canvas, options = {}) {
    if (!video || !canvas || video.readyState < 2) return;
    const orientation = options.orientation || 'original';
    const resolution = options.resolution || '720p';
    const { width, height } = this.getTargetDimensions(orientation, resolution, video.videoWidth, video.videoHeight);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const curTime = video.currentTime || 0;
    const totalDur = video.duration || 1;
    const progress = totalDur > 0 ? (curTime / totalDur) : 0;

    this.drawFrame(ctx, video, width, height, {
      ...options,
      currentTime: curTime,
      totalDuration: totalDur,
      progress
    });
  }

  /**
   * Calculate exact segment slices for cutter mode
   */
  calculateSegments(totalDuration, durationSetting = 10, mode = 'duration', partsSetting = 6, remainderPolicy = 'keep') {
    if (mode === 'parts') {
      const parts = Math.max(1, parseInt(partsSetting, 10) || 1);
      const segLen = totalDuration / parts;
      const segments = [];
      for (let i = 0; i < parts; i++) {
        const start = i * segLen;
        const end = Math.min(totalDuration, (i + 1) * segLen);
        segments.push({
          index: i + 1,
          start: parseFloat(start.toFixed(3)),
          end: parseFloat(end.toFixed(3)),
          duration: parseFloat((end - start).toFixed(3))
        });
      }
      return segments;
    }

    const segDur = Math.max(0.5, parseFloat(durationSetting) || 10);
    const count = Math.ceil(totalDuration / segDur);
    const segments = [];

    for (let i = 0; i < count; i++) {
      const start = i * segDur;
      const end = Math.min(totalDuration, (i + 1) * segDur);
      const duration = end - start;

      // Handle remainder on last segment
      if (i === count - 1 && duration < segDur && segments.length > 0) {
        if (remainderPolicy === 'merge') {
          const prev = segments.pop();
          segments.push({
            index: prev.index,
            start: prev.start,
            end: totalDuration,
            duration: parseFloat((totalDuration - prev.start).toFixed(3))
          });
          break;
        } else if (remainderPolicy === 'discard') {
          break;
        }
      }

      if (duration > 0.05) {
        segments.push({
          index: segments.length + 1,
          start: parseFloat(start.toFixed(3)),
          end: parseFloat(end.toFixed(3)),
          duration: parseFloat(duration.toFixed(3))
        });
      }
    }

    return segments;
  }

  /**
   * Find best supported MediaRecorder mimeType
   */
  getBestMimeType() {
    const candidates = [
      { mime: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
      { mime: 'video/mp4;codecs=avc1', ext: 'mp4' },
      { mime: 'video/mp4', ext: 'mp4' },
      { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
      { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
      { mime: 'video/webm', ext: 'webm' }
    ];

    if (typeof MediaRecorder === 'undefined') {
      return { mime: 'video/webm', ext: 'webm' };
    }

    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mime)) {
        return c;
      }
    }
    return { mime: 'video/webm', ext: 'webm' };
  }

  /**
   * Process and Export a single video or segment with all active Omni effects
   */
  async processSegment(video, segment, config, onProgress) {
    const { orientation, resolution = '1080p', playbackSpeed = 1.0, volumeMultiplier = 1.0 } = config;
    const { width, height } = this.getTargetDimensions(orientation, resolution, video.videoWidth, video.videoHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: !!(config.watermark && config.watermark.enabled) });

    const fps = config.fps || 30;
    const canvasStream = canvas.captureStream(fps);
    const audioTracks = (config.hasAudio !== false && this.audioDestNode)
      ? this.audioDestNode.stream.getAudioTracks()
      : [];
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks
    ]);

    const { mime, ext } = this.getBestMimeType();
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: resolution === '1080p' ? 6000000 : 3500000
    });

    const recordedChunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    return new Promise(async (resolve, reject) => {
      let isAborted = false;
      let animId = null;

      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          isAborted = true;
          if (animId) cancelAnimationFrame(animId);
          try { video.pause(); } catch(e){}
          try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e){}
          reject(new Error('Process cancelled by user.'));
        });
      }

      const seekToStart = () => {
        return new Promise((res) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            res();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = segment.start;
        });
      };

      try {
        video.pause();
        await seekToStart();
        if (isAborted) return;

        this.setVolume(volumeMultiplier);

        const segTotalSec = Math.max(0.01, segment.duration);
        const curProgress = 0;

        // 1. Draw initial frame synchronously to eliminate initial black frame
        this.drawFrame(ctx, video, width, height, {
          ...config,
          currentTime: 0,
          totalDuration: segTotalSec,
          progress: curProgress
        });

        // Push initial frame to captureStream pipeline
        const videoTracks = canvasStream.getVideoTracks();
        if (videoTracks.length > 0 && typeof videoTracks[0].requestFrame === 'function') {
          try { videoTracks[0].requestFrame(); } catch (_) {}
        }

        // Brief delay for encoder pipeline sync
        await new Promise(r => setTimeout(r, 40));
        if (isAborted) return;

        recorder.start(100);
        video.playbackRate = playbackSpeed;

        recorder.onstop = () => {
          video.pause();
          video.playbackRate = 1.0;
          if (animId) cancelAnimationFrame(animId);

          const blob = new Blob(recordedChunks, { type: mime });
          const url = URL.createObjectURL(blob);
          resolve({
            segment,
            blob,
            url,
            extension: ext,
            mimeType: mime,
            sizeBytes: blob.size,
            width,
            height
          });
        };

        const renderLoop = () => {
          if (isAborted) return;

          if (video.currentTime >= segment.end || video.ended) {
            // Render final clamped frame
            this.drawFrame(ctx, video, width, height, {
              ...config,
              currentTime: segTotalSec,
              totalDuration: segTotalSec,
              progress: 1.0
            });
            if (recorder.state !== 'inactive') {
              try { recorder.requestData(); } catch (_) {}
              recorder.stop();
            }
            return;
          }

          const elapsedInSeg = Math.max(0, video.currentTime - segment.start);
          const segProgress = Math.min(1.0, elapsedInSeg / segTotalSec);

          this.drawFrame(ctx, video, width, height, {
            ...config,
            currentTime: elapsedInSeg,
            totalDuration: segTotalSec,
            progress: segProgress
          });

          if (onProgress) {
            onProgress(segProgress);
          }

          animId = requestAnimationFrame(renderLoop);
        };

        await video.play();
        animId = requestAnimationFrame(renderLoop);

      } catch (err) {
        if (animId) cancelAnimationFrame(animId);
        try { video.pause(); } catch(e){}
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e){}
        reject(err);
      }
    });
  }

  /**
   * Batch process all segments
   */
  async processAllSegments(video, segments, config, onOverallProgress) {
    this.abortController = new AbortController();
    if (config.hasAudio !== false) {
      this.initAudio(video, config.volumeMultiplier || 1.0);
    }

    const results = [];
    const total = segments.length;

    for (let i = 0; i < total; i++) {
      if (this.abortController.signal.aborted) {
        throw new Error('Processing cancelled by user.');
      }

      const segment = segments[i];
      const segmentResult = await this.processSegment(
        video,
        segment,
        config,
        (segProgress) => {
          const overall = (i + segProgress) / total;
          if (onOverallProgress) {
            onOverallProgress({
              currentIndex: i + 1,
              totalSegments: total,
              segmentProgress: segProgress,
              overallProgress: overall
            });
          }
        }
      );

      results.push(segmentResult);

      if (onOverallProgress) {
        onOverallProgress({
          currentIndex: i + 1,
          totalSegments: total,
          segmentProgress: 1.0,
          overallProgress: (i + 1) / total
        });
      }
    }

    return results;
  }

  /**
   * Unified Non-Destructive Export Pipeline
   * Consumes an EditGraph (or config object) and coordinates multi-clip or single-clip rendering.
   */
  async exportPipeline(editGraphOrConfig, video, maskCanvas = null, onOverallProgress = null) {
    let config;
    let segments;

    if (editGraphOrConfig && typeof editGraphOrConfig.toPipelineConfig === 'function') {
      const validation = editGraphOrConfig.validate ? editGraphOrConfig.validate() : { valid: true };
      if (!validation.valid) {
        throw new Error(`Invalid EditGraph: ${validation.errors.join(', ')}`);
      }
      config = editGraphOrConfig.toPipelineConfig(maskCanvas);
      segments = editGraphOrConfig.getSegments();
    } else {
      config = { ...editGraphOrConfig, maskCanvas };
      segments = editGraphOrConfig.segments || [{
        index: 1,
        start: 0,
        end: video.duration || 1,
        duration: video.duration || 1
      }];
    }

    return await this.processAllSegments(video, segments, config, onOverallProgress);
  }

  /**
   * Cancel ongoing export
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Generates a 60-second test video in-browser
   */
  async generateSampleVideo(durationSeconds = 60) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const actx = new AudioContextClass();
    const dest = actx.createMediaStreamDestination();

    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, actx.currentTime);
    gain.gain.setValueAtTime(0.04, actx.currentTime);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    const stream = new MediaStream([
      ...canvas.captureStream(30).getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    const { mime, ext } = this.getBestMimeType();
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    return new Promise((resolve) => {
      recorder.start();
      const startTime = performance.now();
      let frame = 0;

      const timer = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        frame++;

        const hue = (frame * 1.5) % 360;
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        grad.addColorStop(0, `hsl(${hue}, 70%, 20%)`);
        grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 75%, 15%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(200, 120, 880, 480);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.strokeRect(200, 120, 880, 480);

        const ballX = 640 + Math.sin(frame * 0.05) * 350;
        const ballY = 360 + Math.cos(frame * 0.08) * 150;
        ctx.beginPath();
        ctx.arc(ballX, ballY, 32, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎬 VidCut Omni Studio Demo', 640, 240);

        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        const remaining = Math.max(0, durationSeconds - elapsed).toFixed(1);
        ctx.fillText(`Duration: ${durationSeconds}s | Elapsed: ${elapsed.toFixed(1)}s (Remain: ${remaining}s)`, 640, 310);

        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Test filters, motion zoom, blur brush, and automatic 10s slicing!', 640, 420);

        if (elapsed >= durationSeconds) {
          clearInterval(timer);
          osc.stop();
          recorder.stop();
        }
      }, 33);

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        resolve({ blob, ext, mime });
      };
    });
  }

  /**
   * Computes exact integer tile partition for any width/height and row/col grid.
   * Remainder pixels are distributed deterministically so sum(widths) === width and sum(heights) === height.
   */
  calculateSpatialGrid(width, height, rows = 3, cols = 3) {
    const r = Math.max(1, parseInt(rows, 10) || 3);
    const c = Math.max(1, parseInt(cols, 10) || 3);

    const baseW = Math.floor(width / c);
    const remW = width % c;
    const baseH = Math.floor(height / r);
    const remH = height % r;

    const colWidths = [];
    for (let j = 0; j < c; j++) colWidths.push(baseW + (j < remW ? 1 : 0));
    const rowHeights = [];
    for (let i = 0; i < r; i++) rowHeights.push(baseH + (i < remH ? 1 : 0));

    const colXs = [];
    let currX = 0;
    for (let j = 0; j < c; j++) {
      colXs.push(currX);
      currX += colWidths[j];
    }

    const rowYs = [];
    let currY = 0;
    for (let i = 0; i < r; i++) {
      rowYs.push(currY);
      currY += rowHeights[i];
    }

    const tiles = [];
    let idx = 1;
    for (let i = 0; i < r; i++) {
      for (let j = 0; j < c; j++) {
        tiles.push({
          index: idx++,
          row: i + 1,
          col: j + 1,
          x: colXs[j],
          y: rowYs[i],
          width: colWidths[j],
          height: rowHeights[i]
        });
      }
    }
    return tiles;
  }

  /**
   * Process a single spatial tile as an independent video clip
   */
  async processSpatialTile(video, tile, config = {}, onProgress = null) {
    // Round to even dimensions for video encoder compliance
    const targetW = tile.width % 2 === 0 ? tile.width : tile.width - 1;
    const targetH = tile.height % 2 === 0 ? tile.height : tile.height - 1;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const fps = 30;
    const canvasStream = canvas.captureStream(fps);
    const audioTracks = (config.hasAudio !== false && this.audioDestNode)
      ? this.audioDestNode.stream.getAudioTracks()
      : [];
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks
    ]);

    const { mime, ext } = this.getBestMimeType();
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    return new Promise(async (resolve, reject) => {
      let isAborted = false;
      let animId = null;

      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          isAborted = true;
          if (animId) cancelAnimationFrame(animId);
          try { video.pause(); } catch(e){}
          try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e){}
          reject(new Error('Process cancelled by user.'));
        });
      }

      try {
        video.pause();
        await new Promise((res) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            res();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = 0;
        });

        const totalDur = Math.max(0.1, video.duration || 1);

        // Pre-render initial frame
        ctx.drawImage(video, tile.x, tile.y, tile.width, tile.height, 0, 0, targetW, targetH);
        await new Promise(r => setTimeout(r, 40));
        if (isAborted) return;

        recorder.start(100);

        recorder.onstop = () => {
          video.pause();
          if (animId) cancelAnimationFrame(animId);
          const blob = new Blob(chunks, { type: mime });
          const url = URL.createObjectURL(blob);
          resolve({
            tile,
            blob,
            url,
            extension: ext,
            mimeType: mime,
            sizeBytes: blob.size,
            width: targetW,
            height: targetH
          });
        };

        const renderLoop = () => {
          if (isAborted) return;

          if (video.currentTime >= totalDur || video.ended) {
            ctx.drawImage(video, tile.x, tile.y, tile.width, tile.height, 0, 0, targetW, targetH);
            if (recorder.state !== 'inactive') {
              try { recorder.requestData(); } catch (_) {}
              recorder.stop();
            }
            return;
          }

          ctx.drawImage(video, tile.x, tile.y, tile.width, tile.height, 0, 0, targetW, targetH);
          const prog = Math.min(1.0, video.currentTime / totalDur);
          if (onProgress) onProgress(prog);

          animId = requestAnimationFrame(renderLoop);
        };

        await video.play();
        animId = requestAnimationFrame(renderLoop);

      } catch (err) {
        if (animId) cancelAnimationFrame(animId);
        try { video.pause(); } catch(e){}
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e){}
        reject(err);
      }
    });
  }

  /**
   * Process all spatial grid tiles into separate video clips
   */
  async processSpatialGrid(video, rows = 3, cols = 3, config = {}, onOverallProgress = null) {
    this.abortController = new AbortController();
    const tiles = this.calculateSpatialGrid(video.videoWidth, video.videoHeight, rows, cols);
    const results = [];
    const total = tiles.length;

    for (let i = 0; i < total; i++) {
      if (this.abortController.signal.aborted) {
        throw new Error('Processing cancelled by user.');
      }

      const tile = tiles[i];
      const res = await this.processSpatialTile(video, tile, config, (prog) => {
        if (onOverallProgress) {
          const overall = (i + prog) / total;
          onOverallProgress({
            currentTile: i + 1,
            totalTiles: total,
            tileProgress: prog,
            overallProgress: overall
          });
        }
      });

      results.push(res);
      if (onOverallProgress) {
        onOverallProgress({
          currentTile: i + 1,
          totalTiles: total,
          tileProgress: 1.0,
          overallProgress: (i + 1) / total
        });
      }
    }

    return results;
  }

  /**
   * Multi-Clip Video Joiner / Concatenator
   * Sequentially plays and records multiple video sources into a single merged video file.
   */
  async rejoinVideos(sources, config = {}, onProgress = null) {
    if (!sources || sources.length === 0) throw new Error('No video sources provided to rejoin.');

    this.abortController = new AbortController();
    const targetW = config.width || 1280;
    const targetH = config.height || 720;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    const { mime, ext } = this.getBestMimeType();
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    return new Promise(async (resolve, reject) => {
      let isAborted = false;
      this.abortController.signal.addEventListener('abort', () => {
        isAborted = true;
        try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e){}
        reject(new Error('Rejoin process cancelled by user.'));
      });

      recorder.start(100);

      const totalVideos = sources.length;

      for (let i = 0; i < totalVideos; i++) {
        if (isAborted) return;
        const src = sources[i];

        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        let blobUrl = null;

        if (typeof src === 'string') {
          v.src = src;
        } else if (src instanceof Blob) {
          blobUrl = URL.createObjectURL(src);
          v.src = blobUrl;
        }

        await new Promise((res, rej) => {
          v.onloadedmetadata = res;
          v.onerror = rej;
          v.load();
        });

        const vDur = Math.max(0.1, v.duration || 1);

        await new Promise(async (clipDone) => {
          let animId = null;

          const renderFrame = () => {
            if (isAborted || v.currentTime >= vDur || v.ended) {
              if (animId) cancelAnimationFrame(animId);
              v.pause();
              clipDone();
              return;
            }

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetW, targetH);
            const scale = Math.min(targetW / v.videoWidth, targetH / v.videoHeight);
            const dw = v.videoWidth * scale;
            const dh = v.videoHeight * scale;
            const dx = (targetW - dw) / 2;
            const dy = (targetH - dh) / 2;
            ctx.drawImage(v, dx, dy, dw, dh);

            if (onProgress) {
              const clipProg = Math.min(1.0, v.currentTime / vDur);
              const overall = (i + clipProg) / totalVideos;
              onProgress({
                currentClip: i + 1,
                totalClips: totalVideos,
                clipProgress: clipProg,
                overallProgress: overall
              });
            }

            animId = requestAnimationFrame(renderFrame);
          };

          await v.play();
          animId = requestAnimationFrame(renderFrame);
        });

        if (blobUrl) URL.revokeObjectURL(blobUrl);
      }

      recorder.onstop = () => {
        const mergedBlob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(mergedBlob);
        resolve({
          blob: mergedBlob,
          url,
          extension: ext,
          mimeType: mime,
          sizeBytes: mergedBlob.size,
          width: targetW,
          height: targetH
        });
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    });
  }
}

window.VideoEngine = VideoEngine;
