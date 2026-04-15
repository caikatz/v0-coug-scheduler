# Scrapes the WSU catalog API for all Pullman course entries
# and writes catalog.json with course metadata (descriptions, prereqs, etc.).
#
# API: https://catalog.wsu.edu/api/Data/GetCoursesBySubject/{SUBJECT}/Pullman
#
# Usage:  pwsh ./Scrape-WSU-Catalog.ps1
# Output: catalog.json in ../data/

$subjects = @(
    "ACCTG", "AERO", "AFS", "AG_ED", "AGING", "AGRI", "AGTM", "AIS", "AMDT",
    "AMER_ST", "ANIM_SCI", "ANTH", "ARCH", "ART", "ASIA", "ASTRONOM",
    "ATH_T", "B_A", "B_LAW", "BIO_ENG", "BIOLOGY", "BIOMDSCI", "BSYSE",
    "CAS", "CE", "CES", "CHE", "CHEM", "CHINESE", "CLASSICS", "COM",
    "COMHLTH", "COMJOUR", "COMSTRAT", "CON_E", "COUN_PSY", "CPT_S",
    "CRM_J", "CROP_SCI", "CSSTE", "CST_M", "DATA", "DESIGN", "DTC",
    "E_E", "E_M", "E_MIC", "ECONS", "ED_AD", "ED_MTHSC", "ED_PSYCH",
    "ED_RES", "ENGLISH", "ENGR", "ENTOM", "ENTRP", "FIN", "FMT",
    "FOR_LANG", "FRENCH", "FS", "GERMAN", "H_D", "HBM", "HISTORY",
    "HONORS", "HORT", "HUMANITY", "I_BUS", "I_D", "INTERDIS", "IPM",
    "ITALIAN", "JAPANESE", "KIN_ACTV", "KINES", "LATIN", "LLT",
    "LND_ARCH", "MATH", "MBIOS", "ME", "MGMT", "MGTOP", "MIL_SCI",
    "MIS", "MIT", "MKTG", "MPS", "MSE", "MUS", "NAV_SCI", "NEUROSCI",
    "PHIL", "PHYSICS", "PL_P", "POL_S", "PREV_SCI", "PSYCH",
    "PUBHLTH", "SAFP", "SCIENCE", "SDC", "SOC", "SOE", "SOIL_SCI",
    "SPANISH", "SPEC_ED", "SPMGT", "STAT", "TCH_LRN", "UNIV",
    "VET_CLIN", "VET_MED", "VET_MICR", "VET_PATH", "VET_PH",
    "WGSS", "WRITE"
)

$allCourses = @()
$courseId = 1

$courseWhitelist = @(
    "subject",
    "prefixTitle",
    "number",
    "longTitle",
    "shortTitle",
    "creditsPhrase",
    "requisitePhrase",
    "description",
    "typicallyOffered"
)

foreach ($subject in $subjects) {
    $url = "https://catalog.wsu.edu/api/Data/GetCoursesBySubject/$subject%20%20%20/Pullman?u=e697cc9b16e54c16b13bfe1a1def1402"
    Write-Host "Fetching $subject ... " -NoNewline

    try {
        $response = Invoke-RestMethod $url -ErrorAction Stop
    } catch {
        Write-Host "FAILED ($($_.Exception.Message))"
        continue
    }

    if (-not $response -or $response.Count -eq 0) {
        Write-Host "0 courses"
        continue
    }

    Write-Host "$($response.Count) courses"

    $response | ForEach-Object {
        $course = $_ | Select-Object $courseWhitelist

        # If creditsPhrase is not strictly a number, set it to null
        if ($course.creditsPhrase -notmatch '^\d+(\.\d+)?$') {
            $course.creditsPhrase = $null
        }

        # Trim trailing whitespace from string fields
        foreach ($field in $courseWhitelist) {
            $val = $course.$field
            if ($val -is [string]) {
                $course.$field = $val -replace '\s+$', ''
            }
        }

        $course | Add-Member -NotePropertyName course_id -NotePropertyValue $courseId
        $courseId++

        $allCourses += $course
    }

    Start-Sleep -Milliseconds 500
}

Write-Host "`nTotal catalog courses: $($allCourses.Count)"

$outputPath = Join-Path (Join-Path (Join-Path $PSScriptRoot "..") "data") "catalog.json"
$json = $allCourses | ConvertTo-Json -Depth 4
# UTF-8 without BOM
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Saved to $outputPath"
