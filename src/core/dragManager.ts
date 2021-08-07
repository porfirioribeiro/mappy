import { RefObject } from 'react';

export type DragManager = ReturnType<typeof dragManager>;

export function dragManager(container: HTMLDivElement) {
  let active = false;
  let currentX: number;
  let currentY: number;

  window.addEventListener('touchstart', dragStart, { passive: false });
  window.addEventListener('touchend', dragEnd, { passive: false });
  window.addEventListener('touchmove', drag, { passive: false });

  window.addEventListener('mousedown', dragStart, false);
  window.addEventListener('mouseup', dragEnd, false);
  window.addEventListener('mousemove', drag, false);

  function dispose() {
    window.removeEventListener('touchstart', dragStart);
    window.removeEventListener('touchend', dragEnd);
    window.removeEventListener('touchmove', drag);

    window.removeEventListener('mousedown', dragStart);
    window.removeEventListener('mouseup', dragEnd);
    window.removeEventListener('mousemove', drag);
  }

  function mouseCoords(e: MouseEvent | TouchEvent): [number, number] {
    const rect = container.getBoundingClientRect();
    const p = 'touches' in e ? e.touches[0] : e;

    return [p.clientX - rect.left, p.clientY - rect.top];
  }

  function dragStart(e: MouseEvent | TouchEvent) {
    if (container.contains(e.target as HTMLElement)) {
      active = true;
      const point = mouseCoords(e);
      trackMouse(point);
      // console.log("start", point);
    }
  }

  function drag(e: MouseEvent | TouchEvent) {
    if (active) {
      e.preventDefault();
      const point = mouseCoords(e);
      trackMouse(point);

      // console.log("drag", point);

      setTranslate(currentX, currentY, container);
    }
  }
  function dragEnd(e: MouseEvent | TouchEvent) {
    if (active) {
      // const point = mouseCoords(e);
      // console.log("end", point);

      active = false;
    }
  }

  function trackMouse(point: [number, number]) {}

  function setTranslate(xPos: number, yPos: number, el: HTMLDivElement) {
    // console.log(xPos, yPos);
  }

  return {
    dispose,
  };
}
