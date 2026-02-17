// This is a dev only script used to update courses stored on vercel. run locally then push
// Run locally then push new course-embeddings.
console.log('Script started!')

import { embedText } from '@/app/api/vector-encoding/embed'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface Course {
  course_id: string
  prefix: string
  number: string
  subject: string
  longTitle?: string
  shortTitle: string
  creditsPhrase: string
  requisitePhrase?: string
  typicallyOffered?: string
  description: string
}

interface CourseWithEmbedding extends Course {
  embedding: number[]
}

async function generateEmbeddings() {
  console.log(' Loading course data...')
  console.log(' Directory:', __dirname)
  
const coursesPath = path.join(__dirname, '..', 'data', 'courses.json')
  console.log(' Reading from:', coursesPath)
  
  let coursesData
  try {
    const fileContent = await fs.readFile(coursesPath, 'utf-8')
    console.log(' File read, size:', fileContent.length)
    coursesData = JSON.parse(fileContent)
  } catch (error) {
    console.error(' Error reading file:', error)
    process.exit(1)
  }
  
  const courses: Course[] = Array.isArray(coursesData) ? coursesData : []
  
  if (courses.length === 0) {
    console.error(' No courses found!')
    process.exit(1)
  }
  
  console.log(` Found ${courses.length} courses\n`)
  
  const coursesWithEmbeddings: CourseWithEmbedding[] = []
  
  for (let i = 0; i < courses.length; i++) {
    const course = courses[i]
    console.log(` [${i + 1}/${courses.length}] Processing: ${course.course_id} - ${course.shortTitle}`)
    
    const searchText = `
${course.longTitle || course.shortTitle}
${course.prefix} ${course.number}
${course.subject}
${course.description}
`.trim()
    
    try {
      const embedding = await embedText(searchText)
      console.log(`    Embedded (${embedding.length} dimensions)`)
      
      coursesWithEmbeddings.push({
        ...course,
        embedding
      })
      
      // Delay to avoid rate limits
      if (i < courses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (error) {
      console.error(`    Error:`, error)
    }
  }
  
  console.log(`\n Successfully embedded ${coursesWithEmbeddings.length} courses`)
  
  // Match the filename your search.ts expects
  const outputPath = path.join(__dirname, '..', 'data', 'course-embeddings.json')
  console.log(' Saving to:', outputPath)
  
  await fs.writeFile(
    outputPath,
    JSON.stringify(coursesWithEmbeddings, null, 2),
    'utf-8'
  )
  
  const stats = await fs.stat(outputPath)
  console.log(` Done! File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
}

console.log(' Calling generateEmbeddings...')
generateEmbeddings()
  .then(() => {
    console.log(' Script completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error(' Fatal error:', error)
    process.exit(1)
  })