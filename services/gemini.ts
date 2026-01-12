import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { CHIKA_SYSTEM_INSTRUCTION, Message, ModelType } from "../types";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const createChatSession = (modelType: ModelType, previousMessages: Message[]): Chat => {
  const client = getAI();
  
  const modelName = modelType === 'thinking' 
    ? 'gemini-3-pro-preview' 
    : 'gemini-3-flash-preview';

  const config: any = {
    systemInstruction: CHIKA_SYSTEM_INSTRUCTION,
  };

  if (modelType === 'thinking') {
    config.thinkingConfig = {
      thinkingBudget: 16384 // Moderate budget for responsiveness
    };
  }

  // Transform simple message history to Gemini Content format
  // We filter out thinking/error messages and ensure alternating user/model
  const history = previousMessages
    .filter(m => m.id !== 'init' && m.id !== 'thinking' && !m.id.includes('error'))
    .map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

  return client.chats.create({
    model: modelName,
    config: config,
    history: history
  });
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  const client = getAI();
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is often good for female voices
          },
        },
      },
    });
    
    // Extract base64 audio
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) {
    console.error("TTS Generation Error:", e);
    return undefined;
  }
};
