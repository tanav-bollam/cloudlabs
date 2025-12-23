declare module "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs" {
  export interface PdfJsViewport {
    width: number;
    height: number;
  }

  export interface PdfJsPage {
    getViewport(params: { scale: number }): PdfJsViewport;
    render(params: {
      canvasContext: CanvasRenderingContext2D;
      viewport: PdfJsViewport;
    }): { promise: Promise<void> };
  }

  export interface PdfJsDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfJsPage>;
    destroy(): void;
  }

  export interface PdfJsLoadingTask {
    promise: Promise<PdfJsDocument>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(src: string | { data: ArrayBuffer }): PdfJsLoadingTask;
}
