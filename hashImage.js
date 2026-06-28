// Function to calculate hash info from text
function getHashInfo(text, hasherInstance) {
  if (!hasherInstance) {
    return null;
  }
  
  hasherInstance.init();
  const uint8Array = new TextEncoder().encode(text);
  hasherInstance.update(uint8Array);
  const hash = hasherInstance.digest('hex');

  const lastTwo = hash.slice(-2);
  const imageNumber = parseInt(lastTwo, 16);

  const base = hash.slice(0, -2);
  const last = hash.slice(-2);
  const index = parseInt(last, 16);

  return {
    hash: hash,
    index: index,
    imageNumber: imageNumber,
    base: base,
    last: last
  };
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

function getPixelOpacityMap(scaleUp, fillFrequencyH, fillFrequencyV) {
  const map = [];
  for (let j = 0; j < scaleUp; j++) {
    const row = [];
    const yRel = j / scaleUp;
    const opacityV = fillFrequencyV > 0
      ? (-Math.cos(2 * Math.PI * fillFrequencyV * yRel) + 1) / 2
      : 1;

    for (let i = 0; i < scaleUp; i++) {
      const xRel = i / scaleUp;
      const opacityH = fillFrequencyH > 0
        ? (-Math.cos(2 * Math.PI * fillFrequencyH * xRel) + 1) / 2
        : 1;

      row.push(opacityH * opacityV);
    }
    map.push(row);
  }
  return map;
}

// Export functions for use in other modules
export { getHashInfo, getPixelArray, getPixelOpacityMap };
