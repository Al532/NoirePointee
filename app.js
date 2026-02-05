const bpmInput = document.getElementById('bpm');
const togglePlayButton = document.getElementById('toggle-play');
const statusLabel = document.getElementById('status');
const trackKick = document.getElementById('track-kick');
const trackHihat = document.getElementById('track-hihat');
const trackSnare = document.getElementById('track-snare');

let audioContext = null;
let masterGain = null;
let noiseBuffer = null;

let isPlaying = false;
let currentStep = 0;
let nextNoteTime = 0;
let scheduleTimer = null;

const lookahead = 25;
const scheduleAheadTime = 0.12;

const state = {
  bpm: Number(bpmInput.value),
};

const updateStatus = (text) => {
  statusLabel.textContent = text;
};

const secondsPerBeat = () => 60 / state.bpm;
const stepDuration = () => secondsPerBeat() / 4;

const ensureAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioContext.destination);
    noiseBuffer = createNoiseBuffer();
  }
};

const createNoiseBuffer = () => {
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

const playKick = (time) => {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(140, time);
  oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.16);
};

const playHihat = (time) => {
  const bufferSource = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  bufferSource.buffer = noiseBuffer;
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  bufferSource.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  bufferSource.start(time);
  bufferSource.stop(time + 0.06);
};

const playSnare = (time) => {
  const noiseSource = audioContext.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  const noiseGain = audioContext.createGain();
  noiseGain.gain.setValueAtTime(0.45, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

  const oscillator = audioContext.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(220, time);
  const toneGain = audioContext.createGain();
  toneGain.gain.setValueAtTime(0.2, time);
  toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

  noiseSource.connect(noiseGain);
  noiseGain.connect(masterGain);
  oscillator.connect(toneGain);
  toneGain.connect(masterGain);

  noiseSource.start(time);
  oscillator.start(time);
  noiseSource.stop(time + 0.13);
  oscillator.stop(time + 0.13);
};

const scheduleStep = (step, time) => {
  if (trackKick.checked && step % 4 === 0) {
    playKick(time);
  }

  if (trackHihat.checked) {
    const positionInBar = step % 16;
    if (positionInBar === 4 || positionInBar === 12) {
      playHihat(time);
    }
  }

  if (trackSnare.checked && step % 6 === 0) {
    playSnare(time);
  }
};

const scheduler = () => {
  while (nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
    scheduleStep(currentStep, nextNoteTime);
    nextNoteTime += stepDuration();
    currentStep += 1;
  }
};

const startPlayback = async () => {
  ensureAudioContext();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  currentStep = 0;
  nextNoteTime = audioContext.currentTime + 0.05;
  scheduleTimer = setInterval(scheduler, lookahead);
  isPlaying = true;
  togglePlayButton.textContent = 'Stop';
  updateStatus('Lecture en cours');
};

const stopPlayback = () => {
  clearInterval(scheduleTimer);
  scheduleTimer = null;
  isPlaying = false;
  togglePlayButton.textContent = 'Démarrer';
  updateStatus('Arrêté');
};

bpmInput.addEventListener('input', (event) => {
  state.bpm = Number(event.target.value) || 120;
});

togglePlayButton.addEventListener('click', () => {
  if (!isPlaying) {
    startPlayback();
  } else {
    stopPlayback();
  }
});

window.addEventListener('beforeunload', () => {
  if (audioContext) {
    audioContext.close();
  }
});
