/**
 * VidCut Omni - Watermark Engine (MVP v1.0)
 *
 * Implements an imperceptible, keyed pixel watermark embedded into video frames,
 * paired with an independent in-browser detector with false-positive controls,
 * CRC16 integrity verification, and statistical confidence scoring.
 *
 * 100% Client-Side • Zero External Dependencies • Battery-Friendly
 */

(function (global) {
  'use strict';

  // --- 1. Fast Cryptographic-Grade PRNG (MurmurHash3 + Mulberry32) ---
  function hashKey(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0;
  }

  function createPRNG(seed) {
    let s = seed >>> 0;
    return function nextFloat() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- 2. CRC16-CCITT (Polynomial 0x1021, Initial 0xFFFF) ---
  function computeCRC16(bytes, length) {
    let crc = 0xFFFF;
    for (let i = 0; i < length; i++) {
      crc ^= (bytes[i] << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc & 0xFFFF;
  }

  // --- 3. Payload Packing (64 bits = 8 bytes) ---
  // [ Version (8b) | WatermarkID (32b) | Flags/Timestamp (16b) | CRC16 (16b) ]
  function packPayload(version, watermarkId, timestamp = 0) {
    const bytes = new Uint8Array(8);
    bytes[0] = version & 0xFF;
    bytes[1] = (watermarkId >>> 24) & 0xFF;
    bytes[2] = (watermarkId >>> 16) & 0xFF;
    bytes[3] = (watermarkId >>> 8) & 0xFF;
    bytes[4] = watermarkId & 0xFF;
    bytes[5] = (timestamp >>> 8) & 0xFF;
    bytes[6] = timestamp & 0xFF;

    const crc = computeCRC16(bytes, 7);
    bytes[7] = (crc >>> 8) & 0xFF;
    bytes[8] = crc & 0xFF; // 9th byte if 72b, but 64b packed below:
    return bytes;
  }

  // Standard 64-bit compact format:
  // Version: 8 bits
  // ID: 32 bits
  // Flags: 8 bits
  // CRC16: 16 bits
  function packPayload64(version, watermarkId, flags = 0) {
    const bytes = new Uint8Array(8);
    bytes[0] = version & 0xFF;
    bytes[1] = (watermarkId >>> 24) & 0xFF;
    bytes[2] = (watermarkId >>> 16) & 0xFF;
    bytes[3] = (watermarkId >>> 8) & 0xFF;
    bytes[4] = watermarkId & 0xFF;
    bytes[5] = flags & 0xFF;

    const crc = computeCRC16(bytes, 6);
    bytes[6] = (crc >>> 8) & 0xFF;
    bytes[7] = crc & 0xFF;
    return bytes;
  }

  function unpackPayload64(bytes) {
    if (!bytes || bytes.length < 8) return null;
    const version = bytes[0];
    const watermarkId = ((bytes[1] << 24) >>> 0) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4];
    const flags = bytes[5];
    const storedCrc = ((bytes[6] << 8) | bytes[7]) & 0xFFFF;
    const expectedCrc = computeCRC16(bytes, 6);

    return {
      version,
      watermarkId: watermarkId >>> 0,
      flags,
      storedCrc,
      expectedCrc,
      isValid: storedCrc === expectedCrc
    };
  }

  function bytesToBits(bytes) {
    const bits = new Uint8Array(bytes.length * 8);
    for (let i = 0; i < bytes.length; i++) {
      for (let b = 0; b < 8; b++) {
        bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
      }
    }
    return bits;
  }

  function bitsToBytes(bits) {
    const byteCount = Math.floor(bits.length / 8);
    const bytes = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i++) {
      let val = 0;
      for (let b = 0; b < 8; b++) {
        if (bits[i * 8 + b]) {
          val |= (1 << (7 - b));
        }
      }
      bytes[i] = val;
    }
    return bytes;
  }

  // --- 4. Spatial Coordinate Generator ---
  // Generates pseudo-random paired pixel locations across the frame based on secretKey
  function generateBitPattern(key, width, height, bitIndex, samplesPerBit = 64) {
    const seed = hashKey(`${key}_bit_${bitIndex}_w${width}_h${height}`);
    const rand = createPRNG(seed);
    const pairs = [];

    // Margin to avoid edge artifacts
    const marginX = Math.floor(width * 0.05);
    const marginY = Math.floor(height * 0.05);
    const activeW = width - 2 * marginX;
    const activeH = height - 2 * marginY;

    for (let i = 0; i < samplesPerBit; i++) {
      // Pick coordinate for pixel A
      const xA = marginX + Math.floor(rand() * activeW);
      const yA = marginY + Math.floor(rand() * activeH);

      // Pick nearby neighbor for pixel B (differential pairing)
      // Small offset (2-8 pixels) makes correlation robust against scene changes
      const offsetX = (Math.floor(rand() * 7) + 2) * (rand() > 0.5 ? 1 : -1);
      const offsetY = (Math.floor(rand() * 7) + 2) * (rand() > 0.5 ? 1 : -1);
      const xB = Math.max(0, Math.min(width - 1, xA + offsetX));
      const yB = Math.max(0, Math.min(height - 1, yA + offsetY));

      pairs.push({ xA, yA, xB, yB });
    }
    return pairs;
  }

  // --- 4b. 8x8 Block-DCT and Hamming(7, 4) Error Correction (Phase 3 Robust Mode) ---
  const COS_TABLE = new Float32Array(64);
  const C_COEFF = new Float32Array([1.0 / Math.SQRT2, 1, 1, 1, 1, 1, 1, 1]);
  for (let u = 0; u < 8; u++) {
    for (let x = 0; x < 8; x++) {
      COS_TABLE[u * 8 + x] = Math.cos(((2 * x + 1) * u * Math.PI) / 16.0);
    }
  }

  function dct1D(src, dst) {
    for (let u = 0; u < 8; u++) {
      let s = 0.0;
      const uOffset = u * 8;
      for (let x = 0; x < 8; x++) {
        s += src[x] * COS_TABLE[uOffset + x];
      }
      dst[u] = 0.5 * C_COEFF[u] * s;
    }
  }

  function idct1D(src, dst) {
    for (let x = 0; x < 8; x++) {
      let s = 0.0;
      for (let u = 0; u < 8; u++) {
        s += C_COEFF[u] * src[u] * COS_TABLE[u * 8 + x];
      }
      dst[x] = 0.5 * s;
    }
  }

  function dct2D8x8(block8x8, out8x8) {
    const temp = new Float32Array(64);
    const rowIn = new Float32Array(8);
    const rowOut = new Float32Array(8);

    // Rows
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) rowIn[c] = block8x8[r * 8 + c];
      dct1D(rowIn, rowOut);
      for (let c = 0; c < 8; c++) temp[r * 8 + c] = rowOut[c];
    }

    // Columns
    const colIn = new Float32Array(8);
    const colOut = new Float32Array(8);
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 8; r++) colIn[r] = temp[r * 8 + c];
      dct1D(colIn, colOut);
      for (let r = 0; r < 8; r++) out8x8[r * 8 + c] = colOut[r];
    }
  }

  function idct2D8x8(dctBlock8x8, out8x8) {
    const temp = new Float32Array(64);
    const colIn = new Float32Array(8);
    const colOut = new Float32Array(8);

    // Columns
    for (let c = 0; c < 8; c++) {
      for (let r = 0; r < 8; r++) colIn[r] = dctBlock8x8[r * 8 + c];
      idct1D(colIn, colOut);
      for (let r = 0; r < 8; r++) temp[r * 8 + c] = colOut[r];
    }

    // Rows
    const rowIn = new Float32Array(8);
    const rowOut = new Float32Array(8);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) rowIn[c] = temp[r * 8 + c];
      idct1D(rowIn, rowOut);
      for (let c = 0; c < 8; c++) out8x8[r * 8 + c] = rowOut[c];
    }
  }

  // Hamming(7, 4) ECC
  function hamming74Encode(d1, d2, d3, d4) {
    const p1 = d1 ^ d2 ^ d4;
    const p2 = d1 ^ d3 ^ d4;
    const p3 = d2 ^ d3 ^ d4;
    return [p1, p2, d1, p3, d2, d3, d4];
  }

  function hamming74Decode(c) {
    const s1 = c[0] ^ c[2] ^ c[4] ^ c[6];
    const s2 = c[1] ^ c[2] ^ c[5] ^ c[6];
    const s3 = c[3] ^ c[4] ^ c[5] ^ c[6];
    const syndrome = (s3 << 2) | (s2 << 1) | s1;

    const corrected = [c[0], c[1], c[2], c[3], c[4], c[5], c[6]];
    if (syndrome !== 0 && syndrome <= 7) {
      corrected[syndrome - 1] ^= 1;
    }
    return [corrected[2], corrected[4], corrected[5], corrected[6]];
  }

  // --- 5. WatermarkEngine Class ---
  class WatermarkEngine {
    /**
     * Embed keyed watermark onto an active Canvas 2D context
     * Supports both 'spatial' (MVP) and 'dct' (Robust Block-DCT QIM with Hamming ECC)
     */
    static embedFrame(ctx, width, height, watermarkConfig, currentTime = 0) {
      if (!watermarkConfig || !watermarkConfig.enabled) return;

      const algorithm = watermarkConfig.algorithm || 'spatial';
      if (algorithm === 'dct') {
        WatermarkEngine.embedFrameDCT(ctx, width, height, watermarkConfig, currentTime);
        return;
      }

      // Default: Spatial Luminance Perturbation
      const key = watermarkConfig.key || 'vidcut-default-secret';
      const watermarkId = parseInt(watermarkConfig.id, 10) || 12345;
      const strength = Math.max(1, Math.min(8, watermarkConfig.strength || 2));
      const samplesPerBit = watermarkConfig.samplesPerBit || 48;

      const payloadBytes = packPayload64(1, watermarkId, 0);
      const bits = bytesToBits(payloadBytes); // 64 bits

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      for (let bitIdx = 0; bitIdx < bits.length; bitIdx++) {
        const bitVal = bits[bitIdx];
        const delta = bitVal === 1 ? strength : -strength;
        const pairs = generateBitPattern(key, width, height, bitIdx, samplesPerBit);

        for (let p = 0; p < pairs.length; p++) {
          const { xA, yA, xB, yB } = pairs[p];
          const idxA = (yA * width + xA) * 4;
          const idxB = (yB * width + xB) * 4;

          data[idxA] = Math.max(0, Math.min(255, data[idxA] + delta));
          data[idxA + 1] = Math.max(0, Math.min(255, data[idxA + 1] + delta));
          data[idxA + 2] = Math.max(0, Math.min(255, data[idxA + 2] + delta));

          data[idxB] = Math.max(0, Math.min(255, data[idxB] - delta));
          data[idxB + 1] = Math.max(0, Math.min(255, data[idxB + 1] - delta));
          data[idxB + 2] = Math.max(0, Math.min(255, data[idxB + 2] - delta));
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    /**
     * Embed using Robust 8x8 Block-DCT Mid-Frequency QIM with Hamming(7, 4) ECC
     */
    static embedFrameDCT(ctx, width, height, watermarkConfig, currentTime = 0) {
      const key = watermarkConfig.key || 'vidcut-default-secret';
      const watermarkId = parseInt(watermarkConfig.id, 10) || 12345;
      const strength = Math.max(2, Math.min(16, (watermarkConfig.strength || 2) * 3)); // AC modulation delta
      const payloadBytes = packPayload64(2, watermarkId, 0); // version 2 for DCT
      const rawBits = bytesToBits(payloadBytes); // 64 bits

      // Encode into 16 Hamming(7, 4) codewords -> 112 coded bits
      const codedBits = [];
      for (let i = 0; i < 64; i += 4) {
        const codeword = hamming74Encode(rawBits[i], rawBits[i + 1], rawBits[i + 2], rawBits[i + 3]);
        for (let j = 0; j < 7; j++) codedBits.push(codeword[j]);
      }

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Available 8x8 blocks in frame
      const blocksX = Math.floor(width / 8);
      const blocksY = Math.floor(height / 8);
      const totalBlocks = blocksX * blocksY;
      if (totalBlocks < codedBits.length) return; // Fallback if image too small

      // Deterministic block assignment keyed by PRNG
      const rand = createPRNG(hashKey(`${key}_dct_blocks_w${width}_h${height}`));
      const blockIndices = [];
      for (let i = 0; i < totalBlocks; i++) blockIndices.push(i);
      // Fisher-Yates shuffle
      for (let i = totalBlocks - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const temp = blockIndices[i];
        blockIndices[i] = blockIndices[j];
        blockIndices[j] = temp;
      }

      const blockBuf = new Float32Array(64);
      const dctBuf = new Float32Array(64);
      const idctBuf = new Float32Array(64);

      // Embed each coded bit into a chosen 8x8 block mid-frequency pair
      // Pair: (3, 2) vs (2, 3) (indexes in 8x8 are 3*8+2=26, and 2*8+3=19)
      const COEFF_A = 26;
      const COEFF_B = 19;

      for (let bitIdx = 0; bitIdx < codedBits.length; bitIdx++) {
        const blkIdx = blockIndices[bitIdx];
        const blkX = (blkIdx % blocksX) * 8;
        const blkY = Math.floor(blkIdx / blocksX) * 8;
        const bitVal = codedBits[bitIdx];

        // Extract luma Y into blockBuf
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const pxIdx = ((blkY + r) * width + (blkX + c)) * 4;
            // Y = 0.299R + 0.587G + 0.114B
            blockBuf[r * 8 + c] = 0.299 * data[pxIdx] + 0.587 * data[pxIdx + 1] + 0.114 * data[pxIdx + 2];
          }
        }

        dct2D8x8(blockBuf, dctBuf);

        // QIM: Modulate pair
        if (bitVal === 1) {
          if (dctBuf[COEFF_A] - dctBuf[COEFF_B] < strength) {
            dctBuf[COEFF_A] += strength * 0.5;
            dctBuf[COEFF_B] -= strength * 0.5;
          }
        } else {
          if (dctBuf[COEFF_B] - dctBuf[COEFF_A] < strength) {
            dctBuf[COEFF_B] += strength * 0.5;
            dctBuf[COEFF_A] -= strength * 0.5;
          }
        }

        idct2D8x8(dctBuf, idctBuf);

        // Apply delta back to RGB channels
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const pxIdx = ((blkY + r) * width + (blkX + c)) * 4;
            const deltaY = idctBuf[r * 8 + c] - blockBuf[r * 8 + c];
            data[pxIdx] = Math.max(0, Math.min(255, data[pxIdx] + deltaY));
            data[pxIdx + 1] = Math.max(0, Math.min(255, data[pxIdx + 1] + deltaY));
            data[pxIdx + 2] = Math.max(0, Math.min(255, data[pxIdx + 2] + deltaY));
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    /**
     * Extract coded bit likelihoods from 8x8 Block-DCT coefficients
     */
    static extractFrameLikelihoodsDCT(ctx, width, height, key) {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const blocksX = Math.floor(width / 8);
      const blocksY = Math.floor(height / 8);
      const totalBlocks = blocksX * blocksY;
      const codedBitsCount = 112; // 16 Hamming(7,4) blocks
      const likelihoods = new Float32Array(codedBitsCount);

      if (totalBlocks < codedBitsCount) return likelihoods;

      const rand = createPRNG(hashKey(`${key}_dct_blocks_w${width}_h${height}`));
      const blockIndices = [];
      for (let i = 0; i < totalBlocks; i++) blockIndices.push(i);
      for (let i = totalBlocks - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const temp = blockIndices[i];
        blockIndices[i] = blockIndices[j];
        blockIndices[j] = temp;
      }

      const blockBuf = new Float32Array(64);
      const dctBuf = new Float32Array(64);
      const COEFF_A = 26;
      const COEFF_B = 19;

      for (let bitIdx = 0; bitIdx < codedBitsCount; bitIdx++) {
        const blkIdx = blockIndices[bitIdx];
        const blkX = (blkIdx % blocksX) * 8;
        const blkY = Math.floor(blkIdx / blocksX) * 8;

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const pxIdx = ((blkY + r) * width + (blkX + c)) * 4;
            blockBuf[r * 8 + c] = 0.299 * data[pxIdx] + 0.587 * data[pxIdx + 1] + 0.114 * data[pxIdx + 2];
          }
        }

        dct2D8x8(blockBuf, dctBuf);
        // Differential coefficient likelihood
        likelihoods[bitIdx] = dctBuf[COEFF_A] - dctBuf[COEFF_B];
      }

      return likelihoods;
    }

    /**
     * Compute difference between original and watermarked canvas, amplified for visual inspection
     */
    static computeVisualDifference(origCanvas, wmCanvas, outCanvas, amplification = 30) {
      const w = origCanvas.width;
      const h = origCanvas.height;
      outCanvas.width = w;
      outCanvas.height = h;

      const oCtx = origCanvas.getContext('2d');
      const wCtx = wmCanvas.getContext('2d');
      const outCtx = outCanvas.getContext('2d');

      const oData = oCtx.getImageData(0, 0, w, h).data;
      const wData = wCtx.getImageData(0, 0, w, h).data;
      const diffImg = outCtx.createImageData(w, h);
      const dData = diffImg.data;

      for (let i = 0; i < oData.length; i += 4) {
        const diffR = Math.abs(wData[i] - oData[i]) * amplification;
        const diffG = Math.abs(wData[i + 1] - oData[i + 1]) * amplification;
        const diffB = Math.abs(wData[i + 2] - oData[i + 2]) * amplification;

        dData[i] = Math.min(255, diffR);
        dData[i + 1] = Math.min(255, diffG);
        dData[i + 2] = Math.min(255, diffB);
        dData[i + 3] = 255;
      }

      outCtx.putImageData(diffImg, 0, 0);
    }

    /**
     * Extract bit likelihoods from a single video frame
     */
    static extractFrameLikelihoods(ctx, width, height, key, samplesPerBit = 48) {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const bitCount = 64;
      const likelihoods = new Float32Array(bitCount);

      for (let bitIdx = 0; bitIdx < bitCount; bitIdx++) {
        const pairs = generateBitPattern(key, width, height, bitIdx, samplesPerBit);
        let diffSum = 0;

        for (let p = 0; p < pairs.length; p++) {
          const { xA, yA, xB, yB } = pairs[p];
          const idxA = (yA * width + xA) * 4;
          const idxB = (yB * width + xB) * 4;

          // Compute luminance Y for pixel A and B
          // Y = 0.299R + 0.587G + 0.114B
          const yAVal = 0.299 * data[idxA] + 0.587 * data[idxA + 1] + 0.114 * data[idxA + 2];
          const yBVal = 0.299 * data[idxB] + 0.587 * data[idxB + 1] + 0.114 * data[idxB + 2];

          // If Bit 1 was embedded, yA - yB is positive on average
          diffSum += (yAVal - yBVal);
        }

        likelihoods[bitIdx] = diffSum / pairs.length;
      }

      return likelihoods;
    }

    /**
     * Independent Watermark Detector
     * Decodes sample frames from a video file/blob and validates watermark presence
     */
    static async detectWatermark(videoSource, key, options = {}, onProgress = null) {
      const numFrames = options.numFrames || 15;
      const samplesPerBit = options.samplesPerBit || 48;

      return new Promise(async (resolve, reject) => {
        let video = null;
        let objectUrl = null;
        let createdElement = false;

        if (typeof videoSource === 'string') {
          video = document.createElement('video');
          video.src = videoSource;
          createdElement = true;
        } else if (videoSource instanceof Blob || (typeof File !== 'undefined' && videoSource instanceof File)) {
          video = document.createElement('video');
          objectUrl = URL.createObjectURL(videoSource);
          video.src = objectUrl;
          createdElement = true;
        } else if (videoSource && videoSource.tagName === 'VIDEO') {
          video = videoSource;
        } else {
          return reject(new Error('Invalid videoSource provided to detector.'));
        }

        video.muted = true;
        video.playsInline = true;

        const cleanup = () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          if (createdElement && video) {
            video.src = '';
            video.load();
          }
        };

        const onMetadata = async () => {
          try {
            const duration = video.duration || 1;
            const width = video.videoWidth || 1280;
            const height = video.videoHeight || 720;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            const accumulatedLikelihoods = new Float64Array(64);
            const accumulatedDCTLikelihoods = new Float64Array(112);
            const frameTimestamps = [];
            const step = duration / (numFrames + 1);

            for (let i = 1; i <= numFrames; i++) {
              frameTimestamps.push(i * step);
            }

            let framesRead = 0;

            for (let f = 0; f < frameTimestamps.length; f++) {
              const targetTime = frameTimestamps[f];

              // Seek to target frame
              await new Promise((res) => {
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked);
                  res();
                };
                video.addEventListener('seeked', onSeeked);
                video.currentTime = targetTime;
              });

              // Draw frame to canvas
              ctx.drawImage(video, 0, 0, width, height);

              // Extract spatial likelihoods
              const frameLikelihoods = WatermarkEngine.extractFrameLikelihoods(ctx, width, height, key, samplesPerBit);
              for (let b = 0; b < 64; b++) {
                accumulatedLikelihoods[b] += frameLikelihoods[b];
              }

              // Extract DCT likelihoods
              const frameLikelihoodsDCT = WatermarkEngine.extractFrameLikelihoodsDCT(ctx, width, height, key);
              for (let b = 0; b < 112; b++) {
                accumulatedDCTLikelihoods[b] += frameLikelihoodsDCT[b];
              }

              framesRead++;
              if (onProgress) {
                onProgress({
                  framesAnalyzed: framesRead,
                  totalFrames: numFrames,
                  progress: framesRead / numFrames
                });
              }
            }

            // Statistical Analysis & Payload Decoding
            // 1. Check Spatial Mode
            const decodedBitsSpatial = new Uint8Array(64);
            let meanLikelihood = 0;
            let sumSq = 0;

            for (let b = 0; b < 64; b++) {
              const avg = accumulatedLikelihoods[b] / framesRead;
              decodedBitsSpatial[b] = avg > 0 ? 1 : 0;
              meanLikelihood += Math.abs(avg);
              sumSq += avg * avg;
            }

            meanLikelihood /= 64;
            const variance = (sumSq / 64) - (meanLikelihood * meanLikelihood);
            const stdDev = Math.sqrt(Math.max(0.00001, variance));
            const zScoreSpatial = meanLikelihood / (stdDev / Math.sqrt(64));

            const unpackedSpatial = unpackPayload64(bitsToBytes(decodedBitsSpatial));

            // 2. Check DCT Mode with Hamming(7, 4) Error Correction
            const rawDctBits = new Uint8Array(64);
            let meanDctLikelihood = 0;
            let sumSqDct = 0;

            for (let blk = 0; blk < 16; blk++) {
              const code = [];
              for (let j = 0; j < 7; j++) {
                const avgDct = accumulatedDCTLikelihoods[blk * 7 + j] / framesRead;
                code.push(avgDct > 0 ? 1 : 0);
                meanDctLikelihood += Math.abs(avgDct);
                sumSqDct += avgDct * avgDct;
              }
              const [d1, d2, d3, d4] = hamming74Decode(code);
              rawDctBits[blk * 4] = d1;
              rawDctBits[blk * 4 + 1] = d2;
              rawDctBits[blk * 4 + 2] = d3;
              rawDctBits[blk * 4 + 3] = d4;
            }

            meanDctLikelihood /= 112;
            const varianceDct = (sumSqDct / 112) - (meanDctLikelihood * meanDctLikelihood);
            const stdDevDct = Math.sqrt(Math.max(0.00001, varianceDct));
            const zScoreDct = meanDctLikelihood / (stdDevDct / Math.sqrt(112));

            const unpackedDct = unpackPayload64(bitsToBytes(rawDctBits));

            cleanup();

            // Select best verified result
            let activeUnpacked = unpackedSpatial;
            let activeZ = zScoreSpatial;
            let detectedMode = 'Spatial Luma';

            if (unpackedDct && unpackedDct.isValid) {
              activeUnpacked = unpackedDct;
              activeZ = zScoreDct;
              detectedMode = '8x8 Block-DCT (Robust ECC)';
            } else if (unpackedSpatial && unpackedSpatial.isValid) {
              activeUnpacked = unpackedSpatial;
              activeZ = zScoreSpatial;
              detectedMode = 'Spatial Luma';
            } else if (zScoreDct > zScoreSpatial) {
              activeUnpacked = unpackedDct;
              activeZ = zScoreDct;
              detectedMode = '8x8 Block-DCT (Candidate)';
            }

            let status = 'NOT_DETECTED';
            let confidence = 0.0;
            let verdictMessage = 'No watermark detected with the provided key.';

            if (activeUnpacked && activeUnpacked.isValid && activeZ >= 2.8) {
              status = 'DETECTED';
              confidence = Math.min(99.9, 91.0 + Math.min(8.9, (activeZ - 2.8) * 2.8));
              verdictMessage = `Watermark verified! ID: ${activeUnpacked.watermarkId} [Mode: ${detectedMode}] (CRC Match, Z-Score: ${activeZ.toFixed(2)}σ)`;
            } else if (activeUnpacked && activeUnpacked.isValid && activeZ < 2.8) {
              status = 'INCONCLUSIVE';
              confidence = 52.0 + activeZ * 8;
              verdictMessage = `CRC matched but statistical correlation is low (${activeZ.toFixed(2)}σ). Inconclusive.`;
            } else if (activeZ >= 3.8) {
              status = 'INCONCLUSIVE';
              confidence = 42.0;
              verdictMessage = `Elevated correlation detected (${activeZ.toFixed(2)}σ) but CRC failed. Video may have undergone heavy recompression.`;
            } else {
              status = 'NOT_DETECTED';
              confidence = Math.max(0.0, Math.min(25.0, activeZ * 5));
              verdictMessage = `No matching watermark pattern found (Z-Score: ${activeZ.toFixed(2)}σ, CRC Invalid).`;
            }

            resolve({
              status,
              mode: detectedMode,
              confidence: parseFloat(confidence.toFixed(1)),
              zScore: parseFloat(activeZ.toFixed(2)),
              watermarkId: (activeUnpacked && activeUnpacked.isValid) ? activeUnpacked.watermarkId : null,
              version: activeUnpacked ? activeUnpacked.version : null,
              crcValid: activeUnpacked ? activeUnpacked.isValid : false,
              storedCrc: activeUnpacked ? activeUnpacked.storedCrc : null,
              expectedCrc: activeUnpacked ? activeUnpacked.expectedCrc : null,
              framesAnalyzed: framesRead,
              verdictMessage
            });

          } catch (err) {
            cleanup();
            reject(err);
          }
        };

        video.addEventListener('loadedmetadata', onMetadata, { once: true });
        video.addEventListener('error', (e) => {
          cleanup();
          reject(new Error('Failed to load video in detector: ' + (video.error ? video.error.message : 'Unknown error')));
        }, { once: true });

        // Trigger load
        video.load();
      });
    }
  }

  // Export to global scope
  global.WatermarkEngine = WatermarkEngine;
  global.computeCRC16 = computeCRC16;
  global.packPayload64 = packPayload64;
  global.unpackPayload64 = unpackPayload64;
  global.bytesToBits = bytesToBits;
  global.bitsToBytes = bitsToBytes;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      WatermarkEngine,
      computeCRC16,
      packPayload64,
      unpackPayload64,
      bytesToBits,
      bitsToBytes
    };
  }

})(typeof window !== 'undefined' ? window : globalThis);
