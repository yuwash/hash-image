// Function to calculate hash info from text
function getHashInfo(text, crc32Instance) {
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

// Export functions for use in other modules
export { getHashInfo, getPixelArray };
