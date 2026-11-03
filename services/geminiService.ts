
import { GoogleGenAI } from "@google/genai";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
};

export const generateGamerImage = async (prompt: string, aspectRatio: string = "1:1", baseImage?: string) => {
  const ai = getAIClient();
  
  try {
    // Forcefully include the aspect ratio instruction in the text prompt to assist the model
    const enhancedPrompt = `[ASPECT RATIO: ${aspectRatio}] ${prompt}`;
    const parts: any[] = [{ text: enhancedPrompt }];
    
    // If a base image is provided, we send it for image-to-image editing
    if (baseImage) {
      const base64Data = baseImage.split(',')[1];
      parts.unshift({
        inlineData: {
          data: base64Data,
          mimeType: 'image/png',
        },
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    let imageUrl: string | null = null;
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error("No image was generated in the response.");
    }

    return imageUrl;
  } catch (error: any) {
    console.error("Error generating image:", error);
    throw error;
  }
};
