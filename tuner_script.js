const noteElem = document.getElementById("note");
const freqElem = document.getElementById("freq");

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function startTuner() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const audioContext = new (window.AudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      function updatePitch() {
        analyser.getFloatTimeDomainData(buffer);
        const pitch = autoCorrelate(buffer, audioContext.sampleRate);

        if (pitch !== -1) {
          const note = frequencyToNote(pitch);
            const octave = Math.floor(note / 12) - 1;
            noteElem.textContent = noteStrings[note % 12] + octave;
          freqElem.textContent = pitch.toFixed(2) + " Hz";

            const hand = document.getElementById("hand");
            const minFreq = 50, maxFreq = 2000;
            let angle = ((pitch - minFreq) / (maxFreq - minFreq)) * 360;
            angle = Math.max(0, Math.min(360, angle));
            hand.setAttribute("transform", `rotate(${angle} 100 100)`);
        }

        requestAnimationFrame(updatePitch);
      }

      updatePitch();

     
        const markersGroup = document.getElementById("cent-markers");
        if (markersGroup && markersGroup.childNodes.length === 0) {
          for (let i = 0; i < 100; i++) {
            const angle = (i / 100) * 2 * Math.PI;
            const x1 = 100 + 80 * Math.sin(angle);
            const y1 = 100 - 80 * Math.cos(angle);
            const x2 = 100 + 90 * Math.sin(angle);
            const y2 = 100 - 90 * Math.cos(angle);
            const marker = document.createElementNS("http://www.w3.org/2000/svg", "line");
            marker.setAttribute("x1", x1);
            marker.setAttribute("y1", y1);
            marker.setAttribute("x2", x2);
            marker.setAttribute("y2", y2);
            marker.setAttribute("stroke", i % 10 === 0 ? "#333" : "#bbb");
            marker.setAttribute("stroke-width", i % 10 === 0 ? "3" : "1");
            markersGroup.appendChild(marker);
          }
        }
    })
    .catch(err => console.error("Microphone error:", err));
}


function autoCorrelate(buffer, sampleRate) {
  let SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; 

  let r1 = 0, r2 = SIZE - 1, threshold = 0.2;
  for (let i = 0; i < SIZE/2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE/2; i++) {
    if (Math.abs(buffer[SIZE-i]) < threshold) { r2 = SIZE-i; break; }
  }

  buffer = buffer.slice(r1, r2);
  SIZE = buffer.length;

  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buffer[j] * buffer[j+i];
    }
  }

  let d = 0; 
  while (c[d] > c[d+1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }

  let T0 = maxpos;

  return sampleRate / T0;
}


function frequencyToNote(freq) {
  const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
  return Math.round(noteNum) + 69; 
}

XMLDocument