// Efectos visuales, Confetti, Cursor Glow y Social Proof

export function triggerConfetti() {
  const canvas = document.getElementById('confetti') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#d946ef', '#fbbf24', '#8b5cf6', '#10b981', '#0ea5e9'];
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 200,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speedY: Math.random() * 3 + 2,
    rotation: Math.random() * 6
  }));

  let frame = 0;
  const interval = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += Math.sin(p.y / 30) * 1.5;
      p.rotation += 0.08;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    if (++frame > 130) {
      clearInterval(interval);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, 16);
}

export function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  if (!glow) return;

  document.addEventListener('mousemove', (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  });
}

export function initCountdown() {
  const cdElement = document.getElementById('countdown');
  if (!cdElement) return;

  function update() {
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const diff = Math.max(0, end.getTime() - now.getTime());

    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

    if (cdElement) cdElement.textContent = `${h}:${m}:${s}`;
  }

  update();
  setInterval(update, 1000);
}

const BUYERS = ['Camila de Neiva', 'Andrés de Bogotá', 'Valentina de Medellín', 'Santiago de Pitalito', 'Laura de Cali', 'Sofía de Garzón'];
const SAMPLE_PRODUCTS = ['Vela Rosa Decorativa', 'Jabón Rosa Amarilla', 'Set Premium JY', 'Jabón Masaje Spa', 'Vela Girasol'];

export function initSocialProof() {
  const liveBox = document.getElementById('liveBox');
  if (!liveBox) return;

  function showPop() {
    const buyer = BUYERS[Math.floor(Math.random() * BUYERS.length)];
    const prod = SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)];
    const mins = Math.floor(Math.random() * 8 + 1);

    const card = document.createElement('div');
    card.className = 'live-card';
    card.innerHTML = `
      <img src="https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=100&q=80" alt="JY">
      <div>
        <b>${buyer}</b>
        <span>Compró ${prod}</span><br>
        <span style="color:var(--mut);font-size:0.74rem">Hace ${mins} min · Compra verificada</span>
      </div>
    `;

    liveBox?.appendChild(card);
    setTimeout(() => card.classList.add('show'), 50);
    setTimeout(() => {
      card.classList.remove('show');
      setTimeout(() => card.remove(), 450);
    }, 5000);
  }

  // Lanzar cada 14 a 22 segundos
  setTimeout(showPop, 4000);
  setInterval(showPop, 18000);
}

export function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(587, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (err) {}
}
