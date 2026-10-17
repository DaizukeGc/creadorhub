// Ruleta de Descuentos Directos (Sin Puntos)
import { triggerConfetti, playSuccessSound } from './visualMagic';
import { showToast } from '../api/client';

export interface WheelPrize {
  label: string;
  code: string;
  discountPct: number;
  color: string;
}

export const PRIZES: WheelPrize[] = [
  { label: '10% OFF', code: 'JY10', discountPct: 10, color: '#d946ef' },
  { label: '5% OFF', code: 'BIENVENIDA', discountPct: 5, color: '#8b5cf6' },
  { label: '15% OFF', code: 'JY15', discountPct: 15, color: '#f59e0b' },
  { label: 'Envío Gratis', code: 'JYENVIO', discountPct: 10, color: '#10b981' },
  { label: '20% OFF', code: 'JY20', discountPct: 20, color: '#ec4899' },
  { label: '5% Extra', code: 'BIENVENIDA', discountPct: 5, color: '#0ea5e9' }
];

export function initWheel() {
  const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
  const spinBtn = document.getElementById('spinBtn') as HTMLButtonElement;
  const wheelMsg = document.getElementById('wheelMsg');
  const wheelModal = document.getElementById('wheelModal');
  const wheelClose = document.getElementById('wheelClose');
  const openWheelBtns = document.querySelectorAll('[data-open-wheel]');

  if (!canvas) return;

  drawWheel(canvas);

  openWheelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      wheelModal?.classList.add('show');
    });
  });

  wheelClose?.addEventListener('click', () => {
    wheelModal?.classList.remove('show');
  });

  spinBtn?.addEventListener('click', () => {
    const today = new Date().toDateString();
    const lastSpin = localStorage.getItem('jy_last_spin_date');

    if (lastSpin === today) {
      showToast('Ya utilizaste tu giro de hoy. ¡Vuelve mañana para más descuentos!', 'info');
      return;
    }

    spinWheel(canvas, spinBtn, wheelMsg, today);
  });
}

function drawWheel(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const radius = width / 2;
  const totalPrizes = PRIZES.length;
  const arc = (2 * Math.PI) / totalPrizes;

  ctx.clearRect(0, 0, width, width);

  PRIZES.forEach((prize, i) => {
    ctx.beginPath();
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 4, i * arc, (i + 1) * arc);
    ctx.fillStyle = prize.color;
    ctx.fill();
    ctx.strokeStyle = '#14101a';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Texto del premio
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(i * arc + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText(prize.label, radius - 24, 8);
    ctx.restore();
  });
}

function spinWheel(canvas: HTMLCanvasElement, btn: HTMLButtonElement, msgEl: HTMLElement | null, today: string) {
  btn.disabled = true;
  btn.style.opacity = '0.5';

  const prizeIndex = Math.floor(Math.random() * PRIZES.length);
  const totalPrizes = PRIZES.length;
  const sliceDegrees = 360 / totalPrizes;

  // Calcular rotación para que la aguja superior (270 grados o tope) coincida
  const extraRotations = 360 * 5; // 5 vueltas completas
  const targetAngle = extraRotations + (360 - (prizeIndex * sliceDegrees) - sliceDegrees / 2);

  canvas.style.transform = `rotate(${targetAngle}deg)`;

  setTimeout(() => {
    const prize = PRIZES[prizeIndex];
    localStorage.setItem('jy_last_spin_date', today);
    localStorage.setItem('jy_saved_coupon', prize.code);

    // Auto-rellenar en el carrito
    const couponInput = document.getElementById('couponInput') as HTMLInputElement;
    if (couponInput) couponInput.value = prize.code;

    triggerConfetti();
    playSuccessSound();

    if (msgEl) {
      msgEl.innerHTML = `🎉 ¡Ganaste <b>${prize.label}</b>! Código: <b>${prize.code}</b>`;
    }

    showToast(`¡Felicidades! Ganaste cupón ${prize.code} (${prize.label}). Ya está listo en tu carrito.`, 'success');

    btn.disabled = false;
    btn.style.opacity = '1';
  }, 4900);
}
