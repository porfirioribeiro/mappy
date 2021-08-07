import { Size } from './types';

export function getSize(container: HTMLDivElement): Size {
  return {
    width: container.offsetWidth,
    height: container.offsetHeight,
  };
}
