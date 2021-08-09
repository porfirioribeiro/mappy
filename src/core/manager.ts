import createEmitter, { Emitter } from 'mitt';
import { EventName, Events } from './eventEmitter';
import { coordsInside, getMousePixel, getSize, parentHasClass } from './domUtils';
import { Bounds, LatLng, MinMaxBounds, MoveEvent, Pixel, Size } from './types';
import {
  absoluteMinMax,
  lat2tile,
  lng2tile,
  tile2lat,
  tile2lng,
  TileValues,
  tileValues,
} from './tile';
import { dragManager as createDragManager } from './dragManager';

export interface MapManager extends Pick<Emitter<Events>, 'on' | 'off'> {
  container: HTMLDivElement;
  dispose(): void;

  readonly size: Size;
  readonly bounds: Bounds;
  readonly zoom: number;
  readonly center: LatLng;

  latLngToPixel(latLng: LatLng): Pixel;
  pixelToLatLng(pixel: Pixel): LatLng;
  setCenterZoom(cz: { center?: LatLng; zoom?: number }): void;

  tileValues(): TileValues;
}

export interface MapManagerProps {
  defaultCenter: LatLng;
  defaultZoom: number;

  animate: boolean;
  animateMaxScreens: number;

  minZoom: number;
  maxZoom: number;

  metaWheelZoom: boolean;
  metaWheelZoomWarning: string;
  twoFingerDrag?: boolean;
  twoFingerDragWarning?: string;
  warningZIndex?: number;

  attribution?: JSX.Element | false;
  attributionPrefix?: JSX.Element | false;

  zoomSnap?: boolean;

  limitBounds?: 'center' | 'edge';

  onClick?: ({
    event,
    latLng,
    pixel,
  }: {
    event: MouseEvent;
    latLng: [number, number];
    pixel: [number, number];
  }) => void;
  onBoundsChanged?: ({
    center,
    zoom,
    bounds,
    initial,
  }: {
    center: LatLng;
    bounds: Bounds;
    zoom: number;
    initial: boolean;
  }) => void;
  onAnimationStart?: () => void;
  onAnimationStop?: () => void;
}

const defaultProps = {
  defaultZoom: 14,
  defaultCenter: [0, 0],

  animate: true,
  animateMaxScreens: 5,

  minZoom: 1,
  maxZoom: 18,

  metaWheelZoom: false,
  metaWheelZoomWarning: 'Use META + wheel to zoom!',
  twoFingerDrag: false,
  twoFingerDragWarning: 'Use two fingers to move the map',
  warningZIndex: 100,

  zoomSnap: true,

  limitBounds: 'center',
};

const wa = window.addEventListener;
const wr = window.removeEventListener;

const DRAGBLOCK_CLASS = 'pigeon-drag-block';
const CLICK_BLOCK_CLASS = 'pigeon-click-block';

const ANIMATION_TIME = 300;
const DIAGONAL_THROW_TIME = 1500;
const SCROLL_PIXELS_FOR_ZOOM_LEVEL = 150;
const MIN_DRAG_FOR_THROW = 40;
const CLICK_TOLERANCE = 2;
const DOUBLE_CLICK_DELAY = 300;
const DEBOUNCE_DELAY = 60;
const PINCH_RELEASE_THROW_DELAY = 300;
const WARNING_DISPLAY_TIMEOUT = 300;

const NOOP = () => true;

export function createMapManager(
  container: HTMLDivElement,
  dprops: Omit<MapManagerProps, keyof typeof defaultProps> &
    Partial<Pick<MapManagerProps, keyof typeof defaultProps>>,
): MapManager {
  const props: MapManagerProps = Object.assign({}, defaultProps, dprops);
  const mitt = createEmitter<Events>();
  let _mousePosition: Pixel | undefined;
  let _loadTracker: { [key: string]: boolean } | undefined;
  let _dragStart: Pixel | null = null;
  let _mouseDown = false;
  let _moveEvents: MoveEvent[] = [];
  let _lastClick: number | null = null;
  let _lastTap: number | null = null;
  let _lastWheel: number | null = null;
  let _touchStartPixel: Pixel[] | null = null;
  let _touchStartMidPoint: Pixel | null = null;
  let _touchStartDistance: number | null = null;
  let _secondTouchEnd: number | null = null;
  let _warningClearTimeout: number | null = null;

  let _isAnimating = false;
  let _animationStart: number | null = null;
  let _animationEnd: number | null = null;
  let _zoomStart: number | null = null;
  let _centerTarget: LatLng | null = null;
  let _zoomTarget: number | null = null;
  let _zoomAround: LatLng | null = null;
  let _animFrame: number | null = null;

  let _boundsSynced = false;
  let _minMaxCache: [number, number, number, MinMaxBounds] | null = null;

  let _lastZoom: number = props.defaultZoom;
  let _lastCenter: LatLng = props.defaultCenter;
  let _centerStart: LatLng | undefined;
  const { minZoom, maxZoom } = props;

  //state
  let stateZoom = _lastZoom;
  let stateCenter = _lastCenter;
  let zoomDelta = 0;
  let pixelDelta: Pixel | null = null;
  let oldTiles = [];
  let showWarning = false;
  let warningType = undefined;

  //#region size
  let size = getSize(container);
  const resizeObserver = new ResizeObserver(updateSize);
  resizeObserver.observe(container);

  function updateSize() {
    size = getSize(container);
    mitt.emit('size', size);
    mitt.emit('update');
  }
  //#endregion

  //#region  wheel
  container.addEventListener('wheel', handleWheel, { passive: false });

  function handleWheel(event: WheelEvent): void {
    const { metaWheelZoom, zoomSnap, animate } = props;

    if (!metaWheelZoom || event.metaKey || event.ctrlKey) {
      event.preventDefault();

      const addToZoom = -event.deltaY / SCROLL_PIXELS_FOR_ZOOM_LEVEL;

      if (!zoomSnap && _zoomTarget) {
        const stillToAdd = _zoomTarget - stateZoom;
        zoomAroundMouse(addToZoom + stillToAdd, event);
      } else {
        if (animate) {
          zoomAroundMouse(addToZoom, event);
        } else {
          if (!_lastWheel || performance.now() - _lastWheel > ANIMATION_TIME) {
            _lastWheel = performance.now();
            zoomAroundMouse(addToZoom, event);
          }
        }
      }
    } else {
      //TODO showWarning('wheel')
    }
  }

  //#endregion wheel

  //#region touch
  wa('touchstart', handleTouchStart, { passive: false });
  wa('touchmove', handleTouchMove, { passive: false });
  wa('touchend', handleTouchEnd, { passive: false });

  function handleTouchStart(event: TouchEvent): void {
    if (event.target && parentHasClass(event.target as HTMLElement, DRAGBLOCK_CLASS)) {
      return;
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const pixel = getMousePixel(container, touch);
      if (coordsInside(container, pixel)) {
        _touchStartPixel = [pixel];
        if (!props.twoFingerDrag) {
          stopAnimating();
          if (_lastTap && performance.now() - _lastTap < DOUBLE_CLICK_DELAY) {
            event.preventDefault();
            const latLngNow = pixelToLatLng(_touchStartPixel[0]);
            setCenterZoomTarget(
              null,
              Math.max(props.minZoom, Math.min(stateZoom + 1, props.maxZoom)),
              false,
              latLngNow,
            );
          } else {
            _lastTap = performance.now();
            trackMoveEvents(pixel);
          }
        }
      }
      // added second finger and first one was in the area
    } else if (event.touches.length === 2 && _touchStartPixel) {
      event.preventDefault();
      stopTrackingMoveEvents();
      if (pixelDelta || zoomDelta) {
        sendDeltaChange();
      }
      const t1 = getMousePixel(container, event.touches[0]);
      const t2 = getMousePixel(container, event.touches[1]);
      _touchStartPixel = [t1, t2];
      _touchStartMidPoint = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
      _touchStartDistance = Math.sqrt(Math.pow(t1[0] - t2[0], 2) + Math.pow(t1[1] - t2[1], 2));
    }
  }

  function handleTouchMove(event: TouchEvent): void {
    if (event.touches.length === 1 && _touchStartPixel) {
      const touch = event.touches[0];
      const pixel = getMousePixel(container, touch);
      if (props.twoFingerDrag) {
        if (coordsInside(container, pixel)) {
          // TODO showWarning('fingers')
        }
      } else {
        event.preventDefault();
        trackMoveEvents(pixel);
        emitDelta(
          [pixel[0] - _touchStartPixel[0][0], pixel[1] - _touchStartPixel[0][1]],
          zoomDelta,
        );
      }
    } else if (
      event.touches.length === 2 &&
      _touchStartPixel &&
      _touchStartMidPoint &&
      _touchStartDistance
    ) {
      const { width, height } = size;
      event.preventDefault();
      const t1 = getMousePixel(container, event.touches[0]);
      const t2 = getMousePixel(container, event.touches[1]);
      const midPoint = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
      const midPointDiff = [
        midPoint[0] - _touchStartMidPoint[0],
        midPoint[1] - _touchStartMidPoint[1],
      ];
      const distance = Math.sqrt(Math.pow(t1[0] - t2[0], 2) + Math.pow(t1[1] - t2[1], 2));
      const newZoomDelta =
        Math.max(
          props.minZoom,
          Math.min(props.maxZoom, stateZoom + Math.log2(distance / _touchStartDistance)),
        ) - stateZoom;
      const scale = Math.pow(2, newZoomDelta);
      const centerDiffDiff = [
        (width / 2 - midPoint[0]) * (scale - 1),
        (height / 2 - midPoint[1]) * (scale - 1),
      ];

      emitDelta(
        [centerDiffDiff[0] + midPointDiff[0] * scale, centerDiffDiff[1] + midPointDiff[1] * scale],
        newZoomDelta,
      );
    }
  }

  function handleTouchEnd(event: TouchEvent): void {
    if (_touchStartPixel) {
      const { zoomSnap, twoFingerDrag, minZoom, maxZoom } = props;
      const { center, zoom } = sendDeltaChange();
      if (event.touches.length === 0) {
        if (twoFingerDrag) {
          // TODO clearWarning();
        } else {
          // if the click started and ended at about
          // the same place we can view it as a click
          // and not prevent default behavior.
          const oldTouchPixel = _touchStartPixel[0];
          const newTouchPixel = getMousePixel(container, event.changedTouches[0]);
          if (
            Math.abs(oldTouchPixel[0] - newTouchPixel[0]) > CLICK_TOLERANCE ||
            Math.abs(oldTouchPixel[1] - newTouchPixel[1]) > CLICK_TOLERANCE
          ) {
            // don't throw immediately after releasing the second finger
            if (
              !_secondTouchEnd ||
              performance.now() - _secondTouchEnd > PINCH_RELEASE_THROW_DELAY
            ) {
              event.preventDefault();
              throwAfterMoving(newTouchPixel, center, zoom);
            }
          }
          _touchStartPixel = null;
          _secondTouchEnd = null;
        }
      } else if (event.touches.length === 1) {
        event.preventDefault();
        const touch = getMousePixel(container, event.touches[0]);
        _secondTouchEnd = performance.now();
        _touchStartPixel = [touch];
        trackMoveEvents(touch);
        if (zoomSnap) {
          // if somehow we have no midpoint for the two finger touch, just take the center of the map
          const latLng = _touchStartMidPoint ? pixelToLatLng(_touchStartMidPoint) : stateCenter;
          let zoomTarget;
          // do not zoom up/down if we must drag with 2 fingers and didn't change the zoom level
          if (twoFingerDrag && Math.round(stateZoom) === Math.round(stateZoom + zoomDelta)) {
            zoomTarget = Math.round(stateZoom);
          } else {
            zoomTarget = zoomDelta > 0 ? Math.ceil(stateZoom) : Math.floor(stateZoom);
          }
          const zoom = Math.max(minZoom, Math.min(zoomTarget, maxZoom));
          setCenterZoomTarget(latLng, zoom, false, latLng);
        }
      }
    }
  }

  //#endregion touch
  //#region  mouse

  wa('mousedown', handleMouseDown);
  wa('mouseup', handleMouseUp);
  wa('mousemove', handleMouseMove);
  function handleMouseDown(event: MouseEvent): void {
    const pixel = getMousePixel(container, event);
    if (
      event.button === 0 &&
      (!event.target || !parentHasClass(event.target as HTMLElement, DRAGBLOCK_CLASS)) &&
      coordsInside(container, pixel)
    ) {
      stopAnimating();
      event.preventDefault();
      if (_lastClick && performance.now() - _lastClick < DOUBLE_CLICK_DELAY) {
        if (!parentHasClass(event.target as HTMLElement, CLICK_BLOCK_CLASS)) {
          const latLngNow = pixelToLatLng(_mousePosition || pixel);
          setCenterZoomTarget(
            null,
            Math.max(minZoom, Math.min(stateZoom + 1, maxZoom)),
            false,
            latLngNow,
          );
        }
      } else {
        _lastClick = performance.now();
        _mouseDown = true;
        _dragStart = pixel;
        trackMoveEvents(pixel);
      }
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    _mousePosition = getMousePixel(container, event);
    if (_mouseDown && _dragStart) {
      trackMoveEvents(_mousePosition);
      emitDelta([_mousePosition[0] - _dragStart[0], _mousePosition[1] - _dragStart[1]], zoomDelta);
    }
  }

  function handleMouseUp(event: MouseEvent): void {
    if (_mouseDown) {
      _mouseDown = false;
      const pixel = getMousePixel(container, event);
      if (
        props.onClick &&
        (!event.target || !parentHasClass(event.target as HTMLElement, CLICK_BLOCK_CLASS)) &&
        (!pixelDelta || Math.abs(pixelDelta[0]) + Math.abs(pixelDelta[1]) <= CLICK_TOLERANCE)
      ) {
        const latLng = pixelToLatLng(pixel);
        props.onClick({ event, latLng, pixel });
        emitDelta(null, zoomDelta);
        //TODO emit pixelDelta
      } else {
        const { center, zoom } = sendDeltaChange();
        throwAfterMoving(pixel, center, zoom);
      }
    }
  }
  //#endregion mouse
  //#region animation

  const setCenterZoomTarget = (
    center: LatLng | null,
    zoom: number,
    fromProps = false,
    zoomAround: LatLng | null = null,
    animationDuration = ANIMATION_TIME,
  ): void => {
    if (
      props.animate &&
      (!fromProps ||
        (center &&
          distanceInScreens(center, zoom, stateCenter, stateZoom) <= props.animateMaxScreens))
    ) {
      if (_isAnimating) {
        cancelAnimationFrame(_animFrame!);
        const { centerStep, zoomStep } = animationStep(performance.now());
        _centerStart = centerStep;
        _zoomStart = zoomStep;
      } else {
        _isAnimating = true;
        _centerStart = limitCenterAtZoom([_lastCenter[0], _lastCenter[1]], _lastZoom);
        _zoomStart = _lastZoom;
        props.onAnimationStart?.();
      }

      _animationStart = performance.now();
      _animationEnd = _animationStart + animationDuration;

      if (zoomAround) {
        _zoomAround = zoomAround;
        _centerTarget = calculateZoomCenter(_lastCenter, zoomAround, _lastZoom, zoom);
      } else {
        _zoomAround = null;
        _centerTarget = center;
      }
      _zoomTarget = zoom;

      _animFrame = requestAnimationFrame(animate);
    } else {
      stopAnimating();

      if (zoomAround) {
        const center = calculateZoomCenter(_lastCenter, zoomAround, _lastZoom, zoom);
        setCenterZoom(center, zoom, fromProps);
      } else {
        setCenterZoom(center || stateCenter, zoom, fromProps);
      }
    }
  };
  const animationStep = (timestamp: number): { centerStep: LatLng; zoomStep: number } => {
    if (
      !_animationEnd ||
      !_animationStart ||
      !_zoomTarget ||
      !_zoomStart ||
      !_centerStart ||
      !_centerTarget
    ) {
      return {
        centerStep: stateCenter,
        zoomStep: stateZoom,
      };
    }
    const length = _animationEnd - _animationStart;
    const progress = Math.max(timestamp - _animationStart, 0);
    const percentage = easeOutQuad(progress / length);

    const zoomDiff = (_zoomTarget - _zoomStart) * percentage;
    const zoomStep = _zoomStart + zoomDiff;

    if (_zoomAround) {
      const centerStep = calculateZoomCenter(_centerStart, _zoomAround, _zoomStart, zoomStep);

      return { centerStep, zoomStep };
    } else {
      const centerStep = [
        _centerStart[0] + (_centerTarget[0] - _centerStart[0]) * percentage,
        _centerStart[1] + (_centerTarget[1] - _centerStart[1]) * percentage,
      ] as LatLng;

      return { centerStep, zoomStep };
    }
  };

  const animate = (timestamp: number): void => {
    if (!_animationEnd || timestamp >= _animationEnd) {
      _isAnimating = false;
      setCenterZoom(_centerTarget, _zoomTarget, true);
      props.onAnimationStop?.();
    } else {
      const { centerStep, zoomStep } = animationStep(timestamp);
      setCenterZoom(centerStep, zoomStep);
      _animFrame = requestAnimationFrame(animate);
    }
  };

  function stopAnimating() {
    if (_isAnimating) {
      _isAnimating = false;
      props.onAnimationStop?.();
      cancelAnimationFrame(_animFrame!);
    }
  }

  const throwAfterMoving = (coords: Pixel, center: LatLng, zoom: number): void => {
    const { width, height } = size;

    const timestamp = performance.now();
    const lastEvent = _moveEvents.shift();

    if (lastEvent && props.animate) {
      const deltaMs = Math.max(timestamp - lastEvent.timestamp, 1);

      const delta = [
        ((coords[0] - lastEvent.coords[0]) / deltaMs) * 120,
        ((coords[1] - lastEvent.coords[1]) / deltaMs) * 120,
      ];

      const distance = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);

      if (distance > MIN_DRAG_FOR_THROW) {
        const diagonal = Math.sqrt(width * width + height * height);

        const throwTime = (DIAGONAL_THROW_TIME * distance) / diagonal;

        const lng = tile2lng(lng2tile(center[1], zoom) - delta[0] / 256.0, zoom);
        const lat = tile2lat(lat2tile(center[0], zoom) - delta[1] / 256.0, zoom);

        setCenterZoomTarget([lat, lng], zoom, false, null, throwTime);
      }
    }

    stopTrackingMoveEvents();
  };

  const sendDeltaChange = () => {
    let lat = stateCenter[0];
    let lng = stateCenter[1];

    if (pixelDelta || zoomDelta !== 0) {
      lng = tile2lng(
        lng2tile(stateCenter[1], stateZoom + zoomDelta) - (pixelDelta ? pixelDelta[0] / 256.0 : 0),
        stateZoom + zoomDelta,
      );
      lat = tile2lat(
        lat2tile(stateCenter[0], stateZoom + zoomDelta) - (pixelDelta ? pixelDelta[1] / 256.0 : 0),
        stateZoom + zoomDelta,
      );
      setCenterZoom([lat, lng], stateZoom + zoomDelta);
    }

    emitDelta(null, 0);
    return {
      center: limitCenterAtZoom([lat, lng], stateZoom + zoomDelta),
      zoom: stateZoom + zoomDelta,
    };
  };

  //#endregion animation
  //#region utils

  const zoomAroundMouse = (zoomDiff: number, event: MouseEvent): void => {
    const { minZoom, maxZoom, zoomSnap } = props;

    _mousePosition = getMousePixel(container, event);

    if (
      !_mousePosition ||
      (stateZoom === minZoom && zoomDiff < 0) ||
      (stateZoom === maxZoom && zoomDiff > 0)
    ) {
      return;
    }

    const latLngNow = pixelToLatLng(_mousePosition);

    let zoomTarget = stateZoom + zoomDiff;
    if (zoomSnap) {
      zoomTarget = zoomDiff < 0 ? Math.floor(zoomTarget) : Math.ceil(zoomTarget);
    }
    zoomTarget = Math.max(minZoom, Math.min(zoomTarget, maxZoom));

    setCenterZoomTarget(null, zoomTarget, false, latLngNow);
  };

  // https://www.bennadel.com/blog/1856-using-jquery-s-animate-step-callback-function-to-create-custom-animations.htm
  const stopTrackingMoveEvents = (): void => {
    _moveEvents = [];
  };

  const trackMoveEvents = (coords: Pixel): void => {
    const timestamp = performance.now();

    if (
      _moveEvents.length === 0 ||
      timestamp - _moveEvents[_moveEvents.length - 1].timestamp > 40
    ) {
      _moveEvents.push({ timestamp, coords });
      if (_moveEvents.length > 2) {
        _moveEvents.shift();
      }
    }
  };

  const zoomPlusDelta = (): number => stateZoom + zoomDelta;

  const pixelToLatLng = (pixel: Pixel, center = stateCenter, zoom = zoomPlusDelta()): LatLng => {
    const { width, height } = size;

    const pointDiff = [
      (pixel[0] - width / 2 - (pixelDelta ? pixelDelta[0] : 0)) / 256.0,
      (pixel[1] - height / 2 - (pixelDelta ? pixelDelta[1] : 0)) / 256.0,
    ];

    const tileX = lng2tile(center[1], zoom) + pointDiff[0];
    const tileY = lat2tile(center[0], zoom) + pointDiff[1];

    return [
      Math.max(absoluteMinMax[0], Math.min(absoluteMinMax[1], tile2lat(tileY, zoom))),
      Math.max(absoluteMinMax[2], Math.min(absoluteMinMax[3], tile2lng(tileX, zoom))),
    ] as LatLng;
  };

  const latLngToPixel = (latLng: LatLng, center = stateCenter, zoom = zoomPlusDelta()): Pixel => {
    const { width, height } = size;

    const tileCenterX = lng2tile(center[1], zoom);
    const tileCenterY = lat2tile(center[0], zoom);

    const tileX = lng2tile(latLng[1], zoom);
    const tileY = lat2tile(latLng[0], zoom);

    return [
      (tileX - tileCenterX) * 256.0 + width / 2 + (pixelDelta ? pixelDelta[0] : 0),
      (tileY - tileCenterY) * 256.0 + height / 2 + (pixelDelta ? pixelDelta[1] : 0),
    ] as Pixel;
  };

  const getBounds = (center = stateCenter, zoom = zoomPlusDelta()): Bounds => {
    const { width, height } = size;

    return {
      ne: pixelToLatLng([width - 1, 0], center, zoom),
      sw: pixelToLatLng([0, height - 1], center, zoom),
    };
  };

  const calculateZoomCenter = (
    center: LatLng,
    coords: Pixel,
    oldZoom: number,
    newZoom: number,
  ): LatLng => {
    const { width, height } = size;

    const pixelBefore = latLngToPixel(coords, center, oldZoom);
    const pixelAfter = latLngToPixel(coords, center, newZoom);

    const newCenter = pixelToLatLng(
      [width / 2 + pixelAfter[0] - pixelBefore[0], height / 2 + pixelAfter[1] - pixelBefore[1]],
      center,
      newZoom,
    );

    return limitCenterAtZoom(newCenter, newZoom);
  };

  const limitCenterAtZoom = (center?: LatLng | null, zoom?: number | null): LatLng => {
    // [minLat, maxLat, minLng, maxLng]
    const minMax = getBoundsMinMax(zoom || stateZoom);

    return [
      Math.max(
        Math.min(!center || isNaN(center[0]) ? stateCenter[0] : center[0], minMax[1]),
        minMax[0],
      ),
      Math.max(
        Math.min(!center || isNaN(center[1]) ? stateCenter[1] : center[1], minMax[3]),
        minMax[2],
      ),
    ] as LatLng;
  };

  const getBoundsMinMax = (zoom: number): MinMaxBounds => {
    if (props.limitBounds === 'center') {
      return absoluteMinMax;
    }

    const { width, height } = size;

    if (
      _minMaxCache &&
      _minMaxCache[0] === zoom &&
      _minMaxCache[1] === width &&
      _minMaxCache[2] === height
    ) {
      return _minMaxCache[3];
    }

    const pixelsAtZoom = Math.pow(2, zoom) * 256;

    const minLng = width > pixelsAtZoom ? 0 : tile2lng(width / 512, zoom); // x
    const minLat = height > pixelsAtZoom ? 0 : tile2lat(Math.pow(2, zoom) - height / 512, zoom); // y

    const maxLng = width > pixelsAtZoom ? 0 : tile2lng(Math.pow(2, zoom) - width / 512, zoom); // x
    const maxLat = height > pixelsAtZoom ? 0 : tile2lat(height / 512, zoom); // y

    const minMax = [minLat, maxLat, minLng, maxLng] as MinMaxBounds;

    _minMaxCache = [zoom, width, height, minMax];

    return minMax;
  };

  const distanceInScreens = (
    centerTarget: LatLng,
    zoomTarget: number,
    center: LatLng,
    zoom: number,
  ): number => {
    const { width, height } = size;

    // distance in pixels at the current zoom level
    const l1 = latLngToPixel(center, center, zoom);
    const l2 = latLngToPixel(centerTarget, center, zoom);

    // distance in pixels at the target zoom level (could be the same)
    const z1 = latLngToPixel(center, center, zoomTarget);
    const z2 = latLngToPixel(centerTarget, center, zoomTarget);

    // take the average between the two and divide by width or height to get the distance multiplier in screens
    const w = (Math.abs(l1[0] - l2[0]) + Math.abs(z1[0] - z2[0])) / 2 / width;
    const h = (Math.abs(l1[1] - l2[1]) + Math.abs(z1[1] - z2[1])) / 2 / height;

    // return the distance
    return Math.sqrt(w * w + h * h);
  };
  //#endregion utils

  //#region main logic
  // main logic when changing coordinates
  const setCenterZoom = (
    center?: LatLng | null,
    zoom?: number | null,
    animationEnded = false,
  ): void => {
    const limitedCenter = limitCenterAtZoom(center, zoom);

    // if (zoom && Math.round(stateZoom) !== Math.round(zoom)) {
    //   const tileValues = this.tileValues(this.state);
    //   const nextValues = this.tileValues({
    //     center: limitedCenter,
    //     zoom,
    //     width: this.state.width,
    //     height: this.state.height,
    //   });
    //   const oldTiles = this.state.oldTiles;

    //   this.setState(
    //     {
    //       oldTiles: oldTiles
    //         .filter(o => o.roundedZoom !== tileValues.roundedZoom)
    //         .concat(tileValues),
    //     },
    //     NOOP,
    //   );

    //   const loadTracker: { [key: string]: boolean } = {};

    //   for (let x = nextValues.tileMinX; x <= nextValues.tileMaxX; x++) {
    //     for (let y = nextValues.tileMinY; y <= nextValues.tileMaxY; y++) {
    //       const key = `${x}-${y}-${nextValues.roundedZoom}`;
    //       loadTracker[key] = false;
    //     }
    //   }

    //   this._loadTracker = loadTracker;
    // }

    emitCenterZoom(limitedCenter, zoom || stateZoom);

    const maybeZoom = _lastZoom;
    const maybeCenter = _lastCenter;
    if (
      zoom &&
      (animationEnded ||
        Math.abs(maybeZoom - zoom) > 0.001 ||
        Math.abs(maybeCenter[0] - limitedCenter[0]) > 0.00001 ||
        Math.abs(maybeCenter[1] - limitedCenter[1]) > 0.00001)
    ) {
      _lastZoom = zoom;
      _lastCenter = [...limitedCenter];
    }
  };
  //#endregion

  //#region emitters
  function emitDelta(pixel: Pixel | null, zoom: number) {
    pixelDelta = pixel;
    zoomDelta = zoom;

    mitt.emit('update');
  }

  function emitCenterZoom(center: LatLng, zoom: number) {
    stateCenter = center;
    stateZoom = zoom;
    mitt.emit('update');
  }
  //#endregion emitters

  function dispose() {
    container.removeEventListener('wheel', handleWheel);

    wr('mousedown', handleMouseDown);
    wr('mouseup', handleMouseUp);
    wr('mousemove', handleMouseMove);

    wr('touchstart', handleTouchStart);
    wr('touchmove', handleTouchMove);
    wr('touchend', handleTouchEnd);

    resizeObserver.disconnect();
  }

  return {
    container,
    dispose,

    get size() {
      return size;
    },
    get center() {
      return stateCenter;
    },
    get zoom() {
      return stateZoom;
    },
    get bounds() {
      return getBounds();
    },
    latLngToPixel,
    pixelToLatLng,
    setCenterZoom({
      center = stateCenter,
      zoom = stateZoom,
    }: {
      center?: LatLng;
      zoom?: number;
    }): void {
      setCenterZoomTarget(center, zoom, true);
    },
    tileValues() {
      return tileValues(size, this.center, stateZoom, pixelDelta, zoomDelta);
    },
    on: mitt.on,
    off: mitt.off,
  };
}

function easeOutQuad(t: number): number {
  return t * (2 - t);
}
