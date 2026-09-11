import { drawBox, setDepthWrite, setDrawAlpha } from './gl';

const stars: number[] = [];

function seed(): void {
  if (stars.length) {
    return;
  }
  for (let i = 0; i < 70; i++) {
    stars.push((Math.random() - 0.2) * 220, -20 + Math.random() * 90, (Math.random() - 0.25) * 240, 0.08 + Math.random() * 0.14);
  }
}

export function drawStars(view: Float32Array): void {
  seed();
  setDepthWrite(false);
  setDrawAlpha(0.75);
  for (let i = 0; i < stars.length; i += 4) {
    drawBox(view, stars[i], stars[i + 1], stars[i + 2], 0, 0, stars[i + 3], stars[i + 3], stars[i + 3], 0.92, 0.94, 1);
  }
  setDrawAlpha(1);
  setDepthWrite(true);
}
