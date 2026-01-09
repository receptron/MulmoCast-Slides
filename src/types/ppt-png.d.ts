declare module "ppt-png" {
  interface ConverterOptions {
    files: string[];
    output: string;
    density?: number;
  }

  interface Converter {
    convert(): Promise<void>;
  }

  export function create(options: ConverterOptions): Converter;
  export default { create };
}
