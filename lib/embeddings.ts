// lib/embeddings.ts
import { embed } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_GEMINI_API_KEY!,
})

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: text,
  })

  return embedding
}