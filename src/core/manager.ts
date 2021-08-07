export interface MapManager {
  container: HTMLDivElement;
}

export function createMapManager(container: HTMLDivElement): MapManager {
  return {
    container,
  };
}
