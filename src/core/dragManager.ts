import createEmitter, { Emitter } from 'mitt';
import { coordsInside, getMousePixel, getSize, parentHasClass } from './domUtils';
import { Events } from './eventEmitter';
import { LatLng, MinMaxBounds, Pixel, Size } from './types';

export type DragManager = ReturnType<typeof dragManager>;

export interface MoveEvent {
  timestamp: number;
  coords: Pixel;
}

const wa = window.addEventListener;
const wr = window.removeEventListener;

const DRAGBLOCK_CLASS = 'pigeon-drag-block';

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

export function dragManager(
  container: HTMLDivElement,
  defaultCenter: LatLng = [0, 0],
  defaultZoom = 14,
  minZoom = 1,
  maxZoom = 18,
) {
  const mitt = createEmitter<Events>();

  //#region size
  let size = getSize(container);
  const resizeObserver = new ResizeObserver(updateSize);
  resizeObserver.observe(container);

  function updateSize() {
    size = getSize(container);
    mitt.emit('size', size);
  }
  //#endregion

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

  let _lastZoom: number = defaultZoom;
  let _lastCenter: LatLng = defaultCenter;
  let _centerStart: LatLng | undefined;

  //state

  let zoom = _lastZoom;
  let center = _lastCenter;
  // let width = props.width ?? props.defaultWidth ?? -1;
  // let height = props.height ?? props.defaultHeight ?? -1;
  let zoomDelta = 0;
  let pixelDelta = undefined;
  let oldTiles = [];
  let showWarning = false;
  let warningType = undefined;

  wa('touchstart', handleTouchStart, { passive: false });
  wa('touchmove', handleTouchMove, { passive: false });
  wa('touchend', handleTouchEnd, { passive: false });

  wa('mousedown', handleMouseDown);
  wa('mouseup', handleMouseUp);
  wa('mousemove', handleMouseMove);

  function dispose() {
    wr('mousedown', handleMouseDown);
    wr('mouseup', handleMouseUp);
    wr('mousemove', handleMouseMove);

    wr('touchstart', handleTouchStart);
    wr('touchmove', handleTouchMove);
    wr('touchend', handleTouchEnd);
  }

  function handleTouchStart(event: TouchEvent): void {
    console.log('handleTouchStart', event);

    if (event.target && parentHasClass(event.target as HTMLElement, DRAGBLOCK_CLASS)) {
      return;
    }
    // if (event.touches.length === 1) {
    //   const touch = event.touches[0]
    //   const pixel = getMousePixel(container, touch)
    //   if (this.coordsInside(pixel)) {
    //     this._touchStartPixel = [pixel]
    //     if (!this.props.twoFingerDrag) {
    //       this.stopAnimating()
    //       if (this._lastTap && performance.now() - this._lastTap < DOUBLE_CLICK_DELAY) {
    //         event.preventDefault()
    //         const latLngNow = this.pixelToLatLng(this._touchStartPixel[0])
    //         this.setCenterZoomTarget(
    //           null,
    //           Math.max(this.props.minZoom, Math.min(zoom + 1, this.props.maxZoom)),
    //           false,
    //           latLngNow
    //         )
    //       } else {
    //         this._lastTap = performance.now()
    //         this.trackMoveEvents(pixel)
    //       }
    //     }
    //   }
    //   // added second finger and first one was in the area
    // } else if (event.touches.length === 2 && this._touchStartPixel) {
    //   event.preventDefault()
    //   this.stopTrackingMoveEvents()
    //   if (this.state.pixelDelta || this.state.zoomDelta) {
    //     this.sendDeltaChange()
    //   }
    //   const t1 = getMousePixel(container, event.touches[0])
    //   const t2 = getMousePixel(container, event.touches[1])
    //   this._touchStartPixel = [t1, t2]
    //   this._touchStartMidPoint = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2]
    //   this._touchStartDistance = Math.sqrt(Math.pow(t1[0] - t2[0], 2) + Math.pow(t1[1] - t2[1], 2))
    // }
  }

  function handleTouchMove(event: TouchEvent): void {
    console.log('handleTouchMove', event);
    // if (!container) {
    //   this._touchStartPixel = null
    //   return
    // }
    // if (event.touches.length === 1 && this._touchStartPixel) {
    //   const touch = event.touches[0]
    //   const pixel = getMousePixel(container, touch)
    //   if (this.props.twoFingerDrag) {
    //     if (this.coordsInside(pixel)) {
    //       this.showWarning('fingers')
    //     }
    //   } else {
    //     event.preventDefault()
    //     this.trackMoveEvents(pixel)
    //     this.setState(
    //       {
    //         pixelDelta: [pixel[0] - this._touchStartPixel[0][0], pixel[1] - this._touchStartPixel[0][1]],
    //       },
    //       NOOP
    //     )
    //   }
    // } else if (
    //   event.touches.length === 2 &&
    //   this._touchStartPixel &&
    //   this._touchStartMidPoint &&
    //   this._touchStartDistance
    // ) {
    //   const { width, height, zoom } = this.state
    //   event.preventDefault()
    //   const t1 = getMousePixel(container, event.touches[0])
    //   const t2 = getMousePixel(container, event.touches[1])
    //   const midPoint = [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2]
    //   const midPointDiff = [midPoint[0] - this._touchStartMidPoint[0], midPoint[1] - this._touchStartMidPoint[1]]
    //   const distance = Math.sqrt(Math.pow(t1[0] - t2[0], 2) + Math.pow(t1[1] - t2[1], 2))
    //   const zoomDelta =
    //     Math.max(
    //       this.props.minZoom,
    //       Math.min(this.props.maxZoom, zoom + Math.log2(distance / this._touchStartDistance))
    //     ) - zoom
    //   const scale = Math.pow(2, zoomDelta)
    //   const centerDiffDiff = [(width / 2 - midPoint[0]) * (scale - 1), (height / 2 - midPoint[1]) * (scale - 1)]
    //   this.setState(
    //     {
    //       zoomDelta: zoomDelta,
    //       pixelDelta: [centerDiffDiff[0] + midPointDiff[0] * scale, centerDiffDiff[1] + midPointDiff[1] * scale],
    //     },
    //     NOOP
    //   )
    // }
  }

  function handleTouchEnd(event: TouchEvent): void {
    console.log('handleTouchEnd', event);
    // if (!container) {
    //   this._touchStartPixel = null
    //   return
    // }
    // if (this._touchStartPixel) {
    //   const { zoomSnap, twoFingerDrag, minZoom, maxZoom } = this.props
    //   const { zoomDelta } = this.state
    //   const { center, zoom } = this.sendDeltaChange()
    //   if (event.touches.length === 0) {
    //     if (twoFingerDrag) {
    //       this.clearWarning()
    //     } else {
    //       // if the click started and ended at about
    //       // the same place we can view it as a click
    //       // and not prevent default behavior.
    //       const oldTouchPixel = this._touchStartPixel[0]
    //       const newTouchPixel = getMousePixel(container, event.changedTouches[0])
    //       if (
    //         Math.abs(oldTouchPixel[0] - newTouchPixel[0]) > CLICK_TOLERANCE ||
    //         Math.abs(oldTouchPixel[1] - newTouchPixel[1]) > CLICK_TOLERANCE
    //       ) {
    //         // don't throw immediately after releasing the second finger
    //         if (!this._secondTouchEnd || performance.now() - this._secondTouchEnd > PINCH_RELEASE_THROW_DELAY) {
    //           event.preventDefault()
    //           this.throwAfterMoving(newTouchPixel, center, zoom)
    //         }
    //       }
    //       this._touchStartPixel = null
    //       this._secondTouchEnd = null
    //     }
    //   } else if (event.touches.length === 1) {
    //     event.preventDefault()
    //     const touch = getMousePixel(container, event.touches[0])
    //     this._secondTouchEnd = performance.now()
    //     this._touchStartPixel = [touch]
    //     this.trackMoveEvents(touch)
    //     if (zoomSnap) {
    //       // if somehow we have no midpoint for the two finger touch, just take the center of the map
    //       const latLng = this._touchStartMidPoint ? this.pixelToLatLng(this._touchStartMidPoint) : this.state.center
    //       let zoomTarget
    //       // do not zoom up/down if we must drag with 2 fingers and didn't change the zoom level
    //       if (twoFingerDrag && Math.round(zoom) === Math.round(zoom + zoomDelta)) {
    //         zoomTarget = Math.round(zoom)
    //       } else {
    //         zoomTarget = zoomDelta > 0 ? Math.ceil(zoom) : Math.floor(zoom)
    //       }
    //       const zoom = Math.max(minZoom, Math.min(zoomTarget, maxZoom))
    //       this.setCenterZoomTarget(latLng, zoom, false, latLng)
    //     }
    //   }
    // }
  }

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
        if (!parentHasClass(event.target as HTMLElement, 'pigeon-click-block')) {
          const latLngNow = this.pixelToLatLng(_mousePosition || pixel);
          this.setCenterZoomTarget(
            null,
            Math.max(minZoom, Math.min(zoom + 1, maxZoom)),
            false,
            latLngNow,
          );
        }
      } else {
        _lastClick = performance.now();
        _mouseDown = true;
        _dragStart = pixel;
        this.trackMoveEvents(pixel);
      }
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    // console.log('handleMouseMove', event);
    // _mousePosition = getMousePixel(container, event)
    // if (_mouseDown && _dragStart) {
    //   this.trackMoveEvents(_mousePosition)
    //   this.setState(
    //     {
    //       pixelDelta: [_mousePosition[0] - _dragStart[0], _mousePosition[1] - _dragStart[1]],
    //     },
    //     NOOP
    //   )
    // }
  }

  function handleMouseUp(event: MouseEvent): void {
    // console.log('handleMouseUp', event);
    // if (!container) {
    //   _mouseDown = false
    //   return
    // }
    // const { pixelDelta } = this.state
    // if (_mouseDown) {
    //   _mouseDown = false
    //   const pixel = getMousePixel(container, event)
    //   if (
    //     this.props.onClick &&
    //     (!event.target || !parentHasClass(event.target as HTMLElement, 'pigeon-click-block')) &&
    //     (!pixelDelta || Math.abs(pixelDelta[0]) + Math.abs(pixelDelta[1]) <= CLICK_TOLERANCE)
    //   ) {
    //     const latLng = this.pixelToLatLng(pixel)
    //     this.props.onClick({ event, latLng, pixel })
    //     this.setState({ pixelDelta: undefined }, NOOP)
    //   } else {
    //     const { center, zoom } = this.sendDeltaChange()
    //     this.throwAfterMoving(pixel, center, zoom)
    //   }
    // }
  }

  function stopAnimating() {
    if (_isAnimating) {
      _isAnimating = false;
      // should we call props.onAnimationStop()?
      cancelAnimationFrame(_animFrame!);
    }
  }

  // function mouseCoords(e: MouseEvent | TouchEvent): [number, number] {
  //   const rect = container.getBoundingClientRect();
  //   const p = 'touches' in e ? e.touches[0] : e;

  //   return [p.clientX - rect.left, p.clientY - rect.top];
  // }

  // function dragStart(e: MouseEvent | TouchEvent) {
  //   if (container.contains(e.target as HTMLElement)) {
  //     active = true;
  //     const point = mouseCoords(e);
  //     trackMouse(point);
  //     // console.log("start", point);
  //   }
  // }

  // function drag(e: MouseEvent | TouchEvent) {
  //   if (active) {
  //     e.preventDefault();
  //     const point = mouseCoords(e);
  //     trackMouse(point);

  //     // console.log("drag", point);

  //     setTranslate(currentX, currentY, container);
  //   }
  // }
  // function dragEnd(e: MouseEvent | TouchEvent) {
  //   if (active) {
  //     // const point = mouseCoords(e);
  //     // console.log("end", point);

  //     active = false;
  //   }
  // }

  // function trackMouse(point: [number, number]) {}

  // function setTranslate(xPos: number, yPos: number, el: HTMLDivElement) {
  //   // console.log(xPos, yPos);
  // }

  return {
    dispose,
  };
}
