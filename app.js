const exercises = Array.from(document.querySelectorAll('.exercise')).map((section) => {
  const bpmInput = section.querySelector('[data-role="bpm"]');
  const bpmValue = section.querySelector('[data-role="bpm-value"]');
  const togglePlayButton = section.querySelector('[data-role="toggle"]');
  const statusLabel = section.querySelector('[data-role="status"]');
  const tracks = {
    crash: section.querySelector('[data-track="crash"]'),
    kick: section.querySelector('[data-track="kick"]'),
    hihat: section.querySelector('[data-track="hihat"]'),
    snare: section.querySelector('[data-track="snare"]'),
    beat: section.querySelector('[data-track="beat"]'),
    metronome: section.querySelector('[data-track="metronome"]'),
  };
  const metronomeOptions = {
    placement: section.querySelector('[data-role="placement"]'),
    beat: section.querySelector('[data-role="beat"]'),
    interval: section.querySelector('[data-role="interval"]'),
  };

  return {
    section,
    key: section.dataset.exercise,
    bpmInput,
    bpmValue,
    togglePlayButton,
    statusLabel,
    tracks,
    metronomeOptions,
    isPlaying: false,
    currentStep: 0,
    nextNoteTime: 0,
    scheduleTimer: null,
    state: {
      bpm: Number(bpmInput.value),
      metronome: {
        lastMeasureIndex: null,
      },
    },
  };
});

const tabs = Array.from(document.querySelectorAll('.tab'));

let audioContext = null;
let masterGain = null;
let noiseBuffer = null;

const lookahead = 25;
const scheduleAheadTime = 0.12;

const updateStatus = (exercise, text) => {
  exercise.statusLabel.textContent = text;
};

const secondsPerBeat = (exercise) => 60 / exercise.state.bpm;
const stepDuration = (exercise) => secondsPerBeat(exercise) / 4;

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
  gain.gain.setValueAtTime(0.4, time);
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
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
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
  noiseGain.gain.setValueAtTime(0.35, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

  const oscillator = audioContext.createOscillator();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(220, time);
  const toneGain = audioContext.createGain();
  toneGain.gain.setValueAtTime(0.16, time);
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

const playCrash = (time) => {
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = noiseBuffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 1);
  bufferSource.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  bufferSource.start(time);
  bufferSource.stop(time + 0.65);
};

const playWoodblock = (time) => {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(950, time);
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 8;
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.14);
};

const scheduleNoire = (exercise, step, time) => {
  if (exercise.tracks.kick?.checked && step % 4 === 0) {
    playKick(time);
  }

  if (exercise.tracks.crash?.checked && step % 16 === 0) {
    playCrash(time);
  }

  if (exercise.tracks.hihat?.checked) {
    const positionInBar = step % 16;
    if (positionInBar === 4 || positionInBar === 12) {
      playHihat(time);
    }
  }

  if (exercise.tracks.snare?.checked && step % 6 === 0) {
    playSnare(time);
  }
};

const scheduleMetronome = (exercise, step, time) => {
  if (exercise.tracks.beat?.checked) {
    if (step % 4 === 0) {
      playKick(time);
    }

    const positionInBar = step % 16;
    if (positionInBar === 4 || positionInBar === 12) {
      playHihat(time);
    }
  }

  if (exercise.tracks.snare?.checked && step % 6 === 0) {
    playSnare(time);
  }

  if (step % 4 === 0) {
    const beatSelection = Number(exercise.metronomeOptions.beat?.value || 1) - 1;
    const interval = Number(exercise.metronomeOptions.interval?.value || 1);
    const measureIndex = Math.floor(step / 16);
    const beatIndex = Math.floor((step % 16) / 4);
    if (exercise.state.metronome.lastMeasureIndex === null) {
      exercise.state.metronome.lastMeasureIndex = measureIndex - interval;
    }
    if (
      beatIndex === beatSelection
      && measureIndex - exercise.state.metronome.lastMeasureIndex >= interval
    ) {
      const placement = exercise.metronomeOptions.placement?.value || 'debut';
      const beatLength = secondsPerBeat(exercise);
      let offset = 0;
      if (placement === 'binaire') {
        offset = beatLength / 2;
      } else if (placement === 'ternaire') {
        offset = (beatLength * 2) / 3;
      }
      playWoodblock(time + offset);
      exercise.state.metronome.lastMeasureIndex = measureIndex;
    }
  }
};

const scheduleStep = (exercise, step, time) => {
  if (exercise.key === 'noire') {
    scheduleNoire(exercise, step, time);
  } else {
    scheduleMetronome(exercise, step, time);
  }
};

const scheduler = (exercise) => {
  while (exercise.nextNoteTime < audioContext.currentTime + scheduleAheadTime) {
    scheduleStep(exercise, exercise.currentStep, exercise.nextNoteTime);
    exercise.nextNoteTime += stepDuration(exercise);
    exercise.currentStep += 1;
  }
};

const startPlayback = async (exercise) => {
  ensureAudioContext();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  exercise.currentStep = 0;
  exercise.nextNoteTime = audioContext.currentTime + 0.05;
  exercise.state.metronome.lastMeasureIndex = null;
  exercise.scheduleTimer = setInterval(() => scheduler(exercise), lookahead);
  exercise.isPlaying = true;
  exercise.togglePlayButton.textContent = 'Stop';
  updateStatus(exercise, 'Lecture en cours');
};

const stopPlayback = (exercise) => {
  if (exercise.scheduleTimer) {
    clearInterval(exercise.scheduleTimer);
  }
  exercise.scheduleTimer = null;
  exercise.isPlaying = false;
  exercise.togglePlayButton.textContent = 'Démarrer';
  updateStatus(exercise, 'Arrêté');
};

const stopAll = () => {
  exercises.forEach((exercise) => {
    if (exercise.isPlaying) {
      stopPlayback(exercise);
    }
  });
};

const setActiveExercise = (targetKey, { shouldPersist = true } = {}) => {
  stopAll();
  exercises.forEach((exercise) => {
    const isActive = exercise.key === targetKey;
    exercise.section.classList.toggle('is-active', isActive);
    exercise.section.setAttribute('aria-hidden', String(!isActive));
  });
  tabs.forEach((tab) => {
    const isActive = tab.dataset.target === targetKey;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  if (shouldPersist) {
    localStorage.setItem('lastExercise', targetKey);
  }
};

exercises.forEach((exercise) => {
  exercise.bpmValue.textContent = String(exercise.state.bpm);

  exercise.bpmInput.addEventListener('input', (event) => {
    exercise.state.bpm = Number(event.target.value) || 120;
    exercise.bpmValue.textContent = String(exercise.state.bpm);
  });

  exercise.togglePlayButton.addEventListener('click', () => {
    if (!exercise.isPlaying) {
      startPlayback(exercise);
    } else {
      stopPlayback(exercise);
    }
  });
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    setActiveExercise(tab.dataset.target);
  });
});

const storedExercise = localStorage.getItem('lastExercise');
const availableKeys = exercises.map((exercise) => exercise.key);
const initialKey = availableKeys.includes(storedExercise)
  ? storedExercise
  : tabs.find((tab) => tab.classList.contains('is-active'))?.dataset.target;

if (initialKey) {
  setActiveExercise(initialKey, { shouldPersist: false });
}

window.addEventListener('beforeunload', () => {
  if (audioContext) {
    audioContext.close();
  }
});
