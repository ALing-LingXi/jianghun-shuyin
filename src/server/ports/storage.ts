export type StoreTextInput = {
  content: string;
  fileName: string;
};

export interface FileStorage {
  saveTextSource(input: StoreTextInput): Promise<string>;
}
