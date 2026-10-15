import { AiProvider } from './types';
import { FallbackProvider } from './providers/fallbackProvider';
import { GroqProvider } from './providers/groqProvider';

export function getAiProvider(): AiProvider {
  const providerType = (process.env.AI_PROVIDER || 'fallback').toLowerCase();

  if (providerType === 'groq' || (providerType !== 'fallback' && process.env.GROQ_API_KEY)) {
    const groq = new GroqProvider();
    if (groq.isAvailable()) {
      return groq;
    }
  }

  // Default to offline deterministic parser
  return new FallbackProvider();
}

export * from './types';
export * from './fallbackParser';
export * from './providers/fallbackProvider';
export * from './providers/groqProvider';
