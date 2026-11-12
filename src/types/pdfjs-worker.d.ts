// Vite turns "?worker" imports into a Worker constructor (used for the pdf.js worker in photoNormalizer).
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?worker' {
  const PdfWorker: new () => Worker;
  export default PdfWorker;
}
