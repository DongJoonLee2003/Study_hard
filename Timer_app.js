// DOM 엘리먼트 선택
const timeDisplay = document.getElementById('time-display');
const timerStatus = document.getElementById('timer-status');
const ringCircle = document.querySelector('.progress-ring-circle');
const timerContainer = document.querySelector('.timer-container');

// 컨트롤 및 입력 필드 엘리먼트
const btnToggle = document.getElementById('btn-toggle');
const btnToggleText = document.getElementById('btn-toggle-text');
const btnReset = document.getElementById('btn-reset');
const btnApply = document.getElementById('btn-apply');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

const inputMinutes = document.getElementById('input-minutes');
const inputSeconds = document.getElementById('input-seconds');
const presetButtons = document.querySelectorAll('.btn-preset');

// 원형 프로그레스 바 계산을 위한 상수
const circleRadius = 120;
const circumference = 2 * Math.PI * circleRadius; // 약 753.98

// SVG 원형 프로그레스 바 초기 설정
ringCircle.style.strokeDasharray = circumference;
ringCircle.style.strokeDashoffset = 0;

// 타이머 상태 관리 변수
let totalDurationSeconds = 300; // 기본값: 5분
let secondsRemaining = totalDurationSeconds;
let timerInterval = null;
let isRunning = false;
let isAlarmState = false;
let alarmInterval = null;
let endTime = null;

// Web Audio API 컨텍스트
let audioCtx = null;

/**
 * 타이머가 만료되었을 때 Web Audio API를 활용해 맑은 음색의 알림음(비프음)을 재생합니다.
 */
function playBeep() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        
        // 맑은 듀얼 비프음 연출
        for (let i = 0; i < 2; i++) {
            const timeOffset = i * 0.25;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'sine';
            // 보다 편안한 톤을 위해 각 비프음의 주파수를 교차 지정
            osc.frequency.setValueAtTime(i === 0 ? 880 : 1200, now + timeOffset);
            
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.2);
            
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.22);
        }
    } catch (e) {
        console.warn('Web Audio error:', e);
    }
}

/**
 * 초 단위의 시간을 MM:SS 형식의 문자열로 변환합니다.
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 타이머 화면(텍스트 및 원형 프로그레스 바)을 업데이트합니다.
 */
function updateDisplay() {
    // 1. 남은 시간 텍스트 업데이트
    timeDisplay.textContent = formatTime(secondsRemaining);

    // 2. SVG 원형 프로그레스 바 진행 상태 업데이트
    const ratio = totalDurationSeconds > 0 ? (secondsRemaining / totalDurationSeconds) : 0;
    const offset = circumference - (ratio * circumference);
    ringCircle.style.strokeDashoffset = offset;
}

/**
 * 타이머의 기준 지속 시간을 새로 설정합니다.
 */
function setTimerDuration(seconds) {
    stopTimer();
    clearAlarm();
    totalDurationSeconds = seconds;
    secondsRemaining = seconds;
    
    // 커스텀 분/초 입력란에 동기화
    inputMinutes.value = Math.floor(seconds / 60);
    inputSeconds.value = seconds % 60;

    updateDisplay();
    setStatusText('READY');
}

/**
 * 타이머의 상태 문구(READY, RUNNING, PAUSED 등)를 지정하고 CSS 클래스를 업데이트합니다.
 */
function setStatusText(status) {
    timerStatus.textContent = status;
    timerStatus.className = ''; // 기존 스타일 클래스 제거
    
    if (status === 'RUNNING') {
        timerStatus.classList.add('status-running');
    } else if (status === 'PAUSED') {
        timerStatus.classList.add('status-paused');
    } else if (status === 'TIME\'S UP!') {
        timerStatus.classList.add('status-alarm');
    }
}

/**
 * 타이머를 시작하고 카운트다운을 진행합니다.
 */
function startTimer() {
    if (secondsRemaining <= 0) return;
    
    // 사용자 상호작용 발생 시 오디오 컨텍스트 활성화
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    isRunning = true;
    setStatusText('RUNNING');
    
    // 재생/일시정지 버튼 상태 제어
    btnToggleText.textContent = 'Pause';
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    btnToggle.classList.remove('btn-paused-state');
    
    // 백그라운드 탭 지연(Drift) 현상을 방지하기 위해 절대 시간(Timestamp) 기준으로 계산
    endTime = Date.now() + secondsRemaining * 1000;
    
    timerInterval = setInterval(() => {
        const remainingMs = endTime - Date.now();
        secondsRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
        
        updateDisplay();
        
        if (secondsRemaining <= 0) {
            triggerAlarm();
        }
    }, 100);
}

/**
 * 진행 중인 타이머를 일시정지합니다.
 */
function pauseTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    setStatusText('PAUSED');
    
    btnToggleText.textContent = 'Resume';
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    btnToggle.classList.add('btn-paused-state');
}

/**
 * 재생/일시정지 상태를 토글하거나 알림이 활성화되어 있다면 리셋시킵니다.
 */
function toggleTimer() {
    if (isAlarmState) {
        resetTimer();
        return;
    }
    
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

/**
 * 타이머 시간을 초기화하지 않고 카운트다운 진행만 정지시킵니다.
 */
function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    btnToggleText.textContent = 'Start';
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    btnToggle.classList.remove('btn-paused-state');
}

/**
 * 타이머를 설정했던 처음 총 시간으로 되돌립니다.
 */
function resetTimer() {
    stopTimer();
    clearAlarm();
    secondsRemaining = totalDurationSeconds;
    updateDisplay();
    setStatusText('READY');
}

/**
 * 타이머 시간이 0에 다다르면 시각/청각적 알림을 작동시킵니다.
 */
function triggerAlarm() {
    stopTimer();
    isAlarmState = true;
    setStatusText("TIME'S UP!");
    
    btnToggleText.textContent = 'OK';
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
    
    timerContainer.classList.add('alarm-active');
    
    // 알림 동작 루프: 1.5초마다 맑은 알림음 재생
    playBeep();
    alarmInterval = setInterval(playBeep, 1500);
}

/**
 * 진행 중인 경보 상태 스타일링과 오디오 알림 루프를 종료시킵니다.
 */
function clearAlarm() {
    isAlarmState = false;
    clearInterval(alarmInterval);
    timerContainer.classList.remove('alarm-active');
}

// 프리셋 버튼 클릭 이벤트 리스너
presetButtons.forEach(button => {
    button.addEventListener('click', () => {
        // 모든 프리셋 버튼의 활성화 상태 제거
        presetButtons.forEach(btn => btn.classList.remove('active'));
        
        // 현재 클릭한 버튼에 active 클래스 추가
        button.classList.add('active');
        
        const seconds = parseInt(button.getAttribute('data-seconds'), 10);
        setTimerDuration(seconds);
        
        // 파스타 프리셋일 경우 곧바로 타이머 시작
        if (button.classList.contains('btn-pasta')) {
            startTimer();
        }
    });
});

// 시간 적용(Apply Time) 버튼 클릭 이벤트 리스너
btnApply.addEventListener('click', () => {
    const mins = Math.max(0, parseInt(inputMinutes.value, 10) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(inputSeconds.value, 10) || 0));
    
    const newTotalSeconds = (mins * 60) + secs;
    
    if (newTotalSeconds > 0) {
        // 선택되어 있던 기존 프리셋의 active 하이라이트 제거
        presetButtons.forEach(btn => btn.classList.remove('active'));
        setTimerDuration(newTotalSeconds);
    }
});

// 컨트롤 버튼 클릭 이벤트 리스너
btnToggle.addEventListener('click', toggleTimer);
btnReset.addEventListener('click', resetTimer);

// 커스텀 입력창 값 유효성 검사
inputMinutes.addEventListener('change', () => {
    if (inputMinutes.value < 0) inputMinutes.value = 0;
});
inputSeconds.addEventListener('change', () => {
    let val = parseInt(inputSeconds.value, 10);
    if (val < 0) inputSeconds.value = 0;
    if (val > 59) inputSeconds.value = 59;
});

// 초기 페이지 렌더링 시 타이머 화면 셋업
updateDisplay();
setStatusText('READY');
// 5분 프리셋을 기본값으로 활성화 하이라이트 지정
document.querySelector('.btn-preset[data-seconds="300"]').classList.add('active');

