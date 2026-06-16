export function mapDistanceMeters(
  guessX: number,
  guessY: number,
  answerX: number,
  answerY: number,
  imageWidth: number,
  imageHeight: number,
  metersPerPixel: number,
): number {
  const dx = (guessX - answerX) * imageWidth;
  const dy = (guessY - answerY) * imageHeight;
  const pixels = Math.hypot(dx, dy);
  return Math.round(pixels * metersPerPixel);
}
