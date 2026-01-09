declare module "pdf-parse" {
  interface PageText {
    text: string;
    num: number;
  }

  interface TextResult {
    pages: PageText[];
  }

  export class PDFParse {
    constructor(data: Uint8Array);
    load(): Promise<void>;
    getText(): Promise<TextResult>;
  }
}
