
export interface GifGenerationState {
  isLoading: boolean;
  error: string | null;
  gifUrl: string | null;
  heroImage: string | null;
  multiHeroImages: string[];
  heroWidth: number;
  heroHeight: number;
  multiHeroSizes: { w: number; h: number }[];
  isMultiSku: boolean;
  text: string;
  topText: string;
  bottomText: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  isDarkMode: boolean;
  history: string[];
}

export enum AspectRatio {
  SQUARE = "1:1",
  LANDSCAPE = "16:9",
  PORTRAIT = "9:16",
}
