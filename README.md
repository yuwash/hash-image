# hash-image
find your 3×3 bitmap identicon avatar that deterministically fits any text, using hash methods

### How it Works

This application generates a unique 3x3 pixel bitmap image based on the hash of input text. Each pair of hexadecimal digits from the hash corresponds to one of the 9 pixels in the bitmap, determining its color and opacity.

### Hashing Methods

*   **CRC-32**: Uses the full 32-bit CRC-32 hash, resulting in 4 layers (each represented by 2 hex digits, mapping to a 0-255 index).
*   **SHA-256**: Uses the full 256-bit SHA-256 hash, resulting in 32 layers (each represented by 2 hex digits, mapping to a 0-255 index).

### Image Generation

The generated image is a composite of these layers. The order of layers does not affect the final visual output due to additive blending (alpha channel being summed while the color is the same for all layers).

*   **CRC-32**: With 4 layers, each mapping to 256 possible values, the theoretical number of unique combinations is \(C(256, 4) = 174,792,640\). However, the visual distinctiveness is limited by the 3x3 grid.
*   **SHA-256**: With 32 layers, the theoretical number of combinations is even (vastly) larger. Visually, however, layering many images can lead to results that are difficult to distinguish at the moment (see next section).

### Future Work: Enhancing Visual Distinction

To better utilize the large number of possible hash outputs and create more visually distinct images, future work could involve **Frequency Modulation** (you can already use set it between 1 and 8 in the UI, but it is currently applied to all layers). Utilizing the horizontal and vertical frequency controls for each layer. With 6x6 = 36 possible frequency settings (keeping maximum frequency as low as possible allows for more distinguishable results esp. at low resolution), this could lead to more distinguishable images with 32 layers of SHA-256.

### Why a 3x3 grid?

The bitmap is intentionally **3x3** because it offers a sweet spot between variety and practicality. With one pixel reserved (see next section), there are 8 “free” pixels, giving \(2^8 = 256\) distinct base images. This allows for a manageable grid display of all possible base patterns.

### Why is the bottom-right pixel always filled?

The bottom-right pixel is always filled (black in the default theme) and effectively “reserved.” This helps eliminate visually identical inverse patterns when colors and transparency are applied, ensuring each generated image is unique.

### Acknowledgements

This project builds on excellent open-source work:

*   [`hash-wasm`](https://github.com/Daninet/hash-wasm) – for fast hashing (CRC-32, SHA-256) in the browser.
*   [`upng-js`](https://github.com/Hopding/upng) – for rendering PNG images.
*   [`vanilla-picker`](https://github.com/Sphinxxxx/vanilla-picker) – for the color picker.
