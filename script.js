const noteFrequencies = [
        { note: 'C', frequency: 16.35 },
        { note: 'C#', frequency: 17.32 },
        { note: 'D', frequency: 18.35 },
        { note: 'D#', frequency: 19.45 },
        { note: 'E', frequency: 20.60 },
        { note: 'F', frequency: 21.83 },
        { note: 'F#', frequency: 23.12 },
        { note: 'G', frequency: 24.50 },
        { note: 'G#', frequency: 25.96 },
        { note: 'A', frequency: 27.50 },
        { note: 'A#', frequency: 29.14 },
        { note: 'B', frequency: 30.87 }
    ];

    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let dataArray = null;
    let isRunning = false;
    let animationId = null;
    let visualizerCanvas = null;
    let visualizerCtx = null;

  
    function showPage(pageName) {
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });
        if (pageName === 'home') {
            document.getElementById('home-page').classList.add('active');
        } else if (pageName === 'tuner') {
            document.getElementById('tuner-page').classList.add('active');
            initializeVisualizer();
        } else if (pageName === 'notes') {
            alert('Notes feature coming soon!');
            showPage('home');
        } else if (pageName === 'about') {
            alert('About page coming soon!');
            showPage('home');
        }
    }


    function initializeVisualizer() {
        visualizerCanvas = document.getElementById('visualizer');
        if (visualizerCanvas) {
            visualizerCtx = visualizerCanvas.getContext('2d');
            visualizerCanvas.width = visualizerCanvas.offsetWidth;
            visualizerCanvas.height = visualizerCanvas.offsetHeight;
        }
    }

    async function startTuner() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 4096;
            analyser.smoothingTimeConstant = 0.8;
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            
            dataArray = new Float32Array(analyser.fftSize);
            
            isRunning = true;
            document.getElementById('startButton').disabled = true;
            document.getElementById('stopButton').disabled = false;
            
            detectPitch();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Please allow microphone access to use the tuner.');
        }
    }

    function stopTuner() {
        isRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        if (microphone) {
            microphone.disconnect();
            microphone = null;
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        document.getElementById('startButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
        document.getElementById('noteDisplay').textContent = '--';
        document.getElementById('frequency').textContent = '0.00';
        document.getElementById('cents').textContent = '0';
        document.getElementById('meterNeedle').style.transform = 
            'translateX(-50%) translateY(-50%) rotate(0deg)';
        if (visualizerCtx) {
            visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        }
    }

    function autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1;
        
        let correlations = new Array(MAX_SAMPLES);
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation;
            if (correlation > 0.9 && correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }
        if (bestCorrelation > 0.01 && bestOffset !== -1) {
            return sampleRate / bestOffset;
        }
        return -1;
    }

    function getClosestNote(frequency) {
        const A4 = parseFloat(document.getElementById('calibration').value);
        const A4_INDEX = 57; 
        const noteNumber = 12 * Math.log2(frequency / A4) + A4_INDEX;
        const roundedNote = Math.round(noteNumber);
        const cents = Math.round((noteNumber - roundedNote) * 100);
        const noteIndex = ((roundedNote % 12) + 12) % 12;
        const octave = Math.floor((roundedNote + 9) / 12);
        return {
            note: noteFrequencies[noteIndex].note,
            octave: octave,
            cents: cents,
            frequency: frequency
        };
    }

    function detectPitch() {
        if (!isRunning || !analyser) return;
        analyser.getFloatTimeDomainData(dataArray);
        const pitch = autoCorrelate(dataArray, audioContext.sampleRate);
        if (pitch !== -1) {
            const noteData = getClosestNote(pitch);
            document.getElementById('noteDisplay').textContent = 
                noteData.note + noteData.octave;
            document.getElementById('frequency').textContent = 
                noteData.frequency.toFixed(2);
            document.getElementById('cents').textContent = noteData.cents;
            
            const rotation = (noteData.cents / 50) * 25;
            document.getElementById('meterNeedle').style.transform = 
                `translateX(-50%) translateY(-50%) rotate(${rotation}deg)`;

            const noteDisplay = document.getElementById('noteDisplay');
            if (Math.abs(noteData.cents) < 5) {
                noteDisplay.classList.add('in-tune');
            } else {
                noteDisplay.classList.remove('in-tune');
            }
        }
        drawVisualizer();
        animationId = requestAnimationFrame(detectPitch);
    }

    function drawVisualizer() {
        if (!visualizerCtx || !analyser) return;
        const bufferLength = analyser.frequencyBinCount;
        const freqArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(freqArray);
        visualizerCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        visualizerCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i += 4) {
            const barHeight = (freqArray[i] / 255) * visualizerCanvas.height;
            const gradient = visualizerCtx.createLinearGradient(0, 0, 0, visualizerCanvas.height);
            gradient.addColorStop(0, '#ec4899');
            gradient.addColorStop(1, '#6366f1');
            visualizerCtx.fillStyle = gradient;
            visualizerCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }