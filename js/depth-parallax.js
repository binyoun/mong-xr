/**
 * depth-parallax.js
 * Listens to DeviceOrientationEvent and shifts far/mid/near cards by different
 * amounts via CSS custom properties --tx and --ty, creating genuine spatial parallax.
 * Near cards appear to move more than far cards when the phone tilts.
 */

export function initDepthParallax() {
  if (!window.DeviceOrientationEvent) return;

  // iOS 13+ requires permission for DeviceOrientationEvent
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // Request on first user gesture — hook into the existing tap that starts the camera
    document.addEventListener('click', () => {
      DeviceOrientationEvent.requestPermission().catch(() => {});
    }, { once: true });
  }

  window.addEventListener('deviceorientation', (e) => {
    const tiltX = e.gamma || 0; // left-right (-90 to 90)
    const tiltY = e.beta  || 0; // front-back (-180 to 180)

    document.querySelectorAll('.depth-far').forEach(el => {
      el.style.setProperty('--tx', `${tiltX * 0.04}px`);
      el.style.setProperty('--ty', `${tiltY * 0.04}px`);
    });
    document.querySelectorAll('.depth-mid').forEach(el => {
      el.style.setProperty('--tx', `${tiltX * 0.1}px`);
      el.style.setProperty('--ty', `${tiltY * 0.1}px`);
    });
    document.querySelectorAll('.depth-near').forEach(el => {
      el.style.setProperty('--tx', `${tiltX * 0.18}px`);
      el.style.setProperty('--ty', `${tiltY * 0.18}px`);
    });
  });
}
