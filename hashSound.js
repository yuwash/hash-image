/**
 * Generates audio for a hash pattern using Tone.js offline rendering.
 * The audio consists of 9 beats of 1/3 second each (total 3 seconds).
 * Approximates a DTMF tone for each 1-bit by layering a high frequency
 * (C6, D6, F6 based on index % 3) and a low frequency (F4, G4, A#4 based on index / 3).
 * 
 * @param {number[]} bits - Array of 9 bits (0 or 1) representing the hash pixels.
 * @returns {Promise<string>} - Resolves to the local URL of the generated WAV audio.
 */
export async function generateHashAudio(bitsOrTracks, trillFrequency = 0, equalizerFrequency = 0) {
  // Ensure Tone.js context is initialized (required by modern browser security policies)
  await Tone.start();

  const highNotes = ["C6", "D6", "F6"];
  const lowNotes = ["F4", "G4", "A#4"];

  // Normalize inputs to a tracks array
  let tracks = [];
  if (Array.isArray(bitsOrTracks)) {
    if (bitsOrTracks.length > 0 && typeof bitsOrTracks[0] === 'object' && bitsOrTracks[0] !== null) {
      tracks = bitsOrTracks;
    } else {
      tracks = [{ bits: bitsOrTracks, trillFrequency, equalizerFrequency }];
    }
  } else {
    return null;
  }

  // Render 3 seconds of audio offline (9 beats * 1/3s = 3s)
  const renderedBuffer = await Tone.Offline(() => {
    tracks.forEach((track) => {
      const { bits, trillFrequency = 0, equalizerFrequency = 0 } = track;
      const hasTrill = trillFrequency !== 0;
      const hasEq = equalizerFrequency !== 0;
      const envelopeSettings = hasTrill
        ? { attack: 0, decay: 0, sustain: 1, release: 0 }
        : { attack: 0.02, decay: 0.08, sustain: 0.6, release: 0.1 };

      // Create Gain nodes to modulate amplitude
      const highGain = new Tone.Gain(1).toDestination();
      const lowGain = new Tone.Gain(1).toDestination();

      const N = 11;
      const highSynths = [];
      const lowSynths = [];

      // Create two synths (high and low) to generate polyphonic DTMF-like dual tones
      // Set volume to -6 dB each to prevent clipping when combined
      // In hasEq mode we need to reduce it further:
      const volume = hasEq ? -6 - 20 * Math.log10(N) : -6;

      if (hasEq) {
        // Create a bank of N synths for high and low notes
        for (let k = 0; k < N; k++) {
          const x = k / (N - 1);
          const amp = (-Math.cos(2 * Math.PI * equalizerFrequency * x) + 1) / 2;

          const highSubGain = new Tone.Gain(amp).connect(highGain);
          const highSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: envelopeSettings,
            volume
          }).connect(highSubGain);
          highSynths.push(highSynth);

          const lowSubGain = new Tone.Gain(amp).connect(lowGain);
          const lowSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: envelopeSettings,
            volume
          }).connect(lowSubGain);
          lowSynths.push(lowSynth);
        }
      } else {
        const highSynth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: envelopeSettings,
          volume
        }).connect(highGain);
        highSynths.push(highSynth);

        const lowSynth = new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: envelopeSettings,
          volume
        }).connect(lowGain);
        lowSynths.push(lowSynth);
      }

      // Compute the curve if we have a trill
      let curve = null;
      if (hasTrill) {
        const numPoints = 100;
        curve = new Float32Array(numPoints);
        for (let step = 0; step < numPoints; step++) {
          const tRel = step / (numPoints - 1);
          curve[step] = (-Math.cos(2 * Math.PI * trillFrequency * tRel) + 1) / 2;
        }
      }

      bits.forEach((bit, i) => {
        if (bit === 1) {
          const highNote = highNotes[i % 3];
          const lowNote = lowNotes[Math.floor(i / 3)];
          const startTime = i / 3;
          const duration = 0.25;

          if (hasTrill) {
            highGain.gain.setValueCurveAtTime(curve, startTime, duration);
            lowGain.gain.setValueCurveAtTime(curve, startTime, duration);
          }

          if (hasEq) {
            const highCenter = Tone.Frequency(highNote).toFrequency();
            const lowCenter = Tone.Frequency(lowNote).toFrequency();

            for (let k = 0; k < N; k++) {
              const semiOffset = -1.0 + 2.0 * (k / (N - 1));
              const highFreq = highCenter * Math.pow(2, semiOffset / 12);
              const lowFreq = lowCenter * Math.pow(2, semiOffset / 12);

              highSynths[k].triggerAttackRelease(highFreq, duration, startTime);
              lowSynths[k].triggerAttackRelease(lowFreq, duration, startTime);
            }
          } else {
            // Scheduled precisely at i/3 seconds
            highSynths[0].triggerAttackRelease(highNote, duration, startTime);
            lowSynths[0].triggerAttackRelease(lowNote, duration, startTime);
          }
        }
      });
    });
  }, 3);

  // Convert the rendered audio buffer into a WAV ArrayBuffer using the CDN library
  const wavArrayBuffer = window.audioBufferToWav(renderedBuffer);

  // Create a Blob from the WAV data and generate a temporary object URL
  const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(wavBlob);
}
