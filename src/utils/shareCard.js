const W = 400;
const H = 220;
const BG_START = '#FAFAF8';
const BG_END = '#FFFFFF';

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  return { canvas, ctx };
}

function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, BG_START);
  grad.addColorStop(1, BG_END);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle border
  ctx.strokeStyle = '#E8E5E0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

function drawBranding(ctx) {
  ctx.fillStyle = 'rgba(28,25,23,0.2)';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Composed', W - 16, H - 12);
}

export function renderWeeklySummaryCard({ totalSessions, totalTime, avgShotPct, avgPassPct, weeklyLoad }) {
  const { canvas, ctx } = createCanvas();
  drawBackground(ctx);

  // Title
  ctx.fillStyle = 'rgba(28,25,23,0.5)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WEEKLY SUMMARY', 24, 32);

  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 22px Inter, system-ui, sans-serif';
  ctx.fillText('This Week', 24, 60);

  // Stats grid
  const stats = [
    { label: 'Sessions', value: `${totalSessions}` },
    { label: 'Total Time', value: `${totalTime}m` },
    { label: 'Shot %', value: avgShotPct != null ? `${avgShotPct}%` : '\u2014' },
    { label: 'Pass %', value: avgPassPct != null ? `${avgPassPct}%` : '\u2014' },
  ];
  if (weeklyLoad) stats.push({ label: 'Load', value: `${weeklyLoad}` });

  const cols = stats.length;
  const colW = (W - 48) / cols;
  stats.forEach((s, i) => {
    const x = 24 + i * colW;
    ctx.fillStyle = 'rgba(28,25,23,0.4)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, x, 100);
    ctx.fillStyle = '#1E3A5F';
    ctx.font = 'bold 24px Inter, system-ui, sans-serif';
    ctx.fillText(s.value, x, 128);
  });

  // Divider
  ctx.fillStyle = 'rgba(28,25,23,0.1)';
  ctx.fillRect(24, 148, W - 48, 1);

  // Footer
  ctx.fillStyle = 'rgba(28,25,23,0.35)';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  const now = new Date();
  ctx.fillText(`Week of ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 24, 175);

  drawBranding(ctx);
  return canvas;
}

export function renderPRAchievementCard(prName, prValue) {
  const { canvas, ctx } = createCanvas();
  drawBackground(ctx);

  // Title
  ctx.fillStyle = 'rgba(28,25,23,0.5)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PERSONAL RECORD', W / 2, 50);

  // PR name
  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.fillText(prName, W / 2, 80);

  // PR value
  ctx.fillStyle = '#1E3A5F';
  ctx.font = 'bold 52px Inter, system-ui, sans-serif';
  ctx.fillText(prValue, W / 2, 140);

  drawBranding(ctx);
  return canvas;
}

export async function shareCanvas(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'composed.png', { type: 'image/png' })] })) {
        try {
          await navigator.share({ files: [new File([blob], 'composed.png', { type: 'image/png' })] });
          resolve(true);
          return;
        } catch { /* fallthrough */ }
      }
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'composed.png';
      a.click();
      URL.revokeObjectURL(url);
      resolve(true);
    }, 'image/png');
  });
}
