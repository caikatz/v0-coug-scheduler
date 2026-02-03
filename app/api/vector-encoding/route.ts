// app/api/search-courses/route.ts
console.log("Script started...");
import { NextRequest, NextResponse } from 'next/server'
import { formatCoursesForPrompt } from './format-courses'
import { findRelevantCourses } from './course-search'

export const runtime = 'edge' // Optional: use edge runtime for faster cold starts

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, limit = 5 } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    // Find relevant courses using semantic search
    const courses = await findRelevantCourses(query, limit)

    // Format for AI prompt (optional)
    const formattedPrompt = formatCoursesForPrompt(courses)

    return NextResponse.json({
      success: true,
      courses,
      formattedPrompt,
      count: courses.length
    })
  } catch (error) {
    console.error('Error searching courses:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search courses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Optional: Support GET requests with query params
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const courses = await findRelevantCourses(query, limit)
    const formattedPrompt = formatCoursesForPrompt(courses)

    return NextResponse.json({
      success: true,
      courses,
      formattedPrompt,
      count: courses.length
    })
  } catch (error) {
    console.error('Error searching courses:', error)
    return NextResponse.json(
      { 
        error: 'Failed to search courses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}