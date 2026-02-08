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

function getPixelArray(index, invert = false) {
  // Val is now 9 bit, holding all pixels.
  // Last (largest) bit always 1.
  const val = index + 256;
  const pixelArray = [];
  
  for (let y = 0; y < 3; y++) {
    const row = [];
    for (let x = 0; x < 3; x++) {
      const posIndex = x + (3 * y);
      let bit = (val >> posIndex) & 1;
      
      // Apply inversion if requested
      if (invert) {
        bit = bit === 1 ? 0 : 1;
      }
      
      row.push(bit);
    }
    pixelArray.push(row);
  }
  
  return pixelArray;
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
      });
      gridContainer.appendChild(wrapper);
  }
}

// Function to calculate hash info from text
function getHashInfo(text) {
  if (!crc32Instance) {
    return null;
  }
  
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

  return {
    hash: hash,
    index: index,
    imageNumber: imageNumber,
    base: base,
    last: last
  };
}

// 2. Handle Input Logic
async function handleInput(e) {
    const text = e.target.value;
    resultInfo.textContent = '';
    if (!text) {
      return;
    }

    const hashInfo = getHashInfo(text);
    if (hashInfo) {
      resultInfo.innerHTML =
        `Hash (CRC-32): ${hashInfo.base}<span class="last-two">${hashInfo.last}</span>` +
        ` (Image ${hashInfo.imageNumber})`;

      selectedImageIndex = hashInfo.index; // Store the index from input
      drawCanvasBitmap(hashInfo.index);
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

document.addEventListener('DOMContentLoaded', () => {
  initGlobals();
  initCanvas();
  initHasher();
  drawBitmapGrid();
  inputField.addEventListener('input', handleInput);
  downloadBtn.addEventListener('click', handleDownload);

  // Handle click on controls to return to input mode
  controls.addEventListener('click', () => {
    if (currentMode === 'grid') {
      currentMode = 'input';
      controls.classList.remove('disabled');
      inputField.disabled = false;
      
      // Update preview with current input
      const text = inputField.value;
      if (text) {
          const hashInfo = getHashInfo(text);
          if (hashInfo) {
            selectedImageIndex = hashInfo.index; // Store the index from input
            drawCanvasBitmap(hashInfo.index);
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
                      (inputField.value ? getHashInfo(inputField.value)?.index : null);
    
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
                        (inputField.value ? getHashInfo(inputField.value)?.index : null);
      
      if (indexToUse !== null) {
        drawCanvasBitmap(indexToUse);
      }
    }
  });
});
