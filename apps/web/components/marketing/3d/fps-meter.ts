/**
 * Shared measured-fps sample: the render loop writes it, the overlay badge
 * reads it once per second. The badge never shows a number that was not
 * measured on this device.
 */
export const fpsSample = { value: 0 };
