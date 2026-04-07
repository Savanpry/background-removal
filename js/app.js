// app.js — AI Image Tools (Background Remover - Final Studio Edition)
// Using @imgly/background-removal for superior edge detection

import { removeBackground, preload } from 'https://esm.sh/@imgly/background-removal@1.7.0';

// Preload the "isnet" model (Highest quality) in the background
preload({ model: 'isnet' }).catch(err => console.debug('[BGEraser] Preload skipped or failed:', err));

// Check for file:// protocol which breaks ESM/WASM
if (window.location.protocol === 'file:') {
  alert('IMPORTANT: This AI tool requires a local web server to run (e.g., VS Code "Live Server"). It cannot be run by double-clicking the HTML file.');
}

// ==============================
// DOM — Background Remover
// ==============================
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const resultArea = document.getElementById('resultArea');
const originalImg = document.getElementById('originalImg');
const resultCanvas = document.getElementById('resultCanvas');
const processingOverlay = document.getElementById('processingOverlay');
const processingText = document.getElementById('processingText');
const progressBar = document.getElementById('progressBar');
const actionRow = document.getElementById('actionRow');
const downloadBtn = document.getElementById('downloadBtn');
const tryAnotherBtn = document.getElementById('tryAnotherBtn');
const copyBtn = document.getElementById('copyBtn');
const errorBox = document.getElementById('errorBox');
const errorMsg = document.getElementById('errorMsg');
const toast = document.getElementById('toast');

let blobResult = null;

// ==============================
// Toast & Error
// ==============================
function showToast(msg, duration = 3000) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'flex';
  processingOverlay.style.display = 'none';
}

function hideError() {
  errorBox.style.display = 'none';
}

// ══════════════════════════════════════════
//  TOOL: BACKGROUND REMOVER
// ══════════════════════════════════════════

// ---- File Input ----
fileInput.addEventListener('change', function () {
  if (this.files && this.files[0]) processFile(this.files[0]);
});

// ---- Drag & Drop ----
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});

// ---- Process File ----
async function processFile(file) {
  hideError();
  uploadZone.style.display = 'none';
  resultArea.style.display = 'block';
  actionRow.style.display = 'none';
  processingOverlay.style.display = 'flex';
  progressBar.style.width = '0%';
  processingText.textContent = 'Initialising AI…';

  const imageUrl = URL.createObjectURL(file);
  originalImg.src = imageUrl;

  try {
    blobResult = await removeBackground(file, {
      debug: false,
      model: 'isnet',
      output: { format: 'image/png', quality: 1.0 },
      progress: (key, current, total) => {
        const p = current / total;
        const percent = Math.round(p * 100);
        progressBar.style.width = `${percent}%`;
        if (key.includes('fetch')) {
          processingText.textContent = `Downloading Pixel-Perfect AI... ${percent}%`;
        } else {
          processingText.textContent = `Deep Analysis (${percent}%)... Almost there!`;
        }
      }
    });

    const resultUrl = URL.createObjectURL(blobResult);
    const img = new Image();
    img.src = resultUrl;
    await new Promise(res => img.onload = res);

    // Restore HD Scale
    resultCanvas.width = img.width;
    resultCanvas.height = img.height;

    const ctx = resultCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    ctx.drawImage(img, 0, 0);

    // Final Version Studio-Grade Refinement
    ultraPreciseCutout(ctx, img.width, img.height);

    resultCanvas.toBlob(blob => {
      blobResult = blob;
      progressBar.style.width = '100%';
      processingText.textContent = 'Done! ✓';
      setTimeout(() => {
        processingOverlay.style.display = 'none';
        actionRow.style.display = 'flex';
        showToast('✅ Properly cut & clean result!');
      }, 600);
    }, 'image/png');

  } catch (err) {
    console.error('[BGEraser] Processing error:', err);
    showError('AI was unable to process this image. Try another one.');
  }
}

/**
 * ultraPreciseCutout — Studio-Grade Background Mask Processing
 * 1. Anti-aliased Alpha Matting: Uses an ultra-low threshold to clear micro-noise,
 *    linearly scaling the rest to flawlessly preserve microscopic hair strands.
 * 2. Dynamic Color Decontamination: Identifies core subject colors and 
 *    adaptivity bleeds them into fringes to destroy white halos while maintaining
 *    original skin tones and edge texture!
 */
function ultraPreciseCutout(ctx, width, height) {
  const GHOST_MAX = 5; // kills noise ≤ 2%, saving all hair detail

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const src = new Uint8ClampedArray(data);

  // --- Phase 1: Non-Destructive Alpha Matting ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = src[i + 3];

      if (a <= GHOST_MAX) {
        data[i + 3] = 0;
      } else if (a < 255) {
        data[i + 3] = Math.round(((a - GHOST_MAX) / (255 - GHOST_MAX)) * 255);
      }
    }
  }

  // --- Phase 2: Micro-Level Edge Refinement & Color Decontamination ---
  const srcPostAlpha = new Uint8ClampedArray(data);
  const SEARCH_RADIUS = 6;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];

      if (a > 0 && a < 250) {
        let bestDist = Infinity;
        let cR = data[i], cG = data[i + 1], cB = data[i + 2];
        let foundSolid = false;

        const minY = Math.max(0, y - SEARCH_RADIUS), maxY = Math.min(height - 1, y + SEARCH_RADIUS);
        const minX = Math.max(0, x - SEARCH_RADIUS), maxX = Math.min(width - 1, x + SEARCH_RADIUS);

        for (let sy = minY; sy <= maxY; sy++) {
          const dy = sy - y;
          const dy2 = dy * dy;
          if (dy2 >= bestDist) continue;

          for (let sx = minX; sx <= maxX; sx++) {
            const idx = (sy * width + sx) * 4;
            if (srcPostAlpha[idx + 3] >= 253) {
              const dx = sx - x;
              const dist = dx * dx + dy2;
              if (dist < bestDist) {
                bestDist = dist;
                cR = srcPostAlpha[idx];
                cG = srcPostAlpha[idx + 1];
                cB = srcPostAlpha[idx + 2];
                foundSolid = true;
              }
            }
          }
        }

        if (foundSolid) {
          let decontamStrength = 1.0;
          if (a > 150) {
            decontamStrength = Math.max(0, (240 - a) / 90.0);
          }

          if (decontamStrength > 0) {
            const origStrength = 1.0 - decontamStrength;
            data[i] = Math.round(cR * decontamStrength + data[i] * origStrength);
            data[i + 1] = Math.round(cG * decontamStrength + data[i + 1] * origStrength);
            data[i + 2] = Math.round(cB * decontamStrength + data[i + 2] * origStrength);
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ---- Action Handlers ----
downloadBtn.onclick = () => {
  if (!blobResult) return;
  const link = document.createElement('a');
  link.download = `bg-remover-${Date.now()}.png`;
  link.href = URL.createObjectURL(blobResult);
  link.click();
};

copyBtn.onclick = async () => {
  try {
    if (!blobResult) return;
    const item = new ClipboardItem({ 'image/png': blobResult });
    await navigator.clipboard.write([item]);
    showToast('📋 Copied to clipboard!');
  } catch (e) {
    console.error('Copy failed:', e);
    showToast('⚠️ Copy failed.');
  }
};

tryAnotherBtn.onclick = () => {
  resultArea.style.display = 'none';
  uploadZone.style.display = 'flex';
  fileInput.value = '';
  originalImg.src = '';
  blobResult = null;
  hideError();
};
