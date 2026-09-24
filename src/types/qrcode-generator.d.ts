declare module 'qrcode-generator' {
  interface QR {
    addData(data: string, mode?: string): void;
    make(): void;
    createDataURL(cellSize?: number, margin?: number): string;
    createSvgTag(cellSize?: number, margin?: number): string;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }
  function qrcode(typeNumber: number, errorCorrectionLevel: string): QR;
  export = qrcode;
}
