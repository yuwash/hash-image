// Initialize the library if needed (hash-wasm usually auto-initializes or exposes global)
// The UMD build exposes createCRC32 or similar depending on version, 
// usually we access the global object. Based on standard UMD usage for this lib:
let crc32Instance;
let sha256Instance; // New instance for SHA-256

// Import functions from hashImage.js
import { getHashInfo, getPixelArray, getPixelOpacityMap } from './hashImage.js';
import { generateHashAudio } from './hashSound.js';

async function initHasher() {
  if (window.hashwasm && window.hashwasm.createCRC32) {
    crc32Instance = await window.hashwasm.createCRC32();
  } else {
    console.error('hash-wasm not loaded or createCRC32 not available');
  }
  // Initialize SHA-256 instance
  if (window.hashwasm && window.hashwasm.createSHA256) {
    sha256Instance = await window.hashwasm.createSHA256();
  } else {
    console.error('hash-wasm not loaded or createSHA256 not available');
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
    indexes: []
  }
};

let renderingState = tabsMap[activeTabId];

let tabLabel0;
let addTabBtn;
let tabsContainer;
let tabCount = 1;
let colorPicker;

// State variable for selected hash method
let selectedHashMethod = 'crc32';

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

  // Get the dropdown element and add event listener
  const hashMethodDropdown = document.getElementById('hash-method-dropdown');
  if (hashMethodDropdown) {
    hashMethodDropdown.addEventListener('change', (e) => {
      selectedHashMethod = e.target.value;
      // Re-calculate hash if there's input text
      if (inputField.value) {
        handleInput({ target: inputField });
      }
    });
  }
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

function updateTabLabel(tabId) {
  const state = tabsMap[tabId];
  if (!state) return;
  
  let labelText = 'No Image';
  if (state.indexes && state.indexes.length > 0) {
    labelText = `Image ${state.indexes[0]}`;
    if (state.indexes.length > 1) {
      labelText += '…';
    }
  }
  
  const tabIdNum = tabId.split('-')[1];
  const tabLabel = document.getElementById(`tab-label-${tabIdNum}`);
  if (tabLabel) {
    tabLabel.textContent = labelText;
  }
}

function updateTagsList() {
  const container = document.getElementById('image-tags-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (activeTabId === 'tab-mix') {
    container.classList.add('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  const state = tabsMap[activeTabId];
  if (!state || !state.indexes || state.indexes.length === 0) {
    return;
  }
  
  state.indexes.forEach((idx) => {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'control';
    
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'tags has-addons';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'tag is-dark';
    labelSpan.textContent = `${idx}`;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'tag is-delete';
    deleteBtn.type = 'button';
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeIndexFromTab(idx);
    });
    
    tagsDiv.appendChild(labelSpan);
    tagsDiv.appendChild(deleteBtn);
    controlDiv.appendChild(tagsDiv);
    container.appendChild(controlDiv);
  });
}

function removeIndexFromTab(idx) {
  if (activeTabId === 'tab-mix') return;
  const state = tabsMap[activeTabId];
  if (!state || !state.indexes) return;
  
  const pos = state.indexes.indexOf(idx);
  if (pos !== -1) {
    state.indexes.splice(pos, 1);
  }
  
  drawCanvasBitmap();
  updateTabLabel(activeTabId);
  updateTagsList();
  resetAudio();
  
  if (state.indexes.length > 0) {
    updateUrlWithIndexes(state.indexes);
    updateTitleAndHeader(state.indexes[0]);
  } else {
    window.location.hash = '';
    document.title = 'hash-image';
    document.querySelector('h1').textContent = 'hash-image';
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
      renderingState.indexes = [hashInfo.index];
      drawCanvasBitmap();
      updateUrlWithIndexes(renderingState.indexes);
      updateTitleAndHeader(hashInfo.index);
      updateTagsList();
    }
  } else {
    // If no text, clear preview canvas, URL, and header
    renderingState.indexes = [];
    drawCanvasBitmap();
    window.location.hash = '';
    document.title = 'hash-image';
    document.querySelector('h1').textContent = 'hash-image';
    updateTagsList();
  }
}

function createBitmap(index, cssClass, showIndex, isGallery = false) {
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
  if (isGallery) {
    bitmapDiv.style.width = '2rem';
    bitmapDiv.style.height = '2rem';
  }

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

function drawSingleBitmap(index, state) {
  if (index === null) return;
  const { foregroundColor, isInverted, fillFrequencyH, fillFrequencyV } = state;
  const pixelArray = getPixelArray(index, isInverted);
  const opacityMap = getPixelOpacityMap(SCALE_UP, fillFrequencyH, fillFrequencyV);

  ctx.fillStyle = foregroundColor;

  pixelArray.forEach((row, y) => {
    row.forEach((pixelValue, x) => {
      if (pixelValue === 1) {
        const startX = x * SCALE_UP;
        const startY = y * SCALE_UP;

        if (fillFrequencyH === 0 && fillFrequencyV === 0) {
          // If multiple indexes are present, apply an opacity of 1/n for each
          if (state.indexes && state.indexes.length > 1) {
            const n = state.indexes.length;
            ctx.globalAlpha = 1.0 / n;
          } else {
            ctx.globalAlpha = 1.0;
          }
          ctx.fillRect(startX, startY, SCALE_UP, SCALE_UP);
        } else if (fillFrequencyH > 0 && fillFrequencyV === 0) {
          for (let i = 0; i < SCALE_UP; i++) {
            ctx.globalAlpha = opacityMap[0][i];
            ctx.fillRect(startX + i, startY, 1, SCALE_UP);
          }
        } else if (fillFrequencyH === 0 && fillFrequencyV > 0) {
          for (let j = 0; j < SCALE_UP; j++) {
            ctx.globalAlpha = opacityMap[j][0];
            ctx.fillRect(startX, startY + j, SCALE_UP, 1);
          }
        } else {
          for (let j = 0; j < SCALE_UP; j++) {
            for (let i = 0; i < SCALE_UP; i++) {
              ctx.globalAlpha = opacityMap[j][i];
              ctx.fillRect(startX + i, startY + j, 1, 1);
            }
          }
        }
      }
    });
  });
}

function drawCanvasBitmap(clear = true, stateOverride = null) {
    const state = stateOverride || renderingState;

    // Only update tab label if we are drawing for the active tab without override
    if (!stateOverride && activeTabId !== 'tab-mix') {
      updateTabLabel(activeTabId);
    }

    ctx.globalAlpha = 1.0; // Reset global alpha before clearing or drawing
    if (clear) {
      ctx.clearRect(0, 0, canvasSize, canvasSize);
    }

    // If we are in mix mode or the current tab has no indexes, do nothing more
    if (!state || !state.indexes || state.indexes.length === 0) {
        return;
    }

    const prevComp = ctx.globalCompositeOperation;
    // If multiple indexes, use 'lighter' for additive blending.
    // The individual drawSingleBitmap will handle per-bitmap opacity.
    if (state.indexes.length > 1) {
      ctx.globalCompositeOperation = 'lighter';
    } else {
      ctx.globalCompositeOperation = 'source-over'; // Ensure it's reset if only one image
    }

    state.indexes.forEach(idx => {
      drawSingleBitmap(idx, state);
    });

    ctx.globalCompositeOperation = prevComp; // Restore original composite operation
}

function drawMixCanvas() {
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.globalCompositeOperation = 'lighter';

  // Iterate over all tabs *except* the mix tab itself
  for (const tabId in tabsMap) {
    if (tabId === 'tab-mix') continue; // Skip the mix tab itself
    const state = tabsMap[tabId];
    if (state.indexes && state.indexes.length > 0) {
      // Use drawCanvasBitmap with stateOverride to draw each tab's content
      drawCanvasBitmap(false, state);
    }
  }

  ctx.globalCompositeOperation = 'source-over';
}

// Update title and h1 with current index
function updateTitleAndHeader(index) {
  document.title = `hash-image ${index}`;
  document.querySelector('h1').textContent = `hash-image ${index}`;
}

// 1. Generate the grid of 256 images
function drawBitmapGrid() {
  for (let i = 0; i <= 255; i++) {
      const wrapper = createBitmap(i, 'bitmap', true, true);
      wrapper.addEventListener('click', () => {
          currentMode = 'grid';
          // Add to current tab's indexes instead of replacing
          if (!renderingState.indexes.includes(i)) {
            renderingState.indexes.push(i);
          }
          drawCanvasBitmap();
          controls.classList.add('disabled');
          inputField.disabled = true;
          updateUrlWithIndexes(renderingState.indexes);
          updateTitleAndHeader(i);
          updateTagsList();
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

    let hashInfo = null;
    let hashHex = '';
    let numPairs = 0;

    if (selectedHashMethod === 'crc32') {
      hashInfo = getHashInfo(text, crc32Instance);
      if (hashInfo) {
        hashHex = hashInfo.base; // This should be the full 8-digit hex string
        numPairs = 4; // CRC-32 has 8 hex digits, so 4 pairs
      }
    } else if (selectedHashMethod === 'sha256') {
      hashInfo = getHashInfo(text, sha256Instance);
      if (hashInfo) {
        hashHex = hashInfo.base; // This should be the full 64-digit hex string
        numPairs = 32; // SHA-256 has 64 hex digits, so 32 pairs
      }
    } else {
      console.warn(`Hash method "${selectedHashMethod}" not implemented.`);
      return;
    }

    if (hashInfo || hashHex) {
      const indexes = [];
      let rubyHtml = '';

      // Process 2 hex digits at a time to get the index for each pair
      for (let i = 0; i < hashHex.length; i += 2) {
        const pair = hashHex.substring(i, i + 2);
        const decimal = parseInt(pair, 16);
        indexes.push(decimal);
        rubyHtml += `<ruby>${pair}<rt>${decimal}</rt></ruby>`;
      }
      indexes.push(hashInfo.index);  // the last one.
      
      // Replace the current indexes list with the new ones
      renderingState.indexes = indexes;

      const lastDecimal = parseInt(hashInfo.last, 16);
      const lastRubyHtml = `<ruby>${hashInfo.last}<rt>${lastDecimal}</rt></ruby>`;
      
      // Update resultInfo to show "Hash:" and the generated hash
      resultInfo.innerHTML = `Hash: ${rubyHtml}<span class="last-two">${lastRubyHtml}</span>`;

      drawCanvasBitmap();
      updateUrlWithIndexes(renderingState.indexes);
      updateTitleAndHeader(hashInfo.index);
      updateTagsList();
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

function arraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function updateUrlWithIndexes(indexes) {
  if (indexes && indexes.length > 0) {
    window.location.hash = `#/image9/${indexes.join(',')}`;
  } else {
    window.location.hash = '';
  }
}

function handleUrlNavigation() {
  const hash = window.location.hash;
  const match = hash.match(/#\/image9\/([\d,]+)/);
  if (match) {
    const parts = match[1].split(',');
    const indexes = parts.map(p => parseInt(p, 10)).filter(idx => !isNaN(idx) && idx >= 0 && idx <= 255);
    if (!arraysEqual(renderingState.indexes, indexes)) {
      renderingState.indexes = indexes;
      currentMode = 'input';
      controls.classList.remove('disabled');
      inputField.disabled = false;
      drawCanvasBitmap();
      if (indexes.length > 0) {
        updateTitleAndHeader(indexes[0]);
      }
      updateTagsList();
      resetAudio();
    }
  } else if (hash === '' || hash === '#') {
    if (renderingState.indexes.length > 0) {
      renderingState.indexes = [];
      currentMode = 'input';
      controls.classList.remove('disabled');
      inputField.disabled = false;
      drawCanvasBitmap();
      updateTagsList();
      resetAudio();
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

    if (renderingState.indexes.length > 0) {
      drawCanvasBitmap();
    }
  });

  verticalFrequencySlider.addEventListener('input', (e) => {
    renderingState.fillFrequencyV = parseInt(e.target.value, 10);
    verticalFrequencyValue.textContent = renderingState.fillFrequencyV;

    if (renderingState.indexes.length > 0) {
      drawCanvasBitmap();
    }
  });

  // Handle URL navigation
  handleUrlNavigation();
  updateTagsList();
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
    
    if (renderingState.indexes.length > 0) {
      drawCanvasBitmap();
    }
  });

  colorPicker = new Picker({
    parent: colorPickerBtn,
    alpha: false,
    color: '#000000',
    onChange: function(color) {
      renderingState.foregroundColor = color.hex;
      if (renderingState.indexes.length > 0) {
        drawCanvasBitmap();
      }
    }
  });

  // Handle audio generation button click
  audioBtn.addEventListener('click', async () => {
    let tracks = [];
    if (activeTabId === 'tab-mix') {
      // Iterate over all tabs *except* the mix tab itself
      for (const tabId in tabsMap) {
        if (tabId === 'tab-mix') continue; // Skip the mix tab itself
        const state = tabsMap[tabId];
        if (state.indexes && state.indexes.length > 0) {
          state.indexes.forEach(index => {
            const pixelArray = getPixelArray(index, state.isInverted);
            const bits = pixelArray.flat();
            tracks.push({
              bits: bits,
              trillFrequency: state.fillFrequencyH,
              equalizerFrequency: state.fillFrequencyV
            });
          });
        }
      }
      if (tracks.length === 0) {
        alert('Please enter text or click a grid image in at least one tab first.');
        return;
      }
    } else {
      if (!renderingState.indexes || renderingState.indexes.length === 0) {
        alert('Please enter text or click a grid image to generate a hash image first.');
        return;
      }
      renderingState.indexes.forEach(index => {
        const pixelArray = getPixelArray(index, renderingState.isInverted);
        const bits = pixelArray.flat();
        tracks.push({
          bits: bits,
          trillFrequency: renderingState.fillFrequencyH,
          equalizerFrequency: renderingState.fillFrequencyV
        });
      });
    }

    try {
      audioBtn.classList.add('is-loading');
      audioBtn.disabled = true;

      // Revoke old URL to avoid memory leaks
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // Generate WAV URL and set it to player
      audioUrl = await generateHashAudio(tracks);
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
        const indexToUse = activeTabId === 'tab-mix' ? 'mix' : (renderingState.indexes.length > 0 ? renderingState.indexes.join('_') : 'unknown');
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

  document.getElementById('tab-0').querySelector('.tab-click-area').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('tab-0');
  });

  document.getElementById('tab-0').querySelector('.close-tab-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeTab('tab-0');
  });

  addTabBtn.addEventListener('click', () => {
    const newTabId = `tab-${tabCount}`;
    tabsMap[newTabId] = {
      foregroundColor: renderingState.foregroundColor,
      isInverted: renderingState.isInverted,
      fillFrequencyH: renderingState.fillFrequencyH,
      fillFrequencyV: renderingState.fillFrequencyV,
      indexes: [...renderingState.indexes]
    };

    const newTabLi = document.createElement('li');
    newTabLi.id = newTabId;
    newTabLi.className = 'tab-item';

    const a = document.createElement('a');
    a.className = 'is-flex is-align-items-center';

    const span = document.createElement('span');
    span.id = `tab-label-${tabCount}`;
    span.className = 'tab-click-area';

    const btn = document.createElement('button');
    btn.className = 'delete is-small ml-2 close-tab-btn';
    btn.dataset.tabId = newTabId;

    a.appendChild(span);
    a.appendChild(btn);
    newTabLi.appendChild(a);

    tabsContainer.insertBefore(newTabLi, addTabBtn.parentElement);

    span.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(newTabId);
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeTab(newTabId);
    });

    updateTabLabel(newTabId);
    tabCount++;
    switchTab(newTabId);
  });

  document.getElementById('tab-mix').addEventListener('click', () => switchTab('tab-mix'));

  function closeTab(tabId) {
    const tabIds = Object.keys(tabsMap);
    if (tabIds.length <= 1) return;

    if (activeTabId === tabId) {
      const currentIndex = tabIds.indexOf(tabId);
      const newActiveTabId = tabIds[currentIndex - 1] || tabIds[currentIndex + 1];
      switchTab(newActiveTabId);
    }

    delete tabsMap[tabId];
    const tabElem = document.getElementById(tabId);
    if (tabElem) tabElem.remove();

    // If the mix tab was active and a tab is closed, redraw mix canvas if it's still active
    if (activeTabId === 'tab-mix') {
      drawMixCanvas();
    }
  }

  function switchTab(tabId) {
    // Save current tab state before switching
    if (activeTabId !== 'tab-mix') {
      tabsMap[activeTabId] = {
        foregroundColor: renderingState.foregroundColor,
        isInverted: renderingState.isInverted,
        fillFrequencyH: renderingState.fillFrequencyH,
        fillFrequencyV: renderingState.fillFrequencyV,
        indexes: [...renderingState.indexes]
      };
    }

    activeTabId = tabId;
    resetAudio();

    // Update active tab UI
    tabsContainer.querySelectorAll('li').forEach(li => {
      li.classList.toggle('is-active', li.id === tabId);
    });

    if (tabId === 'tab-mix') {
      window.location.hash = '';
      // Need to happen before disabling controls as it would enable it again.
      // It would also draw the canvas again, so drawMixCanvas needs to come after.

      // Hide most controls except download and preview
      inputField.disabled = true;
      controls.classList.add('disabled');
      resultInfo.classList.add('hidden');
      gridContainer.classList.add('hidden');
      colorPickerBtn.classList.add('hidden');
      invertBtn.classList.add('hidden');
      frequencySlider.closest('.field').classList.add('hidden');
      verticalFrequencySlider.closest('.field').classList.add('hidden');

      drawMixCanvas();
      updateTagsList();

      document.title = 'hash-image Mix';
      document.querySelector('h1').textContent = 'hash-image Mix';
      return;
    }

    // Show controls for normal tabs
    inputField.disabled = false;
    controls.classList.remove('disabled');
    resultInfo.classList.remove('hidden');
    gridContainer.classList.remove('hidden');
    colorPickerBtn.classList.remove('hidden');
    invertBtn.classList.remove('hidden');
    audioBtn.classList.remove('hidden');
    frequencySlider.closest('.field').classList.remove('hidden');
    verticalFrequencySlider.closest('.field').classList.remove('hidden');

    renderingState = tabsMap[tabId];

    // Sync sliders and color picker with the new tab state
    frequencySlider.value = renderingState.fillFrequencyH;
    frequencyValue.textContent = renderingState.fillFrequencyH;
    verticalFrequencySlider.value = renderingState.fillFrequencyV;
    verticalFrequencyValue.textContent = renderingState.fillFrequencyV;
    invertBtn.classList.toggle('active', renderingState.isInverted);
    colorPicker.setColor(renderingState.foregroundColor, true);

    drawCanvasBitmap();
    updateTagsList();
    if (renderingState.indexes && renderingState.indexes.length > 0) {
      updateUrlWithIndexes(renderingState.indexes);
      updateTitleAndHeader(renderingState.indexes[0]);
    } else {
      window.location.hash = '';
      document.title = 'hash-image';
      document.querySelector('h1').textContent = 'hash-image';
    }
  }
});
