import createEmitter, { Emitter, Handler, WildcardHandler } from 'mitt';
import { EventName, Events } from './eventEmitter';
import { getSize } from './domUtils';
import { Size } from './types';

export interface MapManager extends Pick<Emitter<Events>, 'on' | 'off'> {
  container: HTMLDivElement;
  dispose(): void;

  readonly size: Size;
}

export function createMapManager(container: HTMLDivElement): MapManager {
  const mitt = createEmitter<Events>();

  let size = getSize(container);
  const resizeObserver = new ResizeObserver(() => mitt.emit('size', (size = getSize(container))));
  resizeObserver.observe(container);

  function dispose() {
    resizeObserver.disconnect();
  }

  return {
    container,
    dispose,

    get size() {
      return size;
    },
    on: mitt.on,
    off: mitt.off,
  };
}
