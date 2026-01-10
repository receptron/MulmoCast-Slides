declare module "xml2js" {
  export function parseString(
    xml: string,
    callback: (err: Error | null, result: unknown) => void
  ): void;
}
