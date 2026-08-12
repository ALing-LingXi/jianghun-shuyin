export type AssemblePartAudioInput = {
  partId: string;
  chunkAudioPaths: string[];
  fileName?: string;
};

export type AssemblePartAudioResult = {
  audioPath: string;
  durationSeconds: number;
};

export interface AudioAssembler {
  checkAvailable(): Promise<void>;
  assemblePart(input: AssemblePartAudioInput): Promise<AssemblePartAudioResult>;
  readDurationSeconds(audioPath: string): Promise<number>;
}
