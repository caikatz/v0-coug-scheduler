# Scrapes the WSU schedule API for all Pullman course sections,
# groups them by course (prefix + number), and writes courses.json.
#
# API: https://schedules.wsu.edu/api/Data/GetSectionListDTO/{Campus}/{Term}/{Year}/{Subject}
#
# Usage:  pwsh ./Scrape-WSU-Courses.ps1
# Output: courses.json in the same directory

$campus = "Pullman"
$term   = "Fall"
$year   = "2026"

# Prefixes sourced from https://schedules.wsu.edu subject list
$subjects = @(
    "Acctg", "Aero", "AFS", "Ag Ed", "Agri", "AgTM", "AIS", "AMT",
    "Am St", "A S", "Anth", "Arch", "ART", "Asia", "Astr",
    "Ath T", "B A", "B Law", "B E", "Biol", "BIOMS", "BSysE",
    "CAS", "C E", "CES", "Ch E", "Chem", "Chin", "Com",
    "COMHL", "ComJo", "ComSr", "Cpt S", "Crm J", "CropS", "CSSTE",
    "Cst M", "DATA", "DTC",
    "E E", "E M", "E Mic", "EconS", "MTHSC", "EdPsy", "EdRes",
    "Engl", "Engr", "Entom", "Entrp", "Fin",
    "For L", "Fren", "FS", "Ger", "H D", "HBM", "Hist",
    "U H", "Hort", "Hum", "I Bus", "I D", "Univ",
    "Japn", "KNACT", "Kines", "LLT",
    "L A", "Math", "MBioS", "M E", "MGMT", "MgtOp", "Mil S",
    "MIS", "Mktg", "MPS", "MSE", "Mus", "NEP", "Neuro",
    "Phil", "Phys", "Pl P", "Pol S", "PrvSc", "Psych",
    "PUBHL", "SDC", "SHS", "Soc", "SOE", "SoilS",
    "Span", "Sp Ed", "SpMgt", "Stat", "T & L", "Univs",
    "V MS", "V M", "V Mic", "V Pa", "V Ph", "V E",
    "WGSS", "WRITE"
)

function Convert-MilitaryToStandard([string]$dayTime) {
    if (-not $dayTime) { return $dayTime }
    # Matches patterns like "TU,TH12.05-13.20" or "MWF9.10-10.00"
    # Captures: days, startHH, startMM, endHH, endMM
    if ($dayTime -match '^([A-Za-z,]+)(\d{1,2})\.(\d{2})-(\d{1,2})\.(\d{2})$') {
        $days     = $Matches[1]
        $startH   = [int]$Matches[2]
        $startM   = $Matches[3]
        $endH     = [int]$Matches[4]
        $endM     = $Matches[5]

        $startSuf = if ($startH -ge 12) { "PM" } else { "AM" }
        $endSuf   = if ($endH -ge 12) { "PM" } else { "AM" }
        $startH12 = if ($startH -gt 12) { $startH - 12 } elseif ($startH -eq 0) { 12 } else { $startH }
        $endH12   = if ($endH -gt 12) { $endH - 12 } elseif ($endH -eq 0) { 12 } else { $endH }

        return "${days} ${startH12}:${startM} ${startSuf} - ${endH12}:${endM} ${endSuf}"
    }
    return $dayTime
}

$allCourses = @()
$courseId = 1

foreach ($subject in $subjects) {
    $encoded = [Uri]::EscapeDataString($subject)
    $url = "https://schedules.wsu.edu/api/Data/GetSectionListDTO/$campus/$term/$year/$encoded"
    Write-Host "Fetching $subject ... " -NoNewline

    try {
        $response = Invoke-RestMethod $url -ErrorAction Stop
    } catch {
        Write-Host "FAILED ($($_.Exception.Message))"
        continue
    }

    $sections = $response.sections
    if (-not $sections -or $sections.Count -eq 0) {
        Write-Host "0 sections"
        continue
    }

    Write-Host "$($sections.Count) sections"

    # Group sections by courseNumber to produce one course entry per unique course
    $grouped = $sections | Group-Object -Property courseNumber

    # Fields that belong on the course level (shared across all sections)
    $courseFields = @(
        "campus", "year", "term", "prefix", "subject", "courseNumber",
        "title", "courseDescription", "coursePrerequisite",
        "credits", "ger", "diversity", "writing", "ucore", "coop"
    )

    foreach ($group in $grouped) {
        $first = $group.Group[0]

        # Build course-level object from shared fields
        $course = [ordered]@{ course_id = $courseId }
        foreach ($field in $courseFields) {
            $val = $first.$field
            if ($val -is [string]) { $val = $val -replace '\s+$', '' }
            $course[$field] = $val
        }

        # Each section keeps only section-specific fields
        $sectionList = @($group.Group | ForEach-Object {
            $section = [ordered]@{}
            $_.PSObject.Properties | ForEach-Object {
                if ($courseFields -contains $_.Name) { return }
                $val = $_.Value
                if ($val -is [string]) { $val = $val -replace '\s+$', '' }
                if ($_.Name -eq 'dayTime' -and $val -is [string]) {
                    $val = Convert-MilitaryToStandard $val
                }
                $section[$_.Name] = $val
            }
            [PSCustomObject]$section
        })

        $course["sections"] = $sectionList
        $allCourses += [PSCustomObject]$course
        $courseId++
    }

    Start-Sleep -Milliseconds 300
}

Write-Host "`nTotal courses: $($allCourses.Count)"

$outputPath = Join-Path (Join-Path (Join-Path $PSScriptRoot "..") "data") "courses.json"
$json = $allCourses | ConvertTo-Json -Depth 12
# UTF-8 without BOM so Node JSON.parse and other tools don't choke on U+FEFF
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Saved to $outputPath"
