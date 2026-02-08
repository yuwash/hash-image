// Initialize the library if needed (hash-wasm usually auto-initializes or exposes global)
// The UMD build exposes createCRC32 or similar depending on version, 
// usually we access the global object. Based on standard UMD usage for this lib:
let crc32Instance;

async function initHasher() {
  if (window.hashwasm && window.hashwasm.createCRC32) {
    crc32Instance = await window.hashwasm.createCRC32();
  } else {
    console.error('hash-wasm not loaded or createCRC32 not available');
  }
}

let gridContainer;
let largeBitmapCanvas;
let ctx;
let downloadBtn;
let resultInfo;
let inputField;

function initGlobals() {
  gridContainer = document.getElementById('grid-container');
  largeBitmapCanvas = document.getElementById('preview-bitmap');
  ctx = largeBitmapCanvas.getContext('2d');
  downloadBtn = document.getElementById('download-btn');
  resultInfo = document.getElementById('result-info');
  inputField = document.getElementById('hash-input');
}

const SCALE_UP = 10;
const canvasSize = 3 * SCALE_UP;

function initCanvas() {
  largeBitmapCanvas.width = canvasSize;
  largeBitmapCanvas.height = canvasSize;
}

function createBitmap(index, cssClass, showIndex) {
  // Container for label + bitmap
  const wrapper = document.createElement('div');
  wrapper.className = 'bitmap-wrapper';

  if (showIndex) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'index-label';
    labelDiv.textContent = index;
    wrapper.appendChild(labelDiv);
  }

  const bitmapDiv = document.createElement('div');
  bitmapDiv.className = cssClass;

  const val = index;

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const pixelDiv = document.createElement('div');
      pixelDiv.className = 'pixel';

      if (x === 2 && y === 2) {
        pixelDiv.classList.add('black');
      } else {
        const posIndex = x + (3 * y);
        const bit = (val >> posIndex) & 1;
        pixelDiv.classList.add(bit === 1 ? 'black' : 'white');
      }

      bitmapDiv.appendChild(pixelDiv);
    }
  }

  wrapper.appendChild(bitmapDiv);
  return wrapper;
}

function drawCanvasBitmap(index) {
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    const val = index;

    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            let isBlack = false;
            if (x === 2 && y === 2) {
                isBlack = true;
            } else {
                const posIndex = x + (3 * y);
                const bit = (val >> posIndex) & 1;
                if (bit === 1) {
                    isBlack = true;
                }
            }

            ctx.fillStyle = isBlack ? 'black' : 'white';
            ctx.fillRect(x * SCALE_UP, y * SCALE_UP, SCALE_UP, SCALE_UP);
        }
    }
}

// 1. Generate the grid of 256 images
function drawBitmapGrid(index) {
  for (let i = 0; i <= 255; i++) {
      const bitmap = createBitmap(i, 'bitmap', true);
      gridContainer.appendChild(bitmap);
  }
}

// 2. Handle Input Logic
inputField.addEventListener('input', async (e) => {
    const text = e.target.value;
    resultInfo.textContent = '';
    if (!text) {
      resultInfo.innerHTML = '';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      return;
    }

    if (crc32Instance) {
      crc32Instance.init();
      const uint8Array = new TextEncoder().encode(text);
      crc32Instance.update(uint8Array);
      const hash = crc32Instance.digest('hex');

      const first8Hex = hash.substring(0, 8);
      const index = (parseInt(first8Hex, 16) % 256);

      const lastTwo = hash.slice(-2);
      const imageNumber = parseInt(lastTwo, 16);

      const base = hash.slice(0, -2);
      const last = hash.slice(-2);

      resultInfo.innerHTML =
        `Hash (CRC-32): ${base}<span class="last-two">${last}</span>` +
        ` (Image ${imageNumber})`;

      drawCanvasBitmap(index);
    }
});

downloadBtn.addEventListener('click', () => {
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const png = UPNG.encode([imageData.data.buffer], canvasSize, canvasSize, 0);
    const blob = new Blob([png], {type: 'image/png'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hash-image.png';
    a.click();
    URL.revokeObjectURL(url);
});

document.addEventListener('DOMContentLoaded', () => {
  initGlobals();
  initCanvas();
  initHasher();
  drawBitmapGrid();

  // Initialize empty state
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvasSize, canvasSize);
});