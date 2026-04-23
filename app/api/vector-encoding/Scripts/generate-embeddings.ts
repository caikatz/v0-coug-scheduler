// Dev script: reads courses.json (schedules.wsu.edu schema), embeds identity fields, writes course-embeddings.json
console.log('Script started!')

import { embedText, EMBEDDING_DIMENSIONS } from '@/app/api/vector-encoding/embed'
import { buildCourseEmbeddingText } from '@/app/api/vector-encoding/course-embedding-text'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Raw row from courses.json — schedules.wsu.edu shape */
type CourseRecord = Record<string, unknown> & {
  course_id: number
  prefix: string
  subject: string
  courseNumber: number
  title: string
  sections?: unknown[]
}

type CourseWithEmbedding = CourseRecord & { embedding: number[] }

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
  console.log(' Loading course data...')
  console.log(' Directory:', __dirname)

  const coursesPath = path.join(__dirname, '..', 'data', 'courses.json')
  console.log(' Reading from:', coursesPath)

  let coursesData: unknown
  try {
    const raw = await fs.readFile(coursesPath, 'utf-8')
    const fileContent = raw.replace(/^\uFEFF/, '').trimStart()
    console.log(' File read, size:', fileContent.length)
    coursesData = JSON.parse(fileContent)
  } catch (error) {
    console.error(' Error reading file:', error)
    process.exit(1)
  }

  const courses: CourseRecord[] = Array.isArray(coursesData) ? coursesData : []

  if (courses.length === 0) {
    console.error(' No courses found!')
    process.exit(1)
  }

  console.log(` Found ${courses.length} courses`)
  console.log(` Embedding dimensions: ${EMBEDDING_DIMENSIONS}\n`)

  const coursesWithEmbeddings: CourseWithEmbedding[] = []

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i]
    console.log(
      ` [${i + 1}/${courses.length}] Processing: ${course.course_id} — ${course.subject?.trim()} ${course.courseNumber} ${course.title}`
    )

    const searchText = buildCourseEmbeddingText({
      course_id: course.course_id,
      prefix: course.prefix,
      subject: course.subject,
      courseNumber: course.courseNumber,
      title: course.title,
    })

    try {
      const embedding = await embedText(searchText)
      console.log(`    Embedded (${embedding.length} dimensions)`)

      const cleaned = stripNulls(course) as Record<string, unknown>
      coursesWithEmbeddings.push({
        ...cleaned,
        embedding,
      } as CourseWithEmbedding)

      if (i < courses.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error(`    Error:`, error)
    }
  }

  console.log(`\n Successfully embedded ${coursesWithEmbeddings.length} courses`)

  const outputPath = path.join(__dirname, '..', 'data', 'course-embeddings.json')
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
