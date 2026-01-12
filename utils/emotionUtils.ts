export type ChikaExpression = 'neutral' | 'angry' | 'shock' | 'panic' | 'thinking' | 'clueless';

// Map Vietnamese emotion names to ChikaExpression
const emotionNameMap: Record<string, ChikaExpression> = {
  'Vui': 'neutral', // Happy/cheerful -> neutral (genki)
  'Buồn': 'neutral', // Sad -> neutral (fallback)
  'Giận': 'angry',
  'Sốc': 'shock',
  'Hoảng': 'panic',
  'SuyNghĩ': 'thinking',
  'BốiRối': 'clueless',
  'BìnhThường': 'neutral',
  // English fallbacks
  'Happy': 'neutral',
  'Sad': 'neutral',
  'Angry': 'angry',
  'Shock': 'shock',
  'Surprised': 'shock',
  'Panic': 'panic',
  'Thinking': 'thinking',
  'Clueless': 'clueless',
  'Neutral': 'neutral',
};

export interface EmotionTag {
  emotion: ChikaExpression;
  position: number; // Character position in text
}

/**
 * Parse emotion tags from text and return array of emotions with positions
 * Format: [Vui] text [Buồn] more text
 */
export function parseEmotionTags(text: string): EmotionTag[] {
  const emotionRegex = /\[([^\]]+)\]/g;
  const tags: EmotionTag[] = [];
  let match;
  
  while ((match = emotionRegex.exec(text)) !== null) {
    const emotionName = match[1].trim();
    const mappedEmotion = emotionNameMap[emotionName] || 'neutral';
    tags.push({
      emotion: mappedEmotion,
      position: match.index
    });
  }
  
  return tags;
}

/**
 * Remove emotion tags from text for display
 */
export function removeEmotionTags(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, '').trim();
}

/**
 * Get first emotion from text (for immediate avatar update)
 */
export function getFirstEmotion(text: string): ChikaExpression {
  const tags = parseEmotionTags(text);
  return tags.length > 0 ? tags[0].emotion : 'neutral';
}

/**
 * Get last emotion from text (for final avatar state)
 */
export function getLastEmotion(text: string): ChikaExpression {
  const tags = parseEmotionTags(text);
  return tags.length > 0 ? tags[tags.length - 1].emotion : 'neutral';
}

// Legacy function for backward compatibility (keyword-based detection)
export function detectEmotionFromText(text: string): ChikaExpression {
  // First try emotion tags
  const tags = parseEmotionTags(text);
  if (tags.length > 0) {
    return tags[0].emotion;
  }
  
  // Fallback to keyword matching
  const lowerText = text.toLowerCase();
  
  // Keywords for each emotion
  const angryKeywords = ['peshin', '怒', 'いかり', 'angry', 'mad', 'ムカ', 'whack'];
  const shockKeywords = ['え', 'ええ', 'えー', 'shock', 'surprised', '驚', 'びっくり', 'えっ', 'eh', 'ehh', '!?', '！？'];
  const panicKeywords = ['やば', 'やばい', 'panic', '慌', 'あわ', '大変', 'たいへん', 'wait', 'chotto'];
  const thinkingKeywords = ['うーん', 'んー', 'thinking', '考', '考え', '考える', '思う', 'hmm', 'etou'];
  const cluelessKeywords = ['わか', 'わからない', 'clueless', '分か', '不明', '知らない', 'しらない', 'dunno'];
  
  // Check for emotions in order of priority
  if (angryKeywords.some(kw => lowerText.includes(kw))) {
    return 'angry';
  }
  if (shockKeywords.some(kw => lowerText.includes(kw))) {
    return 'shock';
  }
  if (panicKeywords.some(kw => lowerText.includes(kw))) {
    return 'panic';
  }
  if (thinkingKeywords.some(kw => lowerText.includes(kw))) {
    return 'thinking';
  }
  if (cluelessKeywords.some(kw => lowerText.includes(kw))) {
    return 'clueless';
  }
  
  return 'neutral';
}

export const FALLBACK_AVATAR_URL = "https://pbs.twimg.com/media/E2WXLzOXoAE-ld5.png";

export function getExpressionImagePath(expression: ChikaExpression): string {
  // Use specific JPG images from public/face folder
  // Try multiple path formats for compatibility with different hosting environments
  // Vite serves static files from public folder at root path
  // public/face/chika_neutral.jpg should be served at /face/chika_neutral.jpg
  // For Google AI Studio, try without leading slash first (relative path)
  const basePath = 'face'; // Try relative path first (no leading slash)
  const imageMap: Record<ChikaExpression, string> = {
    neutral: `${basePath}/chika_neutral.jpg`,
    angry: `${basePath}/chika_angry.jpg`,
    shock: `${basePath}/chika_shock.jpg`,
    panic: `${basePath}/chika_panic.jpg`,
    thinking: `${basePath}/chika_thinking.jpg`,
    clueless: `${basePath}/chika_clueless.jpg`,
  };
  
  return imageMap[expression] || imageMap['neutral'];
}