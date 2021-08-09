import { LatLng, Pixel, Size } from './types';

export function getSize(container: HTMLElement): Size {
  const rect = container.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

export function getPosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

export function getMousePixel(
  dom: HTMLElement,
  event: Pick<MouseEvent, 'clientX' | 'clientY'>,
): Pixel {
  const parent = getPosition(dom);
  return [event.clientX - parent.x, event.clientY - parent.y];
}

export function parentHasClass(element: HTMLElement | null, className: string) {
  while (element) {
    if (element.classList && element.classList.contains(className)) return true;

    element = element.parentElement;
  }

  return false;
}

export function coordsInside(parent: HTMLElement, pixel: LatLng): boolean {
  const { x, y, width, height } = parent.getBoundingClientRect();

  if (pixel[0] < 0 || pixel[1] < 0 || pixel[0] >= width || pixel[1] >= height) {
    return false;
  }

  const element = document.elementFromPoint(pixel[0] + x, pixel[1] + y);

  return parent === element || parent.contains(element);
}
