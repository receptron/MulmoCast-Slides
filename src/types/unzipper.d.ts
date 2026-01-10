declare module "unzipper" {
  type FileEntry = {
    path: string;
    buffer(): Promise<Buffer>;
  };

  type Directory = {
    files: FileEntry[];
  };

  const unzipper: {
    Open: {
      file(path: string): Promise<Directory>;
    };
  };

  export = unzipper;
}
