<#
.SYNOPSIS
    Interactive test harness for the /api/vector-encoding course search endpoint.
    Shows both Current Term (schedule) and Catalog results.
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
Write-Host "Returns: Current Term + Catalog results"
Write-Host "Type a search query and press Enter."
Write-Host "Type 'quit' or 'exit' to stop."
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

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

        # ========== QUICK SUMMARY ==========
        $schedTitles = @()
        $catTitles   = @()
        if ($response.schedule -and $response.schedule.scoredCourses) {
            foreach ($sc in $response.schedule.scoredCourses) {
                $subj = if ($sc.subject) { $sc.subject.Trim() } else { "" }
                $schedTitles += "$subj $($sc.courseNumber) - $($sc.title)"
            }
        }
        if ($response.catalog -and $response.catalog.scoredCourses) {
            foreach ($sc in $response.catalog.scoredCourses) {
                $subj = if ($sc.subject) { $sc.subject.Trim() } else { "" }
                $catTitles += "$subj $($sc.number) - $($sc.longTitle)"
            }
        }

        Write-Host "  === SUMMARY ===" -ForegroundColor White
        if ($schedTitles.Count -gt 0) {
            Write-Host "  Current Term:" -ForegroundColor Green
            foreach ($t in $schedTitles) { Write-Host "    $t" }
        } else {
            Write-Host "  Current Term: (none)" -ForegroundColor DarkGray
        }
        if ($catTitles.Count -gt 0) {
            Write-Host "  Catalog:" -ForegroundColor Magenta
            foreach ($t in $catTitles) { Write-Host "    $t" }
        } else {
            Write-Host "  Catalog: (none)" -ForegroundColor DarkGray
        }
        Write-Host ""

        # ========== CURRENT TERM (SCHEDULE) ==========
        $sched = $response.schedule
        if ($sched -and $sched.scoredCourses -and $sched.scoredCourses.Count -gt 0) {
            Write-Host "  ====== CURRENT TERM RESULTS ($($sched.scoredCourses.Count)) ======" -ForegroundColor Green
            $header = "  {0,-10} {1,-8} {2,-6} {3,-50}" -f "Subject", "Number", "Score", "Title"
            Write-Host $header -ForegroundColor DarkCyan
            Write-Host ("  " + ("-" * 78)) -ForegroundColor DarkGray

            foreach ($sc in $sched.scoredCourses) {
                $scoreStr = "{0:N4}" -f $sc.score
                $titleTrunc = $sc.title
                if ($titleTrunc.Length -gt 48) {
                    $titleTrunc = $titleTrunc.Substring(0, 45) + "..."
                }
                $subj = if ($sc.subject) { $sc.subject.Trim() } else { "" }
                $line = "  {0,-10} {1,-8} {2,-6} {3,-50}" -f $subj, $sc.courseNumber, $scoreStr, $titleTrunc
                Write-Host $line
            }
            Write-Host ""

            if ($sched.courses -and $sched.courses.Count -gt 0) {
                $idx = 1
                foreach ($c in $sched.courses) {
                    $subj = if ($c.subject) { $c.subject.Trim() } else { "" }
                    $heading = "  [$idx] $subj $($c.courseNumber) : $($c.title)"
                    Write-Host $heading -ForegroundColor White
                    Write-Host "      course_id:    $($c.course_id)"
                    if ($c.credits)             { Write-Host "      credits:      $($c.credits)" }
                    if ($c.campus)              { Write-Host "      campus:       $($c.campus)" }
                    if ($c.courseDescription)    { Write-Host "      description:  $($c.courseDescription)" -ForegroundColor DarkGray }
                    if ($c.coursePrerequisite)   { Write-Host "      prereqs:      $($c.coursePrerequisite)" -ForegroundColor DarkYellow }

                    if ($c.sections -and $c.sections.Count -gt 0) {
                        Write-Host "      sections ($($c.sections.Count)):" -ForegroundColor DarkCyan
                        foreach ($sec in $c.sections) {
                            $secJson = $sec | ConvertTo-Json -Compress -Depth 3
                            Write-Host "        $secJson" -ForegroundColor DarkGray
                        }
                    }
                    Write-Host ""
                    $idx++
                }
            }
        } else {
            Write-Host "  ====== CURRENT TERM RESULTS (0) ======" -ForegroundColor DarkGray
            Write-Host "  (no current-term matches)" -ForegroundColor DarkGray
            Write-Host ""
        }

        # ========== CATALOG ==========
        $cat = $response.catalog
        if ($cat -and $cat.scoredCourses -and $cat.scoredCourses.Count -gt 0) {
            Write-Host "  ====== CATALOG RESULTS ($($cat.scoredCourses.Count)) ======" -ForegroundColor Magenta
            $header = "  {0,-10} {1,-8} {2,-6} {3,-50}" -f "Subject", "Number", "Score", "Title"
            Write-Host $header -ForegroundColor DarkCyan
            Write-Host ("  " + ("-" * 78)) -ForegroundColor DarkGray

            foreach ($sc in $cat.scoredCourses) {
                $scoreStr = "{0:N4}" -f $sc.score
                $titleTrunc = $sc.longTitle
                if ($titleTrunc.Length -gt 48) {
                    $titleTrunc = $titleTrunc.Substring(0, 45) + "..."
                }
                $subj = if ($sc.subject) { $sc.subject.Trim() } else { "" }
                $line = "  {0,-10} {1,-8} {2,-6} {3,-50}" -f $subj, $sc.number, $scoreStr, $titleTrunc
                Write-Host $line
            }
            Write-Host ""

            if ($cat.courses -and $cat.courses.Count -gt 0) {
                $idx = 1
                foreach ($c in $cat.courses) {
                    $subj = if ($c.subject) { $c.subject.Trim() } else { "" }
                    $heading = "  [$idx] $subj $($c.number) : $($c.longTitle)"
                    Write-Host $heading -ForegroundColor White
                    Write-Host "      course_id:      $($c.course_id)"
                    if ($c.creditsPhrase)      { Write-Host "      credits:        $($c.creditsPhrase)" }
                    if ($c.prefixTitle)        { Write-Host "      department:     $($c.prefixTitle)" }
                    if ($c.typicallyOffered)   { Write-Host "      offered:        $($c.typicallyOffered)" }
                    if ($c.description)        { Write-Host "      description:    $($c.description)" -ForegroundColor DarkGray }
                    if ($c.requisitePhrase)    { Write-Host "      prereqs:        $($c.requisitePhrase)" -ForegroundColor DarkYellow }
                    Write-Host ""
                    $idx++
                }
            }
        } else {
            Write-Host "  ====== CATALOG RESULTS (0) ======" -ForegroundColor DarkGray
            Write-Host "  (no catalog matches)" -ForegroundColor DarkGray
            Write-Host ""
        }

        # Formatted prompt sent to the AI
        if ($response.formattedPrompt) {
            Write-Host "  ====== FORMATTED PROMPT (what the AI sees) ======" -ForegroundColor Yellow
            Write-Host $response.formattedPrompt -ForegroundColor DarkGray
        }

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
