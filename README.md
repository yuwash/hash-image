# hash-image
find your 3×3 bitmap identicon avatar that deterministically fits any text, using last 8 bits of CRC-32

### Why a 3×3 grid?

The bitmap is intentionally **3×3** because it offers a sweet spot between variety and practicality.  
With one pixel reserved, there are 8 “free” pixels, giving \(2^8 = 256\) distinct images that can all be shown at once in a grid without overwhelming the layout.  
Going just a little larger would explode the number of possible patterns: a 3×4 grid (12 pixels) already yields \(2^{12} = 4096\) combinations, and the next square size, 4×4 (16 pixels), jumps to \(2^{16} = 65 536\) variations — far too many to display comprehensively at a glance.

### Why is the bottom-right pixel always filled?

The bottom‑right pixel is always filled (black in the default theme) and effectively “reserved.”
The app allows changing colors, and unfilled space is rendered as transparent, so some images can become visually indistinguishable from their inverse when colors and transparency are combined.
By fixing one pixel to a constant filled state, inverse‑equivalent duplicates are eliminated.

### Why CRC‑32 and only the last 8 bits?

The project uses **CRC‑32** because it is supported directly by the fast hashing library in use, while a convenient CRC‑8 implementation was not found.
Currently only the last 8 bits of the 32‑bit checksum are used, which map neatly onto the 256 available bitmap patterns.  
This design also leaves room for future expansion: if desired later, the remaining 24 bits of the CRC‑32 output provide additional space for a larger variation of images to select from.

### Acknowledgements

This project builds on excellent open‑source work:

* [`hash-wasm`](https://github.com/Daninet/hash-wasm) – for fast CRC‑32 hashing in the browser.
* [`upng-js`](https://github.com/Hopding/upng) – for rendering PNG images.
* [`vanilla-picker`](https://github.com/Sphinxxxx/vanilla-picker) – for the color picker.
