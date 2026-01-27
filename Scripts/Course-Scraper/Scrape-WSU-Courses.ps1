$subjects = @( "ACCTG", "AERO", "AFS", "AG_ED", "AGING", "AGRI", "AGTM", "AIS", "AMDT",
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
               "WGSS", "WRITE" )

$allCourses = @()
$courseId = 1

$courseWhitelist = @(
    "subject",
    "prefixTitle",
    "prefixDescription",
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
    Write-Host "Fetching $subject..."

    $response = Invoke-RestMethod $url

    $response | ForEach-Object {
        $course = $_ | Select-Object $courseWhitelist

        # If creditsPhrase is not strictly a number, set it to null
        if ($course.creditsPhrase -notmatch '^\d+(\.\d+)?$') {
            $course.creditsPhrase = $null
        }

        # assign a REAL integer, not a scriptblock
        $course | Add-Member -NotePropertyName course_id -NotePropertyValue $courseId
        $courseId++

        $allCourses += $course
    }

    Start-Sleep -Milliseconds 500
}

$allCourses | ConvertTo-Json -Depth 4 | Set-Content courses.json