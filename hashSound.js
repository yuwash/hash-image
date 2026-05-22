/**
 * Generates audio for a hash pattern using Tone.js offline rendering.
 * The audio consists of 9 beats of 1/3 second each (total 3 seconds).
 * Approximates a DTMF tone for each 1-bit by layering a high frequency
 * (C6, D6, F6 based on index % 3) and a low frequency (F4, G4, A#4 based on index / 3).
 * 
 * @param {number[]} bits - Array of 9 bits (0 or 1) representing the hash pixels.
 * @returns {Promise<string>} - Resolves to the local URL of the generated WAV audio.
 */
export async function generateHashAudio(bits) {
  // Ensure Tone.js context is initialized (required by modern browser security policies)
  await Tone.start();

  const highNotes = ["C6", "D6", "F6"];
  const lowNotes = ["F4", "G4", "A#4"];

  // Render 3 seconds of audio offline (9 beats * 1/3s = 3s)
  const renderedBuffer = await Tone.Offline(() => {
    // Create two synths (high and low) to generate polyphonic DTMF-like dual tones
    // Set volume to -6 dB each to prevent clipping when combined
    const highSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.08, sustain: 0.6, release: 0.1 },
      volume: -6
    }).toDestination();

    const lowSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.08, sustain: 0.6, release: 0.1 },
      volume: -6
    }).toDestination();

    bits.forEach((bit, i) => {
      if (bit === 1) {
        const highNote = highNotes[i % 3];
        const lowNote = lowNotes[Math.floor(i / 3)];

        // Scheduled precisely at i/3 seconds
        highSynth.triggerAttackRelease(highNote, 0.25, i / 3);
        lowSynth.triggerAttackRelease(lowNote, 0.25, i / 3);
      }
    });
  }, 3);

  // Convert the rendered audio buffer into a WAV ArrayBuffer using the CDN library
  const wavArrayBuffer = window.audioBufferToWav(renderedBuffer);

  // Create a Blob from the WAV data and generate a temporary object URL
  const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(wavBlob);
}
