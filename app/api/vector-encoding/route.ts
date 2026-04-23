import { NextRequest, NextResponse } from 'next/server'
import { formatUnifiedResultsForPrompt } from './format-courses'
import { searchCourses } from './unified-search'

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

    const results = await searchCourses(query, limit)
    const formattedPrompt = formatUnifiedResultsForPrompt(results)

    return NextResponse.json({
      success: true,
      schedule: results.schedule,
      catalog: results.catalog,
      formattedPrompt,
      count: results.schedule.courses.length + results.catalog.courses.length,
    })
  } catch (error) {
    console.error('Error searching courses:', error)
    return NextResponse.json(
      {
        error: 'Failed to search courses',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

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

    const results = await searchCourses(query, limit)
    const formattedPrompt = formatUnifiedResultsForPrompt(results)

    return NextResponse.json({
      success: true,
      schedule: results.schedule,
      catalog: results.catalog,
      formattedPrompt,
      count: results.schedule.courses.length + results.catalog.courses.length,
    })
  } catch (error) {
    console.error('Error searching courses:', error)
    return NextResponse.json(
      {
        error: 'Failed to search courses',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
