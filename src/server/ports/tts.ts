export type SynthesizeSpeechInput = {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  fileName?: string;
  timeoutMs?: number;
};

export type SynthesizeSpeechResult = {
  audioPath: string;
  byteLength: number;
  voice: string;
  rate: string;
  pitch: string;
};

export interface TTSProvider {
  synthesize(input: SynthesizeSpeechInput): Promise<SynthesizeSpeechResult>;
}
