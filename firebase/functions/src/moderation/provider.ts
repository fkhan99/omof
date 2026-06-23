import * as functions from 'firebase-functions';
import { classifyContent, ModerationClassification } from './classifyContent';

export type ModerationProvider = 'rules' | 'openai';

export function getModerationProvider(): ModerationProvider {
  const fromEnv = process.env.MODERATION_PROVIDER;
  if (fromEnv === 'openai') return 'openai';
  return 'rules';
}

/**
 * Classify content using the configured provider.
 * OpenAI path is reserved for future extension — falls back to rules when unconfigured.
 */
export async function classifyWithProvider(text: string): Promise<ModerationClassification> {
  const provider = getModerationProvider();

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      functions.logger.warn('[moderation] OPENAI_API_KEY missing — using rules fallback');
      return classifyContent(text);
    }

    // Future: call OpenAI moderation / classification API.
    functions.logger.info('[moderation] openai provider not implemented — using rules fallback');
    return classifyContent(text);
  }

  return classifyContent(text);
}
