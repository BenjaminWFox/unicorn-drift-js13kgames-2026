const down = new Set<string>();
const pressed = new Set<string>();

export let tapX = -1;
export let tapY = -1;

export function initInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) {
      return;
    }
    if (e.code === 'Space' || e.code.startsWith('Arrow')) {
      e.preventDefault();
    }
    down.add(e.code);
    if (!e.repeat) {
      pressed.add(e.code);
    }
  });
  window.addEventListener('keyup', (e) => {
    down.delete(e.code);
  });

  canvas.addEventListener('pointerdown', (e) => {
    tapX = e.clientX;
    tapY = e.clientY;
  });
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
}

export function held(code: string): boolean {
  return down.has(code);
}

export function wasPressed(code: string): boolean {
  return pressed.has(code);
}

export function clearFrameInput(): void {
  pressed.clear();
  tapX = -1;
  tapY = -1;
}
