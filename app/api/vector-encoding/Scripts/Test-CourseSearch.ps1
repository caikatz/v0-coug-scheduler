<#
.SYNOPSIS
    Interactive test harness for the /api/vector-encoding course search endpoint.
    Shows only a compact summary (prefix/subject, number, title, score) for
    both Current Term (schedule) and Catalog results.
.PARAMETER BaseUrl
    The root URL of the running dev server. Defaults to http://localhost:3000.
#>
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$endpoint = "$BaseUrl/api/vector-encoding"

Write-Host ""
Write-Host "===== Course Search Test Tool =====" -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint"
Write-Host "Returns: Current Term + Catalog summaries"
Write-Host "Type a search query and press Enter."
Write-Host "Type 'quit' or 'exit' to stop."
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

function Write-SummaryTable {
    param(
        [string]$Label,
        [ConsoleColor]$Color,
        [array]$Items,
        [string]$NumberField,
        [string]$TitleField
    )

    $count = if ($Items) { $Items.Count } else { 0 }
    Write-Host "  ====== $Label ($count) ======" -ForegroundColor $Color

    if ($count -eq 0) {
        Write-Host "  (no matches)" -ForegroundColor DarkGray
        Write-Host ""
        return
    }

    $header = "  {0,-10} {1,-8} {2,-8} {3,-50}" -f "Subject", "Number", "Score", "Title"
    Write-Host $header -ForegroundColor DarkCyan
    Write-Host ("  " + ("-" * 78)) -ForegroundColor DarkGray

    foreach ($sc in $Items) {
        $scoreStr = "{0:N4}" -f $sc.score
        $title = $sc.$TitleField
        if ($title -and $title.Length -gt 48) {
            $title = $title.Substring(0, 45) + "..."
        }
        $subj = if ($sc.subject) { $sc.subject.Trim() } else { "" }
        $line = "  {0,-10} {1,-8} {2,-8} {3,-50}" -f $subj, $sc.$NumberField, $scoreStr, $title
        Write-Host $line
    }
    Write-Host ""
}

while ($true) {
    Write-Host "Search> " -NoNewline -ForegroundColor Yellow
    $query = Read-Host

    if ($query -match '^(quit|exit|q)$') {
        Write-Host "Bye!" -ForegroundColor Green
        break
    }

    if ([string]::IsNullOrWhiteSpace($query)) {
        Write-Host "(empty query, skipped)" -ForegroundColor DarkGray
        continue
    }

    $body = @{ query = $query; limit = 5 } | ConvertTo-Json -Compress

    Write-Host ""
    Write-Host "=== Query: $query ===" -ForegroundColor Cyan

    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-RestMethod -Uri $endpoint -Method POST `
            -ContentType "application/json" -Body $body -ErrorAction Stop
        $stopwatch.Stop()

        Write-Host ("Round-trip: " + $stopwatch.ElapsedMilliseconds + " ms") -ForegroundColor DarkGray
        Write-Host ("Total matches: " + $response.count) -ForegroundColor Green
        Write-Host ""

        $schedScored = if ($response.schedule) { $response.schedule.scoredCourses } else { @() }
        $catScored   = if ($response.catalog)  { $response.catalog.scoredCourses }  else { @() }

        Write-SummaryTable -Label "CURRENT TERM RESULTS" -Color Green   `
            -Items $schedScored -NumberField "courseNumber" -TitleField "title"

        Write-SummaryTable -Label "CATALOG RESULTS"      -Color Magenta `
            -Items $catScored   -NumberField "number"       -TitleField "longTitle"
    }
    catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                $errBody = $reader.ReadToEnd()
                Write-Host "Response body: $errBody" -ForegroundColor Red
            }
            catch {
                # ignore stream read errors
            }
        }
    }

    Write-Host ""
}
