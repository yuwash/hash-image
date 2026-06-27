// Initialize the library if needed (hash-wasm usually auto-initializes or exposes global)
// The UMD build exposes createCRC32 or similar depending on version, 
// usually we access the global object. Based on standard UMD usage for this lib:
let crc32Instance;

// Import functions from hashImage.js
import { getHashInfo, getPixelArray } from './hashImage.js';
import { generateHashAudio } from './hashSound.js';

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
let audioBtn;
let audioPlayer;
let downloadAudioBtn;
let frequencySlider;
let frequencyValue;
let verticalFrequencySlider;
let verticalFrequencyValue;
let audioUrl = null;
let currentMode = 'input'; // 'input' or 'grid'

let activeTabId = 'tab-0';
let tabsMap = {
  'tab-0': {
    foregroundColor: 'black',
    isInverted: false,
    fillFrequencyH: 0,
    fillFrequencyV: 0,
    index: null
  }
};

let renderingState = tabsMap[activeTabId];

let tabLabel0;
let addTabBtn;
let tabsContainer;
let tabCount = 1;
let colorPicker;

function initGlobals() {
  tabLabel0 = document.getElementById('tab-label-0');
  addTabBtn = document.getElementById('add-tab-btn');
  tabsContainer = document.getElementById('tabs-container').querySelector('ul');
  gridContainer = document.getElementById('grid-container');
  largeBitmapCanvas = document.getElementById('preview-bitmap');
  ctx = largeBitmapCanvas.getContext('2d');
  downloadBtn = document.getElementById('download-btn');
  resultInfo = document.getElementById('result-info');
  inputField = document.getElementById('hash-input');
  colorPickerBtn = document.getElementById('color-picker-btn');
  invertBtn = document.getElementById('invert-btn');
  controls = document.getElementById('controls');
  audioBtn = document.getElementById('audio-btn');
  audioPlayer = document.getElementById('audio-player');
  downloadAudioBtn = document.getElementById('download-audio-btn');
  frequencySlider = document.getElementById('frequency-slider');
  frequencyValue = document.getElementById('frequency-value');
  verticalFrequencySlider = document.getElementById('vertical-frequency-slider');
  verticalFrequencyValue = document.getElementById('vertical-frequency-value');
}

const SCALE_UP = 120;
const canvasSize = 3 * SCALE_UP;

function initCanvas() {
  largeBitmapCanvas.width = canvasSize;
  largeBitmapCanvas.height = canvasSize;
}

function resetAudio() {
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
  if (audioPlayer) {
    audioPlayer.src = '';
    audioPlayer.classList.add('hidden');
  }
  if (downloadAudioBtn) {
    downloadAudioBtn.classList.add('hidden');
  }
  if (audioBtn) {
    audioBtn.disabled = false;
    audioBtn.textContent = 'Generate Audio';
  }
}

function switchToTextInput() {
  currentMode = 'input';
  controls.classList.remove('disabled');
  inputField.disabled = false;
  resetAudio();
  
  const text = inputField.value;
  if (text) {
    const hashInfo = getHashInfo(text, crc32Instance);
    if (hashInfo) {
      renderingState.index = hashInfo.index;
      drawCanvasBitmap(hashInfo.index);
      updateUrlWithIndex(hashInfo.index);
      updateTitleAndHeader(hashInfo.index);
    }
  } else {
    // If no text, clear preview canvas, URL, and header
    renderingState.index = null;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    window.location.hash = '';
    document.title = 'hash-image';
    document.querySelector('h1').textContent = 'hash-image';
  }
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
    const activeTabLabel = document.getElementById(`tab-label-${activeTabId.split('-')[1]}`);
    if (activeTabLabel) {
      activeTabLabel.textContent = index !== null ? `Image ${index}` : 'No Image';
    }
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    if (index === null) return;

    const { foregroundColor, isInverted, fillFrequencyH, fillFrequencyV } = renderingState;
    const pixelArray = getPixelArray(index, isInverted);

    pixelArray.forEach((row, y) => {
      row.forEach((pixelValue, x) => {
        if (pixelValue === 1) {
          if (fillFrequencyH === 0 && fillFrequencyV === 0) {
            ctx.fillStyle = foregroundColor;
            ctx.fillRect(x * SCALE_UP, y * SCALE_UP, SCALE_UP, SCALE_UP);
          } else if (fillFrequencyH > 0 && fillFrequencyV === 0) {
            ctx.fillStyle = foregroundColor;
            for (let i = 0; i < SCALE_UP; i++) {
              const xRel = i / SCALE_UP;
              const opacity = (-Math.cos(2 * Math.PI * fillFrequencyH * xRel) + 1) / 2;
              ctx.globalAlpha = opacity;
              ctx.fillRect(x * SCALE_UP + i, y * SCALE_UP, 1, SCALE_UP);
            }
          } else if (fillFrequencyH === 0 && fillFrequencyV > 0) {
            ctx.fillStyle = foregroundColor;
            for (let j = 0; j < SCALE_UP; j++) {
              const yRel = j / SCALE_UP;
              const opacity = (-Math.cos(2 * Math.PI * fillFrequencyV * yRel) + 1) / 2;
              ctx.globalAlpha = opacity;
              ctx.fillRect(x * SCALE_UP, y * SCALE_UP + j, SCALE_UP, 1);
            }
          } else {
            // Both frequencies > 0
            ctx.fillStyle = foregroundColor;
            for (let j = 0; j < SCALE_UP; j++) {
              const yRel = j / SCALE_UP;
              const opacityV = (-Math.cos(2 * Math.PI * fillFrequencyV * yRel) + 1) / 2;
              for (let i = 0; i < SCALE_UP; i++) {
                const xRel = i / SCALE_UP;
                const opacityH = (-Math.cos(2 * Math.PI * fillFrequencyH * xRel) + 1) / 2;
                ctx.globalAlpha = opacityH * opacityV;
                ctx.fillRect(x * SCALE_UP + i, y * SCALE_UP + j, 1, 1);
              }
            }
          }
        }
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
          renderingState.index = i;
          drawCanvasBitmap(i);
          controls.classList.add('disabled');
          inputField.disabled = true;
          updateUrlWithIndex(i);
          updateTitleAndHeader(i);
          resetAudio();
      });
      gridContainer.appendChild(wrapper);
  }
}

// 2. Handle Input Logic
async function handleInput(e) {
    const text = e.target.value;
    resultInfo.textContent = '';
    resetAudio();
    if (!text) {
      return;
    }

    const hashInfo = getHashInfo(text, crc32Instance);
    if (hashInfo) {
      resultInfo.innerHTML =
        `Hash (CRC-32): ${hashInfo.base}<span class="last-two">${hashInfo.last}</span>`;

      renderingState.index = hashInfo.index;
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
      if (renderingState.index !== index) {
        renderingState.index = index;
        currentMode = 'input';
        controls.classList.remove('disabled');
        inputField.disabled = false;
        drawCanvasBitmap(index);
        updateTitleAndHeader(index);
        resetAudio();
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

  frequencySlider.addEventListener('input', (e) => {
    renderingState.fillFrequencyH = parseInt(e.target.value, 10);
    frequencyValue.textContent = renderingState.fillFrequencyH;

    if (renderingState.index !== null) {
      drawCanvasBitmap(renderingState.index);
    }
  });

  verticalFrequencySlider.addEventListener('input', (e) => {
    renderingState.fillFrequencyV = parseInt(e.target.value, 10);
    verticalFrequencyValue.textContent = renderingState.fillFrequencyV;

    if (renderingState.index !== null) {
      drawCanvasBitmap(renderingState.index);
    }
  });

  // Handle URL navigation
  handleUrlNavigation();
  window.addEventListener('popstate', handleUrlNavigation);

  // Handle click on controls to return to input mode
  controls.addEventListener('click', () => {
    if (currentMode === 'grid') {
      switchToTextInput();
    }
  });

  // Handle invert button click
  invertBtn.addEventListener('click', () => {
    renderingState.isInverted = !renderingState.isInverted;
    invertBtn.classList.toggle('active', renderingState.isInverted);
    resetAudio();
    
    if (renderingState.index !== null) {
      drawCanvasBitmap(renderingState.index);
    }
  });

  colorPicker = new Picker({
    parent: colorPickerBtn,
    alpha: false,
    color: '#000000',
    onChange: function(color) {
      renderingState.foregroundColor = color.hex;
      if (renderingState.index !== null) {
        drawCanvasBitmap(renderingState.index);
      }
    }
  });

  // Handle audio generation button click
  audioBtn.addEventListener('click', async () => {
    const indexToUse = renderingState.index;
    
    if (indexToUse === null) {
      alert('Please enter text or click a grid image to generate a hash image first.');
      return;
    }

    try {
      audioBtn.classList.add('is-loading');
      audioBtn.disabled = true;

      // Flatten 3x3 pixel array (includes inversion state)
      const pixelArray = getPixelArray(indexToUse, renderingState.isInverted);
      const bits = pixelArray.flat();

      // Revoke old URL to avoid memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // Generate WAV URL and set it to player
      audioUrl = await generateHashAudio(bits);
      audioPlayer.src = audioUrl;
      audioPlayer.classList.remove('hidden');
      if (downloadAudioBtn) {
        downloadAudioBtn.classList.remove('hidden');
      }

      // Attempt autoplay
      try {
        await audioPlayer.play();
      } catch (playErr) {
        console.log('Autoplay prevented by browser: ', playErr);
      }
    } catch (err) {
      console.error('Failed to generate audio:', err);
      alert('Could not generate audio. Please try again.');
    } finally {
      audioBtn.classList.remove('is-loading');
      audioBtn.disabled = false;
      audioBtn.textContent = 'Generate Audio';
    }
  });

  // Handle downloading the generated WAV file
  if (downloadAudioBtn) {
    downloadAudioBtn.addEventListener('click', () => {
      if (audioUrl) {
        const indexToUse = renderingState.index !== null ? renderingState.index : 'unknown';
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `hash-audio-${indexToUse}.wav`;
        a.click();
      }
    });
  }

  // Handle click on input container when input is disabled to switch back to text mode
  const controlWrapper = inputField.closest('.control');
  if (controlWrapper) {
    controlWrapper.addEventListener('click', (e) => {
      if (inputField.disabled) {
        // Prevent click from bubbling up to general controls listener
        e.stopPropagation();
        switchToTextInput();
        inputField.focus();
      }
    });
  }

  document.getElementById('tab-0').addEventListener('click', () => switchTab('tab-0'));

  addTabBtn.addEventListener('click', () => {
    const newTabId = `tab-${tabCount}`;
    tabsMap[newTabId] = { ...renderingState };

    const newTabLi = document.createElement('li');
    newTabLi.id = newTabId;

    const newTabA = document.createElement('a');
    newTabA.id = `tab-label-${tabCount}`;
    newTabA.textContent = renderingState.index !== null ? `Image ${renderingState.index}` : 'No Image';

    newTabLi.appendChild(newTabA);
    tabsContainer.insertBefore(newTabLi, addTabBtn.parentElement);

    newTabLi.addEventListener('click', () => switchTab(newTabId));

    tabCount++;
    switchTab(newTabId);
  });

  function switchTab(tabId) {
    activeTabId = tabId;
    renderingState = tabsMap[tabId];

    // Update active tab UI
    tabsContainer.querySelectorAll('li').forEach(li => {
      li.classList.toggle('is-active', li.id === tabId);
    });

    // Sync sliders and color picker with the new tab state
    frequencySlider.value = renderingState.fillFrequencyH;
    frequencyValue.textContent = renderingState.fillFrequencyH;
    verticalFrequencySlider.value = renderingState.fillFrequencyV;
    verticalFrequencyValue.textContent = renderingState.fillFrequencyV;
    invertBtn.classList.toggle('active', renderingState.isInverted);
    colorPicker.setColor(renderingState.foregroundColor, true);

    drawCanvasBitmap(renderingState.index);
    if (renderingState.index !== null) {
      updateUrlWithIndex(renderingState.index);
      updateTitleAndHeader(renderingState.index);
    } else {
      window.location.hash = '';
      document.title = 'hash-image';
      document.querySelector('h1').textContent = 'hash-image';
    }
  }
});
