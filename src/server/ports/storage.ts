export type StoreTextInput = {
  content: string;
  fileName: string;
  subdirectory?: string;
};

export type StoreBinaryInput = {
  content: Uint8Array;
  fileName: string;
  subdirectory?: string;
};

export interface FileStorage {
  saveTextSource(input: StoreTextInput): Promise<string>;
  saveBinarySource(input: StoreBinaryInput): Promise<string>;
  readTextSource(sourcePath: string): Promise<Uint8Array>;
  saveChunkAudio(input: StoreBinaryInput): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
}
