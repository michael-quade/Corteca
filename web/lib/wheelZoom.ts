// Wheel events report distance in pixels, lines or pages depending on the device
// and browser, and mice with smooth scrolling send one notch as a burst of small
// events. Zooming by distance (not per event) keeps one notch one step.

/** Vertical wheel distance in CSS pixels, whatever unit the event uses. */
export function wheelPixels(e: WheelEvent): number {
  if (e.deltaMode === 1) return e.deltaY * 40;    // lines
  if (e.deltaMode === 2) return e.deltaY * 800;   // pages
  return e.deltaY / (window.devicePixelRatio || 1);
}
