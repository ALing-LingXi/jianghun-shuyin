export type StoreTextInput = {
  content: string;
  fileName: string;
  subdirectory?: string;
};

export interface FileStorage {
  saveTextSource(input: StoreTextInput): Promise<string>;
  readTextSource(sourcePath: string): Promise<Uint8Array>;
}
