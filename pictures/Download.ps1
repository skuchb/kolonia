# download-all-gothic1-portraits-by-id.ps1

$ApiUrl = "https://gothic.fandom.com/pl/api.php"
$CategoryTitle = "Kategoria:Postacie_z_Gothic"

$OutDir = Join-Path $PSScriptRoot "portraits_gothic1"
$ReportPath = Join-Path $PSScriptRoot "portrait_report.json"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Headers = @{
    "User-Agent" = "GothicCardPrototype/0.1"
}

function Invoke-WikiApi {
    param([hashtable]$Params)

    $Params["format"] = "json"
    $Params["formatversion"] = "2"

    $query = ($Params.GetEnumerator() | ForEach-Object {
        "$([uri]::EscapeDataString($_.Key))=$([uri]::EscapeDataString([string]$_.Value))"
    }) -join "&"

    Invoke-RestMethod -Uri "$ApiUrl`?$query" -Headers $Headers -Method Get
}

function Get-CategoryPages {
    $pages = @()
    $continueToken = $null

    do {
        $params = @{
            action  = "query"
            list    = "categorymembers"
            cmtitle = $CategoryTitle
            cmtype  = "page"
            cmlimit = "500"
        }

        if ($continueToken) {
            $params["cmcontinue"] = $continueToken
        }

        $result = Invoke-WikiApi $params
        $pages += $result.query.categorymembers

        if ($result.continue) {
            $continueToken = $result.continue.cmcontinue
        } else {
            $continueToken = $null
        }

    } while ($continueToken)

    return $pages
}

function Get-PageWikitext {
    param([string]$Title)

    $result = Invoke-WikiApi @{
        action = "query"
        prop   = "revisions"
        titles = $Title
        rvprop = "content"
        rvslots = "main"
    }

    if (-not $result.query.pages -or $result.query.pages.Count -eq 0) {
        return $null
    }

    return $result.query.pages[0].revisions[0].slots.main.content
}

function Get-SummonCodeFromWikitext {
    param([string]$Wikitext)

    if (-not $Wikitext) {
        return $null
    }

    $patterns = @(
        'Kod na przywołanie\s*=\s*([A-Za-z]+_\d+_[A-Za-z0-9_]+)',
        'Kod na przywolanie\s*=\s*([A-Za-z]+_\d+_[A-Za-z0-9_]+)',
        'kod\s*=\s*([A-Za-z]+_\d+_[A-Za-z0-9_]+)',
        'spawn\s*=\s*([A-Za-z]+_\d+_[A-Za-z0-9_]+)',
        '([A-Za-z]+_\d+_[A-Za-z0-9_]+)'
    )

    foreach ($pattern in $patterns) {
        if ($Wikitext -match $pattern) {
            return $Matches[1]
        }
    }

    return $null
}

function Get-IdFromSummonCode {
    param([string]$SummonCode)

    if ($SummonCode -match '^[A-Za-z]+_(\d+)_') {
        return $Matches[1]
    }

    return $null
}

function Get-MainPageImage {
    param([string]$Title)

    $result = Invoke-WikiApi @{
        action    = "query"
        titles    = $Title
        prop      = "pageimages"
        piprop    = "original|name"
        redirects = "1"
    }

    if (-not $result.query.pages -or $result.query.pages.Count -eq 0) {
        return $null
    }

    $page = $result.query.pages[0]

    if ($page.original -and $page.original.source) {
        return [pscustomobject]@{
            title = $page.pageimage
            url   = $page.original.source
        }
    }

    return $null
}

function Get-SafeFileName {
    param([string]$Name)

    return ($Name -replace '[\\/:*?"<>|]', '_')
}

$Report = @()

$pages = Get-CategoryPages
Write-Host "Znaleziono stron postaci: $($pages.Count)"

foreach ($page in $pages) {
    $title = $page.title
    Write-Host "Pobieram: $title"

    try {
        $wikitext = Get-PageWikitext $title
        $summonCode = Get-SummonCodeFromWikitext $wikitext
        $id = Get-IdFromSummonCode $summonCode

        if (-not $id) {
            $Report += [pscustomobject]@{
                title = $title
                status = "id_not_found"
                summon_code = $summonCode
                image = $null
                url = $null
                path = $null
            }
            continue
        }

        $mainImage = Get-MainPageImage $title

        if (-not $mainImage) {
            $Report += [pscustomobject]@{
                title = $title
                status = "main_image_not_found"
                summon_code = $summonCode
                id = $id
                image = $null
                url = $null
                path = $null
            }
            continue
        }

        $url = $mainImage.url
        $imageTitle = $mainImage.title

        $extension = [System.IO.Path]::GetExtension(($url -split "\?")[0])

        if (-not $extension) {
            $extension = ".jpg"
        }

        $fileName = "$id$extension"
        $outPath = Join-Path $OutDir $fileName

        Invoke-WebRequest `
            -Uri $url `
            -Headers $Headers `
            -OutFile $outPath

        $Report += [pscustomobject]@{
            title = $title
            status = "downloaded"
            summon_code = $summonCode
            id = $id
            image = $imageTitle
            url = $url
            path = $outPath
        }

        Start-Sleep -Milliseconds 300
    }
    catch {
        $Report += [pscustomobject]@{
            title = $title
            status = "error"
            error = $_.Exception.Message
        }
    }
}

$Report | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $ReportPath

Write-Host "Gotowe."
Write-Host "Obrazki: $OutDir"
Write-Host "Raport: $ReportPath"