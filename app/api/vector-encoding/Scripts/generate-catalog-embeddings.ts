// Dev script: reads catalog.json (catalog.wsu.edu schema), embeds identity fields, writes catalog-embeddings.json
console.log('Script started!')

import { embedText, EMBEDDING_DIMENSIONS } from '@/app/api/vector-encoding/embed'
import { buildCatalogEmbeddingText } from '@/app/api/vector-encoding/catalog-embedding-text'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Raw row from catalog.json — catalog.wsu.edu shape */
type CatalogRecord = Record<string, unknown> & {
  course_id: number
  subject: string
  number: number
  longTitle: string
}

type CatalogWithEmbedding = CatalogRecord & { embedding: number[] }

/** Recursively strip null/undefined values from an object or array. */
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNulls)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null && v !== undefined) {
        out[k] = stripNulls(v)
      }
    }
    return out
  }
  return value
}

async function generateEmbeddings() {
  console.log(' Loading catalog data...')
  console.log(' Directory:', __dirname)

  const catalogPath = path.join(__dirname, '..', 'data', 'catalog.json')
  console.log(' Reading from:', catalogPath)

  let catalogData: unknown
  try {
    const raw = await fs.readFile(catalogPath, 'utf-8')
    const fileContent = raw.replace(/^\uFEFF/, '').trimStart()
    console.log(' File read, size:', fileContent.length)
    catalogData = JSON.parse(fileContent)
  } catch (error) {
    console.error(' Error reading file:', error)
    process.exit(1)
  }

  const courses: CatalogRecord[] = Array.isArray(catalogData) ? catalogData : []

  if (courses.length === 0) {
    console.error(' No catalog courses found!')
    process.exit(1)
  }

  console.log(` Found ${courses.length} catalog courses`)
  console.log(` Embedding dimensions: ${EMBEDDING_DIMENSIONS}\n`)

  const coursesWithEmbeddings: CatalogWithEmbedding[] = []

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i]
    console.log(
      ` [${i + 1}/${courses.length}] Processing: ${course.course_id} — ${course.subject?.trim()} ${course.number} ${course.longTitle}`
    )

    const searchText = buildCatalogEmbeddingText({
      course_id: course.course_id,
      subject: course.subject,
      number: course.number,
      longTitle: course.longTitle,
    })

    try {
      const embedding = await embedText(searchText)
      console.log(`    Embedded (${embedding.length} dimensions)`)

      const cleaned = stripNulls(course) as Record<string, unknown>
      coursesWithEmbeddings.push({
        ...cleaned,
        embedding,
      } as CatalogWithEmbedding)

      if (i < courses.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error(`    Error:`, error)
    }
  }

  console.log(`\n Successfully embedded ${coursesWithEmbeddings.length} catalog courses`)

  const outputPath = path.join(__dirname, '..', 'data', 'catalog-embeddings.json')
  console.log(' Saving to:', outputPath)

  await fs.writeFile(outputPath, JSON.stringify(coursesWithEmbeddings, null, 2), 'utf-8')

  const stats = await fs.stat(outputPath)
  console.log(` Done! File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
}

console.log(' Calling generateEmbeddings...')
generateEmbeddings()
  .then(() => {
    console.log(' Script completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error(' Fatal error:', error)
    process.exit(1)
  })
