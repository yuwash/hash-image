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

initHasher();

const gridContainer = document.getElementById('grid-container');
const largeBitmapDiv = document.getElementById('large-bitmap');
const inputField = document.getElementById('hash-input');
const resultInfo = document.getElementById('result-info');

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

// Helper function to create a bitmap div
// index: 1 to 256
// sizeClass: 'bitmap' (2rem) or 'preview-bitmap' (10rem)
// showIndex: boolean (true for grid, false for preview)
function createBitmapOld(index, cssClass, showIndex) {
    const bitmapDiv = document.createElement('div');
    bitmapDiv.className = cssClass;

    // Calculate the 8-bit value (0 to 255) corresponding to the index
    // Index 1 -> 0, Index 256 -> 255
    const val = index;

    // We need to map the 8 bits of 'val' to the pixels.
    // Rule: Bottom right (index 8) is always black.
    // Other pixels (0-7) correspond to binary digit at x+3*y.

    // Coordinates mapping (x, y):
    // 0,0 1,0 2,0
    // 0,1 1,1 2,1
    // 0,2 1,2 2,2 (Fixed Black)

    // Loop through the 9 pixels
    for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
            const pixelDiv = document.createElement('div');
            pixelDiv.className = 'pixel';

            // Check if bottom right
            if (x === 2 && y === 2) {
                pixelDiv.classList.add('black');
            } else {
                // Calculate position index for bit selection: x + 3*y
                // However, we need to map this to the bits of 'val'.
                // Usually, bit 0 is LSB.
                // Let's map:
                // (0,0) -> bit 0
                // (1,0) -> bit 1
                // (2,0) -> bit 2
                // (0,1) -> bit 3
                // (1,1) -> bit 4
                // (2,1) -> bit 5
                // (0,2) -> bit 6
                // (1,2) -> bit 7

                const posIndex = x + (3 * y);
                const bit = (val >> posIndex) & 1;

                if (bit === 1) {
                    pixelDiv.classList.add('black');
                } else {
                    pixelDiv.classList.add('white');
                }
            }
            bitmapDiv.appendChild(pixelDiv);
        }
    }

    // Add index number on top if requested
    if (showIndex) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'index-label';
        labelDiv.textContent = index;
        bitmapDiv.appendChild(labelDiv);
    }

    return bitmapDiv;
}

// 1. Generate the grid of 256 images
for (let i = 0; i <= 255; i++) {
    const bitmap = createBitmap(i, 'bitmap', true);
    gridContainer.appendChild(bitmap);
}

// 2. Handle Input Logic
inputField.addEventListener('input', async (e) => {
    const text = e.target.value;
    largeBitmapDiv.innerHTML = ''; // Clear previous
    resultInfo.textContent = '';
    if (!text) {
      resultInfo.innerHTML = ''; // column still visible, just empty text
      largeBitmapDiv.innerHTML = '';
      // Empty input: show empty image (all white)
      // We construct a 3x3 all-white grid manually or createBitmap with special case
      // Easiest is to createBitmap with index 0, but logic expects 1-256.
      // Let's just create 9 white divs.
      for (let k = 0; k < 9; k++) {
        const p = document.createElement('div');
        p.className = 'pixel white';
        largeBitmapDiv.appendChild(p);
      }
      return;
    }

    if (crc32Instance) {
      crc32Instance.init();
      const uint8Array = new TextEncoder().encode(text);
      crc32Instance.update(uint8Array);
      const hash = crc32Instance.digest('hex');

      const first8Hex = hash.substring(0, 8);
      const hashInt = parseInt(first8Hex, 16);
      const index = (hashInt % 256);

      // Last two hex digits for image (minus 1 = 0255)
      const lastTwo = hash.slice(-2);           // "d2"
      const imageNumber = parseInt(lastTwo, 16); // 0255

      // Build the string with highlighted last two digits
      const base = hash.slice(0, -2);
      const last = hash.slice(-2);

      resultInfo.innerHTML =
        `Hash (CRC-32): ${base}<span class="last-two">${last}</span>` +
        ` (Image ${imageNumber})`;

      // Render large image as before, using your chosen index
      const largeImage = createBitmap(index, 'preview-bitmap', false);
      largeBitmapDiv.innerHTML = '';
      largeBitmapDiv.appendChild(largeImage);
    }
});

// Initialize empty state
for(let k=0; k<9; k++) {
    const p = document.createElement('div');
    p.className = 'pixel white';
    largeBitmapDiv.appendChild(p);
}