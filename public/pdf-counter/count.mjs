export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_PAGES = 1000;
export const MAX_TEXT_UNITS = 5_000_000;
export function validateFile(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 5 || file.size > MAX_BYTES)
    throw new Error('5바이트 이상, 50 MB 이하의 PDF를 선택해주세요.');
  if (!/\.pdf$/i.test(file.name)) throw new Error('확장자가 .pdf인 파일을 선택해주세요.');
}
export function hasPdfHeader(bytes) {
  return bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45;
}
export function countText(text) {
  if (typeof Intl.Segmenter !== 'function') throw new Error('최신 Edge 또는 Chrome에서 실행해주세요.');
  // Count extracted PDF strings only: never invent spaces between text items.
  const normalized = text.normalize('NFC').replace(/[\r\n\u2028\u2029]/gu, '');
  let withSpaces = 0, withoutSpaces = 0;
  for (const { segment } of new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(normalized)) {
    withSpaces++;
    if (!/^\s+$/u.test(segment)) withoutSpaces++;
  }
  return { withSpaces, withoutSpaces };
}
