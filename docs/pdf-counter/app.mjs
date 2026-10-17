import { getDocument, GlobalWorkerOptions } from './vendor/pdf.mjs';
import { validateFile, hasPdfHeader, countText, MAX_PAGES, MAX_TEXT_UNITS } from './count.mjs';
GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
const input = $('file'), status = $('status'), results = $('results'), progress = $('progress');
let active = null;
const format = n => n.toLocaleString('ko-KR');
function forgetResults() {
  results.hidden = true;
  $('rows').replaceChildren();
  $('with-spaces').textContent = $('without-spaces').textContent = '0';
  $('page-summary').textContent = $('scan-note').textContent = '';
  $('scan-note').hidden = true;
}
async function release(run) {
  if (!run) return;
  clearTimeout(run.timer);
  run.cancelled = true;
  if (run.task) {
    try { await run.task.destroy(); } catch { /* Worker already terminated. */ }
    run.task = null;
  }
}
function reset(message = '파일과 결과를 지웠습니다.') {
  const prior = active;
  active = null;
  void release(prior);
  input.value = '';
  forgetResults();
  progress.hidden = $('cancel').hidden = true;
  status.textContent = message;
}
async function analyze(file) {
  reset('PDF를 확인하고 있습니다.');
  const run = { task: null, cancelled: false, timer: null };
  active = run;
  const current = () => active === run && !run.cancelled;
  const check = () => { if (!current()) throw new Error('cancelled'); };
  try {
    validateFile(file);
    run.timer = setTimeout(() => { if (current()) reset('처리 시간이 90초를 초과해 중단했습니다. 더 작은 PDF로 나누어 다시 시도해주세요.'); }, 90_000);
    $('cancel').hidden = false;
    // Only bytes are supplied to PDF.js; no URL, upload, or user document storage.
    let bytes = new Uint8Array(await file.arrayBuffer());
    check();
    if (!hasPdfHeader(bytes)) throw new Error('PDF 파일 형식이 올바르지 않습니다.');
    run.task = getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true,
      useSystemFonts: false, useWorkerFetch: true, stopAtErrors: true,
      cMapUrl: new URL('./vendor/cmaps/', import.meta.url).href, cMapPacked: true,
      standardFontDataUrl: new URL('./vendor/standard_fonts/', import.meta.url).href,
      wasmUrl: new URL('./vendor/wasm/', import.meta.url).href,
      isOffscreenCanvasSupported: false, isImageDecoderSupported: false, verbosity: 0 });
    bytes = null;
    const pdf = await run.task.promise;
    check();
    if (pdf.numPages > MAX_PAGES) throw new Error('1,000페이지 이하의 PDF를 선택해주세요.');
    const counts = [];
    let totalUnits = 0, totalWith = 0, totalWithout = 0, emptyPages = 0;
    progress.max = pdf.numPages; progress.value = 0; progress.hidden = false;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      check();
      status.textContent = `${format(pageNumber)} / ${format(pdf.numPages)}페이지 처리 중…`;
      const page = await pdf.getPage(pageNumber);
      let text = '';
      try {
        // Stream with a total text limit instead of retaining the document text.
        const reader = page.streamTextContent().getReader();
        try {
          while (true) {
            const chunk = await reader.read();
            check();
            if (chunk.done) break;
            for (const item of chunk.value.items) {
              if (typeof item.str !== 'string') continue;
              totalUnits += item.str.length;
              if (totalUnits > MAX_TEXT_UNITS) throw new Error('텍스트가 너무 많습니다. 500만 문자 단위 이하로 나누어 처리해주세요.');
              text += item.str + (item.hasEOL ? '\n' : '');
            }
          }
        } finally { try { await reader.cancel(); } catch { /* Document may have been cancelled. */ } }
        const count = countText(text);
        counts.push(count); totalWith += count.withSpaces; totalWithout += count.withoutSpaces;
        if (count.withoutSpaces === 0) emptyPages++;
      } finally { text = ''; page.cleanup(); }
      progress.value = pageNumber;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    check();
    const fragment = document.createDocumentFragment();
    counts.forEach((count, i) => {
      const tr = document.createElement('tr');
      [i + 1, count.withSpaces, count.withoutSpaces].forEach(value => {
        const td = document.createElement('td'); td.textContent = format(value); tr.append(td);
      });
      fragment.append(tr);
    });
    $('rows').replaceChildren(fragment);
    $('with-spaces').textContent = format(totalWith);
    $('without-spaces').textContent = format(totalWithout);
    $('page-summary').textContent = `총 ${format(pdf.numPages)}페이지`;
    if (emptyPages) {
      $('scan-note').hidden = false;
      $('scan-note').textContent = `텍스트를 찾지 못한 페이지가 ${format(emptyPages)}개 있습니다. 빈 페이지이거나 스캔 이미지일 수 있습니다. 이미지 속 글자는 OCR이 필요합니다. 텍스트가 있는 페이지에서도 이미지 속 글자는 제외됩니다.`;
    }
    results.hidden = false;
    status.textContent = '계산 완료. PDF 원문은 보관하지 않고 숫자 결과만 현재 화면에 표시합니다.';
  } catch (error) {
    if (current()) {
      forgetResults();
      status.textContent = error?.name === 'PasswordException'
        ? '암호가 설정된 PDF는 처리할 수 없습니다. 컴퓨터에서 암호를 해제한 사본을 선택해주세요.'
        : error?.name === 'InvalidPDFException'
          ? '손상되었거나 지원하지 않는 PDF입니다. 다른 PDF로 다시 시도해주세요.'
          : error instanceof Error && /^(5바이트|확장자|PDF 파일 형식|1,000페이지|텍스트가|최신 Edge)/u.test(error.message)
            ? error.message : 'PDF를 읽지 못했습니다. 파일 형식과 브라우저를 확인한 뒤 다시 시도해주세요.';
    }
  } finally {
    await release(run);
    if (active === run) {
      active = null; input.value = '';
      progress.hidden = $('cancel').hidden = true;
    }
    file = null;
  }
}
input.addEventListener('change', () => { const file = input.files[0]; if (file) void analyze(file); });
$('clear').addEventListener('click', () => reset());
$('cancel').addEventListener('click', () => reset('처리를 취소하고 파일과 결과를 지웠습니다.'));
const drop = $('drop');
['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', event => {
  if (event.dataTransfer.files.length !== 1) { reset('PDF를 한 번에 하나씩 선택해주세요.'); return; }
  void analyze(event.dataTransfer.files[0]);
});
window.addEventListener('pagehide', () => reset('파일과 결과를 지웠습니다.'));
