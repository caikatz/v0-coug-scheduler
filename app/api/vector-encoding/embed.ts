// embed.ts
import { GoogleGenAI } from '@google/genai'

const genAI = new GoogleGenAI({
  apiKey: process.env.NEXT_GEMINI_API_KEY!,
})

export async function embedText(text: string): Promise<number[]> {
  const embeddingRes = await genAI.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  })
  
  const vector = embeddingRes.embeddings?.[0]?.values
  
  if (!vector) {
    throw new Error('Failed to generate embedding')
  }
  
  return vector
}