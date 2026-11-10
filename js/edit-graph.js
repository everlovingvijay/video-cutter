/**
 * VidCut Omni - Non-Destructive Edit Graph & Project State (Schema v1.0)
 *
 * Encapsulates the entire non-destructive edit state:
 * source metadata, timeline ranges, geometric transforms, color filters,
 * frosted glass blur masks, motion effects, transitions, audio controls,
 * watermark settings, and export presets.
 */

class EditGraph {
  constructor(initialData = {}) {
    this.version = "1.0";
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;

    this.source = {
      name: initialData.source?.name || "",
      duration: initialData.source?.duration || 0,
      width: initialData.source?.width || 1920,
      height: initialData.source?.height || 1080,
      fps: initialData.source?.fps || 30,
      sizeBytes: initialData.source?.sizeBytes || 0,
      hasAudio: initialData.source?.hasAudio !== false
    };

    this.timeline = {
      inPoint: initialData.timeline?.inPoint || 0,
      outPoint: initialData.timeline?.outPoint || (this.source.duration || 0),
      speed: initialData.timeline?.speed || 1.0,
      splitMode: initialData.timeline?.splitMode || 'duration', // 'duration' or 'parts'
      splitDuration: initialData.timeline?.splitDuration || 10,
      splitParts: initialData.timeline?.splitParts || 6,
      remainderPolicy: initialData.timeline?.remainderPolicy || 'keep', // 'keep', 'merge', 'discard'
      spatialGrid: {
        enabled: initialData.timeline?.spatialGrid?.enabled || false,
        rows: initialData.timeline?.spatialGrid?.rows || 3,
        cols: initialData.timeline?.spatialGrid?.cols || 3
      }
    };

    this.effects = {
      orientation: initialData.effects?.orientation || 'original', // 'original', '9:16', '1:1', '16:9', '4:5'
      fitMode: initialData.effects?.fitMode || 'blur', // 'blur', 'crop', 'fit'
      rotation: initialData.effects?.rotation || 0, // 0, 90, 180, 270
      flipH: !!initialData.effects?.flipH,
      flipV: !!initialData.effects?.flipV,
      cropRect: initialData.effects?.cropRect || null, // { x, y, width, height } in normalized [0,1] or pixels
      filterPreset: initialData.effects?.filterPreset || 'none',
      customFilters: {
        brightness: initialData.effects?.customFilters?.brightness ?? 100,
        contrast: initialData.effects?.customFilters?.contrast ?? 100,
        saturation: initialData.effects?.customFilters?.saturation ?? 100,
        sepia: initialData.effects?.customFilters?.sepia ?? 0,
        hueRotate: initialData.effects?.customFilters?.hueRotate ?? 0
      },
      motion: {
        type: initialData.effects?.motion?.type || 'none', // 'none', 'zoom_in', 'zoom_out', 'line_zoom', 'pan_left_right', 'shake'
        intensity: initialData.effects?.motion?.intensity ?? 1.0
      },
      transition: {
        type: initialData.effects?.transition?.type || 'none', // 'none', 'fade_in', 'fade_out', 'fade_in_out', 'flash_white'
        duration: initialData.effects?.transition?.duration || 1.0
      },
      blurMask: {
        enabled: !!initialData.effects?.blurMask?.enabled,
        blurRadius: initialData.effects?.blurMask?.blurRadius || 20,
        frostedSheen: initialData.effects?.blurMask?.frostedSheen ?? 0.05,
        maskDataUrl: initialData.effects?.blurMask?.maskDataUrl || null
      },
      watermark: initialData.effects?.watermark ? { ...initialData.effects.watermark } : null
    };

    this.audio = {
      volume: initialData.audio?.volume ?? 1.0,
      muted: !!initialData.audio?.muted
    };

    this.exportSettings = {
      resolution: initialData.exportSettings?.resolution || '1080p',
      fps: initialData.exportSettings?.fps || 30,
      bitrate: initialData.exportSettings?.bitrate || 5000000,
      format: initialData.exportSettings?.format || 'auto' // 'auto', 'mp4', 'webm'
    };
  }

  /**
   * Set source video parameters
   */
  setSource(metadata) {
    this.source = { ...this.source, ...metadata };
    if (!this.timeline.outPoint || this.timeline.outPoint === 0) {
      this.timeline.outPoint = this.source.duration;
    }
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Calculates active segments for current timeline configuration
   */
  getSegments() {
    const totalDuration = (this.timeline.outPoint - this.timeline.inPoint) || this.source.duration || 1;
    const startOffset = this.timeline.inPoint;

    if (this.timeline.splitMode === 'parts') {
      const parts = Math.max(1, parseInt(this.timeline.splitParts, 10) || 1);
      const segLen = totalDuration / parts;
      const segments = [];
      for (let i = 0; i < parts; i++) {
        const segStart = startOffset + i * segLen;
        const segEnd = Math.min(startOffset + totalDuration, startOffset + (i + 1) * segLen);
        segments.push({
          index: i + 1,
          start: parseFloat(segStart.toFixed(3)),
          end: parseFloat(segEnd.toFixed(3)),
          duration: parseFloat((segEnd - segStart).toFixed(3))
        });
      }
      return segments;
    }

    const segDur = Math.max(0.5, parseFloat(this.timeline.splitDuration) || 10);
    const count = Math.ceil(totalDuration / segDur);
    const segments = [];

    for (let i = 0; i < count; i++) {
      const segStart = startOffset + i * segDur;
      const segEnd = Math.min(startOffset + totalDuration, startOffset + (i + 1) * segDur);
      const duration = segEnd - segStart;

      // Handle remainder on last segment
      if (i === count - 1 && duration < segDur && segments.length > 0) {
        if (this.timeline.remainderPolicy === 'merge') {
          const prev = segments.pop();
          segments.push({
            index: prev.index,
            start: prev.start,
            end: parseFloat(segEnd.toFixed(3)),
            duration: parseFloat((segEnd - prev.start).toFixed(3))
          });
          break;
        } else if (this.timeline.remainderPolicy === 'discard') {
          break;
        }
      }

      if (duration > 0.05) {
        segments.push({
          index: segments.length + 1,
          start: parseFloat(segStart.toFixed(3)),
          end: parseFloat(segEnd.toFixed(3)),
          duration: parseFloat(duration.toFixed(3))
        });
      }
    }

    return segments;
  }

  /**
   * Produce flattened pipeline configuration for VideoEngine
   */
  toPipelineConfig(maskCanvas = null) {
    return {
      orientation: this.effects.orientation || 'original',
      fitMode: this.effects.fitMode || 'blur',
      resolution: this.exportSettings.resolution || '1080p',
      playbackSpeed: this.timeline.speed || 1.0,
      volumeMultiplier: this.audio.muted ? 0.0 : (this.audio.volume ?? 1.0),
      filterPreset: this.effects.filterPreset || 'none',
      customFilters: { ...this.effects.customFilters },
      motionType: this.effects.motion.type || 'none',
      transitionType: this.effects.transition.type || 'none',
      transDuration: this.effects.transition.duration || 1.0,
      rotation: this.effects.rotation || 0,
      flipH: !!this.effects.flipH,
      flipV: !!this.effects.flipV,
      cropRect: this.effects.cropRect || null,
      maskCanvas: maskCanvas,
      blurStrength: this.effects.blurMask.blurRadius || 20,
      frostedSheen: this.effects.blurMask.frostedSheen ?? 0.05,
      watermark: this.effects.watermark ? { ...this.effects.watermark } : null,
      hasAudio: this.source.hasAudio !== false && !this.audio.muted
    };
  }

  /**
   * Validate EditGraph state consistency
   */
  validate() {
    const errors = [];
    if (this.timeline.inPoint < 0) errors.push('inPoint must be >= 0');
    if (this.timeline.outPoint < this.timeline.inPoint) errors.push('outPoint must be >= inPoint');
    if (this.timeline.speed <= 0) errors.push('speed must be > 0');
    if (this.timeline.splitDuration <= 0) errors.push('splitDuration must be > 0');
    if (this.timeline.splitParts < 1) errors.push('splitParts must be >= 1');
    return { valid: errors.length === 0, errors };
  }

  /**
   * Clone this EditGraph instance
   */
  clone() {
    return EditGraph.fromJSON(this.toJSON());
  }

  /**
   * Serialize edit graph to formatted JSON string
   */
  toJSON() {
    this.updatedAt = new Date().toISOString();
    return JSON.stringify({
      schema: "vidcut-omni-editgraph-v1",
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      source: this.source,
      timeline: this.timeline,
      effects: this.effects,
      audio: this.audio,
      exportSettings: this.exportSettings
    }, null, 2);
  }

  /**
   * Parse JSON string and create validated EditGraph instance
   */
  static fromJSON(jsonStr) {
    try {
      const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      return new EditGraph(parsed);
    } catch (err) {
      throw new Error("Invalid project JSON: " + err.message);
    }
  }
}

if (typeof window !== 'undefined') {
  window.EditGraph = EditGraph;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EditGraph;
}
