// 訓練的倒數提示音（不內建音樂）。
// iPhone 規定要先按一下按鈕才能出聲，所以在按「開始訓練」時準備好。
let audioContext = null;
const STALE_BEEP_MS = 300;

/** 在使用者按按鈕時呼叫；盡量設成「跟其他音樂混著放」，不打斷 Spotify */
export function prepareSound() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch {
    // 舊版 iPhone 沒有這個設定，照預設
  }
  if (!audioContext) {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
  }
  audioContext.resume?.().catch(() => {});
}

function play(high) {
  const start = audioContext.currentTime;
  const duration = high ? 0.35 : 0.15;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = high ? 1320 : 880;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

/** 短短一聲；high = true 用高音（新的動作開始） */
export function beep(high = false) {
  if (!audioContext) return;
  if (audioContext.state === 'running') {
    play(high);
    return;
  }
  // 切到 Spotify、鎖過螢幕之後聲音會被暫停，這時先叫醒再響；
  // 叫醒太慢就不響了，免得 3、2、1 疊在一起晚響
  const requestedAt = Date.now();
  audioContext.resume?.().then(() => {
    if (audioContext.state === 'running' && Date.now() - requestedAt < STALE_BEEP_MS) play(high);
  }).catch(() => {});
}
