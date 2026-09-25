/**
 * VidCut Studio - Video Processing & Orientation Engine
 * 100% Client-Side Video Slicing, Orientation Conversion, and Audio Sync
 */

class VideoEngine {
  constructor() {
    this.audioCtx = null;
    this.audioSourceNode = null;
    this.audioDestNode = null;
    this.isAudioConnected = false;
    this.abortController = null;
  }

  /**
   * Initialize or resume Web Audio context for synchronized audio extraction
   */
  initAudio(videoElement) {
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
        this.audioDestNode = this.audioCtx.createMediaStreamDestination();
        // Also connect to audioCtx.destination so audio is audible if desired, or keep muted for fast capture
        this.audioSourceNode.connect(this.audioDestNode);
        this.isAudioConnected = true;
      } catch (err) {
        console.warn('Audio node connection warning (may already be connected):', err);
      }
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
   * Renders a video frame to canvas with chosen framing style (blur, crop, fit)
   */
  drawFrame(ctx, video, targetW, targetH, fitMode = 'blur') {
    const srcW = video.videoWidth || 1920;
    const srcH = video.videoHeight || 1080;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (fitMode === 'blur') {
      // 1. Draw blurred & darkened background covering full canvas
      ctx.save();
      const coverScale = Math.max(targetW / srcW, targetH / srcH) * 1.08;
      const bgW = srcW * coverScale;
      const bgH = srcH * coverScale;
      const bgX = (targetW - bgW) / 2;
      const bgY = (targetH - bgH) / 2;

      ctx.filter = 'blur(28px) brightness(0.6)';
      ctx.drawImage(video, bgX, bgY, bgW, bgH);
      ctx.restore();

      // 2. Draw crisp contained foreground video centered
      const containScale = Math.min(targetW / srcW, targetH / srcH);
      const fgW = srcW * containScale;
      const fgH = srcH * containScale;
      const fgX = (targetW - fgW) / 2;
      const fgY = (targetH - fgH) / 2;

      ctx.drawImage(video, fgX, fgY, fgW, fgH);

    } else if (fitMode === 'crop') {
      // Smart Center Crop: scale to fill canvas completely
      const scale = Math.max(targetW / srcW, targetH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      const x = (targetW - w) / 2;
      const y = (targetH - h) / 2;

      ctx.drawImage(video, x, y, w, h);

    } else {
      // Letterbox / Pillarbox: fill black margins and center
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, targetW, targetH);

      const scale = Math.min(targetW / srcW, targetH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      const x = (targetW - w) / 2;
      const y = (targetH - h) / 2;

      ctx.drawImage(video, x, y, w, h);
    }
  }

  /**
   * Render real-time preview frame to preview canvas
   */
  renderPreview(video, canvas, orientation, fitMode, resolution = '720p') {
    if (!video || !canvas || video.readyState < 2) return;
    const { width, height } = this.getTargetDimensions(orientation, resolution, video.videoWidth, video.videoHeight);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    this.drawFrame(ctx, video, width, height, fitMode);
  }

  /**
   * Calculate exact segment slices
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
   * Slices a single segment from the video with orientation transformation & audio
   */
  async processSegment(video, segment, config, onProgress) {
    const { orientation, fitMode, resolution, playbackSpeed = 1.0 } = config;
    const { width, height } = this.getTargetDimensions(orientation, resolution, video.videoWidth, video.videoHeight);

    // Setup offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Setup streams
    const fps = 30;
    const canvasStream = canvas.captureStream(fps);
    const audioTracks = this.audioDestNode ? this.audioDestNode.stream.getAudioTracks() : [];
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
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    return new Promise(async (resolve, reject) => {
      let isAborted = false;
      let animId = null;

      // Check abort signal
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          isAborted = true;
          if (animId) cancelAnimationFrame(animId);
          try { video.pause(); } catch(e){}
          try { if (recorder.state !== 'inactive') recorder.stop(); } catch(e){}
          reject(new Error('Process cancelled by user.'));
        });
      }

      // Seek video to segment start
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

        // Draw initial frame
        this.drawFrame(ctx, video, width, height, fitMode);

        recorder.start(100); // 100ms chunk intervals
        video.playbackRate = playbackSpeed;

        const startTime = Date.now();
        const segTotalSec = segment.duration;

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

          // Check if video reached segment end or video ended
          if (video.currentTime >= segment.end || video.ended) {
            recorder.stop();
            return;
          }

          this.drawFrame(ctx, video, width, height, fitMode);

          // Report progress within current segment
          const elapsedInSeg = Math.max(0, video.currentTime - segment.start);
          const segProgress = Math.min(1.0, elapsedInSeg / segTotalSec);
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
    this.initAudio(video);

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
   * Cancel ongoing batch operation
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Generates a 60-second test video in-browser if user wants to test immediately
   */
  async generateSampleVideo(durationSeconds = 60) {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const actx = new AudioContextClass();
    const dest = actx.createMediaStreamDestination();

    // Create periodic beep sound
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, actx.currentTime);
    gain.gain.setValueAtTime(0.05, actx.currentTime);
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

        // Draw animated test pattern
        const hue = (frame * 1.5) % 360;
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        grad.addColorStop(0, `hsl(${hue}, 70%, 20%)`);
        grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 75%, 15%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        // Center card
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(200, 120, 880, 480);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.strokeRect(200, 120, 880, 480);

        // Moving ball
        const ballX = 640 + Math.sin(frame * 0.05) * 350;
        const ballY = 360 + Math.cos(frame * 0.08) * 150;
        ctx.beginPath();
        ctx.arc(ballX, ballY, 32, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎬 VidCut Sample Video', 640, 240);

        ctx.font = '32px sans-serif';
        ctx.fillStyle = '#a5b4fc';
        const remaining = Math.max(0, durationSeconds - elapsed).toFixed(1);
        ctx.fillText(`Duration: ${durationSeconds}s | Current: ${elapsed.toFixed(1)}s (Remain: ${remaining}s)`, 640, 310);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Ideal for testing: Split by 10s -> 6 equal clips!', 640, 420);

        // Beep frequency modulation
        if (Math.floor(elapsed) !== Math.floor(elapsed - 0.05)) {
          gain.gain.setValueAtTime(0.12, actx.currentTime);
          osc.frequency.setValueAtTime(587.33, actx.currentTime); // D5
        } else {
          gain.gain.setValueAtTime(0.01, actx.currentTime);
          osc.frequency.setValueAtTime(440, actx.currentTime);
        }

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
}

window.VideoEngine = VideoEngine;
