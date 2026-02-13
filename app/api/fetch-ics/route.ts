import { NextResponse } from 'next/server'
import { parseICSEvents } from '@/lib/ical-parser'

/**
 * Fetch ICS calendar from URL and parse events.
 * Server-side to bypass CORS (Google Calendar, Outlook, etc. block client fetches).
 */
export async function POST(req: Request) {
  try {
    const { url } = (await req.json()) as { url?: string }

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid url' },
        { status: 400 }
      )
    }

    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json(
        { success: false, error: 'URL must use http or https' },
        { status: 400 }
      )
    }

    // Prevent SSRF - block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid calendar URL' },
        { status: 400 }
      )
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CougScheduler/1.0 (calendar-sync)',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch calendar (${response.status})` },
        { status: 400 }
      )
    }

    const icsContent = await response.text()
    const events = parseICSEvents(icsContent)

    return NextResponse.json({
      success: true,
      events: events.map((e) => ({
        uid: e.uid,
        title: e.title,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        isAllDay: e.isAllDay,
        location: e.location,
      })),
    })
  } catch (err) {
    console.error('ICS fetch error:', err)
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : 'Failed to fetch or parse calendar',
      },
      { status: 500 }
    )
  }
}
