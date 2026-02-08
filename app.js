// Initialize the library if needed (hash-wasm usually auto-initializes or exposes global)
// The UMD build exposes createCRC32 or similar depending on version, 
// usually we access the global object. Based on standard UMD usage for this lib:
let crc32Instance;

// Import functions from hashImage.js
import { getHashInfo, getPixelArray } from './hashImage.js';

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
let colorPickerBtn;
let invertBtn;
let controls;
let foregroundColor = 'black';
let currentMode = 'input'; // 'input' or 'grid'
let selectedImageIndex = null; // Track the selected image index
let isInverted = false; // Track whether inversion is enabled

function initGlobals() {
  gridContainer = document.getElementById('grid-container');
  largeBitmapCanvas = document.getElementById('preview-bitmap');
  ctx = largeBitmapCanvas.getContext('2d');
  downloadBtn = document.getElementById('download-btn');
  resultInfo = document.getElementById('result-info');
  inputField = document.getElementById('hash-input');
  colorPickerBtn = document.getElementById('color-picker-btn');
  invertBtn = document.getElementById('invert-btn');
  controls = document.getElementById('controls');
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

  const pixelArray = getPixelArray(index);

  pixelArray.forEach(row => {
    row.forEach(pixelValue => {
      const pixelDiv = document.createElement('div');
      pixelDiv.className = 'pixel';
      pixelDiv.classList.add(pixelValue === 1 ? 'black' : 'white');
      bitmapDiv.appendChild(pixelDiv);
    });
  });

  wrapper.appendChild(bitmapDiv);
  return wrapper;
}

function drawCanvasBitmap(index) {
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    const pixelArray = getPixelArray(index, isInverted);

    pixelArray.forEach((row, y) => {
      row.forEach((pixelValue, x) => {
        const isBlack = pixelValue === 1;
        ctx.fillStyle = isBlack ? foregroundColor : '#fff0';
        ctx.fillRect(x * SCALE_UP, y * SCALE_UP, SCALE_UP, SCALE_UP);
      });
    });
}

// Update title and h1 with current index
function updateTitleAndHeader(index) {
  document.title = `hash-image ${index}`;
  document.querySelector('h1').textContent = `hash-image ${index}`;
}

// 1. Generate the grid of 256 images
function drawBitmapGrid() {
  for (let i = 0; i <= 255; i++) {
      const wrapper = createBitmap(i, 'bitmap', true);
      wrapper.addEventListener('click', () => {
          currentMode = 'grid';
          selectedImageIndex = i; // Store the selected index
          drawCanvasBitmap(i);
          controls.classList.add('disabled');
          inputField.disabled = true;
          updateUrlWithIndex(i);
          updateTitleAndHeader(i);
      });
      gridContainer.appendChild(wrapper);
  }
}

// 2. Handle Input Logic
async function handleInput(e) {
    const text = e.target.value;
    resultInfo.textContent = '';
    if (!text) {
      return;
    }

    const hashInfo = getHashInfo(text, crc32Instance);
    if (hashInfo) {
      resultInfo.innerHTML =
        `Hash (CRC-32): ${hashInfo.base}<span class="last-two">${hashInfo.last}</span>`;

      selectedImageIndex = hashInfo.index; // Store the index from input
      drawCanvasBitmap(hashInfo.index);
      updateUrlWithIndex(hashInfo.index);
      updateTitleAndHeader(hashInfo.index);
    }
}

async function handleDownload() {
    const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const png = UPNG.encode([imageData.data.buffer], canvasSize, canvasSize, 0);
    const blob = new Blob([png], {type: 'image/png'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hash-image.png';
    a.click();
    URL.revokeObjectURL(url);
}

// URL handling functions

function updateUrlWithIndex(index) {
  window.location.hash = `#/image9/${index}`;
}

function handleUrlNavigation() {
  const hash = window.location.hash;
  const match = hash.match(/#\/image9\/(\d+)/);
  if (match) {
    const index = parseInt(match[1]);
    if (index >= 0 && index <= 255) {
      // ONLY reset to input mode if the index is different from what's already selected
      // or if we aren't already in grid mode.
      if (selectedImageIndex !== index) {
        selectedImageIndex = index;
        currentMode = 'input';
        controls.classList.remove('disabled');
        inputField.disabled = false;
        drawCanvasBitmap(index);
        updateTitleAndHeader(index);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initGlobals();
  initCanvas();
  await initHasher();
  drawBitmapGrid();
  inputField.addEventListener('input', handleInput);
  downloadBtn.addEventListener('click', handleDownload);

  // Handle URL navigation
  handleUrlNavigation();
  window.addEventListener('popstate', handleUrlNavigation);

  // Handle click on controls to return to input mode
  controls.addEventListener('click', () => {
    if (currentMode === 'grid') {
      currentMode = 'input';
      controls.classList.remove('disabled');
      inputField.disabled = false;
      
      // Update preview with current input
      const text = inputField.value;
      if (text) {
          const hashInfo = getHashInfo(text, crc32Instance);
          if (hashInfo) {
            selectedImageIndex = hashInfo.index; // Store the index from input
            drawCanvasBitmap(hashInfo.index);
            updateUrlWithIndex(hashInfo.index);
            updateTitleAndHeader(hashInfo.index);
          }
      }
    }
  });

  // Handle invert button click
  invertBtn.addEventListener('click', () => {
    isInverted = !isInverted;
    invertBtn.classList.toggle('active', isInverted);
    
    // Redraw the current bitmap with inversion state
    const indexToUse = selectedImageIndex !== null ? selectedImageIndex : 
                      (inputField.value ? getHashInfo(inputField.value, crc32Instance)?.index : null);
    
    if (indexToUse !== null) {
      drawCanvasBitmap(indexToUse);
    }
  });

  const picker = new Picker({
    parent: colorPickerBtn,
    alpha: false,
    color: '#000000',
    onChange: function(color) {
      foregroundColor = color.hex;
      // Use the selected image index if available, otherwise use input-based index
      const indexToUse = selectedImageIndex !== null ? selectedImageIndex : 
                        (inputField.value ? getHashInfo(inputField.value, crc32Instance)?.index : null);
      
      if (indexToUse !== null) {
        drawCanvasBitmap(indexToUse);
      }
    }
  });
});
