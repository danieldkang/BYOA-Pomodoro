(() => {
    // --- State ---
    const state = {
        mode: 'work',           // 'work' | 'shortBreak' | 'longBreak'
        timeLeft: 25 * 60,
        totalTime: 25 * 60,
        running: false,
        session: 1,
        timerId: null,
    };

    const settings = {
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        sessions: 4,
        autoBreak: true,
        autoWork: false,
        sound: true,
    };

    // --- DOM ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const timerText = $('#timer-text');
    const timerLabel = $('#timer-label');
    const progressCircle = $('.progress-ring__circle');
    const btnStart = $('#btn-start');
    const btnReset = $('#btn-reset');
    const btnSkip = $('#btn-skip');
    const iconPlay = $('#icon-play');
    const iconPause = $('#icon-pause');
    const sessionCount = $('#session-count');
    const sessionDots = $('#session-dots');
    const settingsPanel = $('#settings-panel');
    const originalTitle = document.title;

    const CIRCUMFERENCE = 2 * Math.PI * 120; // r=120

    // --- Audio (Web Audio API) ---
    let audioCtx = null;

    function getAudioCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playNotificationSound() {
        if (!settings.sound) return;
        try {
            const ctx = getAudioCtx();
            const now = ctx.currentTime;

            // Play a pleasant chime sequence
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, now + i * 0.15);
                gain.gain.linearRampToValueAtTime(0.3, now + i * 0.15 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.4);
            });
        } catch (_) {
            // Audio not available
        }
    }

    function vibrate() {
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
    }

    // --- Progress Ring ---
    function setProgress(fraction) {
        const offset = CIRCUMFERENCE * fraction;
        progressCircle.style.strokeDasharray = CIRCUMFERENCE;
        progressCircle.style.strokeDashoffset = offset;
    }

    // --- Theme ---
    const themes = {
        work: { accent: '#e74c3c', bg: '#1a1a2e', label: 'FOCUS' },
        shortBreak: { accent: '#27ae60', bg: '#0f2a1a', label: 'SHORT BREAK' },
        longBreak: { accent: '#2980b9', bg: '#0f1a2a', label: 'LONG BREAK' },
    };

    function applyTheme(mode) {
        const theme = themes[mode];
        document.documentElement.style.setProperty('--accent', theme.accent);
        document.documentElement.style.setProperty('--bg', theme.bg);
        document.querySelector('meta[name="theme-color"]').content = theme.bg;
        timerLabel.textContent = theme.label;
    }

    // --- Display ---
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function updateDisplay() {
        timerText.textContent = formatTime(state.timeLeft);
        const elapsed = 1 - (state.timeLeft / state.totalTime);
        setProgress(CIRCUMFERENCE * (1 - elapsed) / CIRCUMFERENCE);

        if (state.running) {
            document.title = `(${formatTime(state.timeLeft)}) ${themes[state.mode].label}`;
        } else {
            document.title = originalTitle;
        }
    }

    function updatePlayPauseIcon() {
        iconPlay.style.display = state.running ? 'none' : 'block';
        iconPause.style.display = state.running ? 'block' : 'none';
    }

    function updateSessionDots() {
        sessionCount.textContent = `Session ${state.session} of ${settings.sessions}`;
        sessionDots.innerHTML = '';
        for (let i = 1; i <= settings.sessions; i++) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            if (i < state.session) dot.classList.add('completed');
            if (i === state.session) dot.classList.add('active');
            sessionDots.appendChild(dot);
        }
    }

    function updateModeTabs() {
        $$('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === state.mode);
        });
    }

    // --- Timer Logic ---
    function setMode(mode, autoStart = false) {
        stopTimer();
        state.mode = mode;
        const duration = settings[mode] * 60;
        state.timeLeft = duration;
        state.totalTime = duration;
        applyTheme(mode);
        updateModeTabs();
        updateDisplay();
        setProgress(0);
        if (autoStart) {
            startTimer();
        }
    }

    function startTimer() {
        if (state.running) return;
        state.running = true;
        updatePlayPauseIcon();

        // Unlock audio on user gesture
        try { getAudioCtx().resume(); } catch (_) {}

        state.timerId = setInterval(() => {
            state.timeLeft--;
            updateDisplay();

            if (state.timeLeft <= 0) {
                onTimerComplete();
            }
        }, 1000);
    }

    function stopTimer() {
        state.running = false;
        if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
        }
        updatePlayPauseIcon();
        document.title = originalTitle;
    }

    function resetTimer() {
        stopTimer();
        const duration = settings[state.mode] * 60;
        state.timeLeft = duration;
        state.totalTime = duration;
        updateDisplay();
        setProgress(0);
    }

    function onTimerComplete() {
        stopTimer();
        playNotificationSound();
        vibrate();

        // Pulse animation
        const display = $('.timer-display');
        display.classList.add('pulse');
        setTimeout(() => display.classList.remove('pulse'), 2000);

        // Browser notification
        if (Notification.permission === 'granted') {
            const msg = state.mode === 'work'
                ? 'Focus session complete! Time for a break.'
                : 'Break is over! Ready to focus?';
            new Notification('Pomodoro', { body: msg, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">🍅</text></svg>' });
        }

        if (state.mode === 'work') {
            // Advance session
            if (state.session >= settings.sessions) {
                state.session = 1;
                updateSessionDots();
                setMode('longBreak', settings.autoBreak);
            } else {
                state.session++;
                updateSessionDots();
                setMode('shortBreak', settings.autoBreak);
            }
        } else {
            // Break finished → back to work
            updateSessionDots();
            setMode('work', settings.autoWork);
        }
    }

    function skipToNext() {
        if (state.mode === 'work') {
            if (state.session >= settings.sessions) {
                state.session = 1;
                updateSessionDots();
                setMode('longBreak');
            } else {
                state.session++;
                updateSessionDots();
                setMode('shortBreak');
            }
        } else {
            setMode('work');
        }
    }

    // --- Event Listeners ---
    btnStart.addEventListener('click', () => {
        if (state.running) {
            stopTimer();
        } else {
            startTimer();
        }
    });

    btnReset.addEventListener('click', resetTimer);
    btnSkip.addEventListener('click', skipToNext);

    $$('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.dataset.mode !== state.mode) {
                setMode(tab.dataset.mode);
            }
        });
    });

    // --- Settings ---
    function openSettings() {
        settingsPanel.classList.add('open');
    }

    function closeSettings() {
        settingsPanel.classList.remove('open');
        // Apply any setting changes if timer is not running
        if (!state.running) {
            resetTimer();
        }
    }

    $('#settings-toggle').addEventListener('click', openSettings);
    $('#settings-close').addEventListener('click', closeSettings);
    $('#settings-backdrop').addEventListener('click', closeSettings);

    $$('.stepper-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.setting;
            const dir = parseInt(btn.dataset.dir, 10);
            const limits = {
                work: [1, 90],
                shortBreak: [1, 30],
                longBreak: [1, 60],
                sessions: [1, 10],
            };
            const [min, max] = limits[key];
            settings[key] = Math.min(max, Math.max(min, settings[key] + dir));
            $(`#setting-${key}`).textContent = settings[key];
            saveSettings();
        });
    });

    $$('.toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const pressed = toggle.getAttribute('aria-pressed') === 'true';
            toggle.setAttribute('aria-pressed', !pressed);

            if (toggle.id === 'toggle-autoBreak') settings.autoBreak = !pressed;
            if (toggle.id === 'toggle-autoWork') settings.autoWork = !pressed;
            if (toggle.id === 'toggle-sound') settings.sound = !pressed;
            saveSettings();
        });
    });

    // --- Persistence ---
    function saveSettings() {
        try {
            localStorage.setItem('pomodoro-settings', JSON.stringify(settings));
        } catch (_) {}
    }

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('pomodoro-settings'));
            if (saved) {
                Object.assign(settings, saved);
                $(`#setting-work`).textContent = settings.work;
                $(`#setting-shortBreak`).textContent = settings.shortBreak;
                $(`#setting-longBreak`).textContent = settings.longBreak;
                $(`#setting-sessions`).textContent = settings.sessions;
                $('#toggle-autoBreak').setAttribute('aria-pressed', settings.autoBreak);
                $('#toggle-autoWork').setAttribute('aria-pressed', settings.autoWork);
                $('#toggle-sound').setAttribute('aria-pressed', settings.sound);
            }
        } catch (_) {}
    }

    // --- Notifications Permission ---
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            // Request on first user interaction
            const handler = () => {
                Notification.requestPermission();
                document.removeEventListener('click', handler);
            };
            document.addEventListener('click', handler);
        }
    }

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
        if (settingsPanel.classList.contains('open')) {
            if (e.key === 'Escape') closeSettings();
            return;
        }
        if (e.code === 'Space') {
            e.preventDefault();
            state.running ? stopTimer() : startTimer();
        } else if (e.key === 'r' || e.key === 'R') {
            resetTimer();
        } else if (e.key === 's' || e.key === 'S') {
            skipToNext();
        }
    });

    // --- Init ---
    loadSettings();
    setMode('work');
    updateSessionDots();
    requestNotificationPermission();
})();
