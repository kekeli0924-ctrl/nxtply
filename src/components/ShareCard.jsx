import { useEffect, useRef, useCallback } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { shareCanvas } from '../utils/shareCard';

const W = 400;
const H = 220;

function drawCardBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0F1B2D');
  grad.addColorStop(1, '#1E3A5F');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

function drawCardBranding(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 14px "Playfair Display", Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('Composed', 20, 28);
}

function drawFooter(ctx, playerName) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Date bottom-left
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(dateStr, 20, H - 14);

  // Player name bottom-right
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(playerName, W - 20, H - 14);
}

function renderBadgeCard(ctx, data) {
  const emoji = data.emoji || '\u{1F3C6}';
  const name = data.name || 'Achievement';

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BADGE UNLOCKED', W / 2, 60);

  ctx.font = '42px serif';
  ctx.fillText(emoji, W / 2, 112);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.fillText(name, W / 2, 148);
}

function renderPRCard(ctx, data) {
  const name = data.name || 'Personal Record';
  const value = data.value != null ? String(data.value) : '--';

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PERSONAL RECORD', W / 2, 55);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.fillText(name, W / 2, 82);

  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 48px Inter, system-ui, sans-serif';
  ctx.fillText(value, W / 2, 140);
}

function renderStreakCard(ctx, data) {
  const streak = typeof data === 'number' ? data : (data.count || data.streak || 0);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DAY STREAK', W / 2, 60);

  ctx.font = '36px serif';
  ctx.fillText('\u{1F525}', W / 2, 108);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px Inter, system-ui, sans-serif';
  ctx.fillText(String(streak), W / 2, 158);
}

function renderSessionCard(ctx, data) {
  const date = data.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const duration = data.duration != null ? `${data.duration}m` : '--';
  const shotPct = data.shotPct != null ? `${data.shotPct}%` : '\u2014';
  const passPct = data.passPct != null ? `${data.passPct}%` : '\u2014';

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SESSION SUMMARY', 24, 55);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.fillText(date, 24, 80);

  // Stats grid
  const stats = [
    { label: 'Duration', value: duration },
    { label: 'Shot %', value: shotPct },
    { label: 'Pass %', value: passPct },
  ];

  const colW = (W - 48) / stats.length;
  stats.forEach((s, i) => {
    const x = 24 + i * colW;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, x, 115);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px Inter, system-ui, sans-serif';
    ctx.fillText(s.value, x, 145);
  });
}

const renderers = {
  badge: renderBadgeCard,
  pr: renderPRCard,
  streak: renderStreakCard,
  session: renderSessionCard,
};

function drawShareCard(type, data, playerName) {
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  drawCardBackground(ctx);
  drawCardBranding(ctx);

  const render = renderers[type];
  if (render) {
    render(ctx, data);
  }

  drawFooter(ctx, playerName);

  return canvas;
}

export default function ShareCard({ type, data, playerName, onClose }) {
  const previewRef = useRef(null);
  const canvasRef = useRef(null);

  const renderPreview = useCallback(() => {
    const canvas = drawShareCard(type, data, playerName);
    canvasRef.current = canvas;

    const container = previewRef.current;
    if (container) {
      container.innerHTML = '';
      // Display at 1x size
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.style.borderRadius = '8px';
      container.appendChild(canvas);
    }
  }, [type, data, playerName]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const handleDownload = async () => {
    if (canvasRef.current) {
      await shareCanvas(canvasRef.current);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Share Achievement"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={handleDownload}>Download Image</Button>
        </>
      }
    >
      <div ref={previewRef} className="flex justify-center mb-2" />
    </Modal>
  );
}
