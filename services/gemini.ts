import { GoogleGenAI, Chat, Modality } from "@google/genai";
import { CHIKA_CHAT_INSTRUCTION, Message, ModelType } from "../types";

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
    systemInstruction: CHIKA_CHAT_INSTRUCTION,
    responseMimeType: 'application/json', // Enforce JSON for text chat
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
      parts: [{ text: m.text }] // Note: We only send the main Japanese text back to history to keep context clean
    }));

  return client.chats.create({
    model: modelName,
    config: config,
    history: history
  });
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
  if (!text || !text.trim()) return undefined;
  
  const client = getAI();
  try {
    // The TTS model works best when explicitly told to "Say" the text, 
    // especially for non-English or expressive text, to avoid it interpreting the text as a prompt to answer.
    const promptText = `Say: ${text}`;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    
    // Extract base64 audio
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
        console.warn("TTS: Received response but no audio data found.");
    }
    return audioData;

  } catch (e: any) {
    // Log safe error
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("TTS Generation Error:", errorMessage);
    
    // If it's the specific "non-audio response" error, it means the model refused the prompt.
    // We swallow the error so the chat can continue without audio.
    return undefined;
  }
};