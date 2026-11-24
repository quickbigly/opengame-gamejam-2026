<#
.SYNOPSIS
    Builds, tests and runs the game from the command line, with a portable Godot.

.DESCRIPTION
    On first use, downloads a portable copy of Godot and its web export templates into .tools\
    (git-ignored) and checks their SHA-512 checksums. Later runs reuse them. Nothing is installed
    system-wide, and the editor's own template folder isn't touched: export_presets.cfg points
    its custom templates at .tools\.

.EXAMPLE
    .\dev.ps1                 # play the game in a window
.EXAMPLE
    .\dev.ps1 -Setup          # download Godot and the web templates if missing, then import
.EXAMPLE
    .\dev.ps1 -Test           # run the headless test suite (exit code 1 on any failure)
.EXAMPLE
    .\dev.ps1 -Balance        # balance report: seeded bot runs at each skill tier
.EXAMPLE
    .\dev.ps1 -Balance --runs=50 --out=docs/balance-latest.md
.EXAMPLE
    .\dev.ps1 -Sounds         # regenerate the synthesised sounds and music in audio/
.EXAMPLE
    .\dev.ps1 -Shots --out=C:/temp/shots   # screenshot tour of every screen
.EXAMPLE
    .\dev.ps1 -Web            # export the web build to build\web
.EXAMPLE
    .\dev.ps1 -WebTest        # export the test build (persona playtest hooks) to build\web-test
.EXAMPLE
    .\dev.ps1 -Editor         # open the project in the Godot editor
.EXAMPLE
    .\dev.ps1 -Godot --version   # run the Godot console binary with any arguments
.EXAMPLE
    .\dev.ps1 --seed=42       # extra arguments are passed to the game after --
#>
[CmdletBinding()]
param(
    [switch]$Setup,
    [switch]$Test,
    [switch]$Balance,
    [switch]$Sounds,
    [switch]$Shots,
    [switch]$Web,
    [switch]$WebTest,
    [switch]$Editor,
    [switch]$Godot,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = 'Stop'

$GodotVersion = '4.7.2-stable'
$ZipName = "Godot_v${GodotVersion}_win64.exe.zip"
$ZipUrl = "https://github.com/godotengine/godot/releases/download/$GodotVersion/$ZipName"
# From the release's SHA512-SUMS.txt. Change this together with $GodotVersion.
$ZipSha512 = '83decd58fdf67b9d657958a1ae6bf1929c20785315a81effe245874cdc57acb709bf868e00778a96984338c1b29dafdb453c6847747694621c6ecf5da2259993'

$ProjectDir = $PSScriptRoot
$ToolsDir = Join-Path $ProjectDir '.tools'
$GodotDir = Join-Path $ToolsDir "godot-$GodotVersion"
$GodotExe = Join-Path $GodotDir "Godot_v${GodotVersion}_win64.exe"
# The console build prints the game's log and errors to this terminal.
$GodotConsole = Join-Path $GodotDir "Godot_v${GodotVersion}_win64_console.exe"

$TemplatesName = "Godot_v${GodotVersion}_export_templates.tpz"
$TemplatesUrl = "https://github.com/godotengine/godot/releases/download/$GodotVersion/$TemplatesName"
# From the release's SHA512-SUMS.txt. Change this together with $GodotVersion.
$TemplatesSha512 = 'ca4d71c4d7b81dfc15d1a98baa07534aa95b03fdda78a0075b06672e1648d2e5f40980c9adc28d23e1b92e732ee7bf3461997aa804af74ec2fcd7a93ccb84079'
# Only the single-threaded web templates are kept: they need no special server headers.
$TemplatesDir = Join-Path $ToolsDir "export-templates-$GodotVersion"
$WebTemplates = @('web_nothreads_debug.zip', 'web_nothreads_release.zip')
$WebPreset = 'Web'
# Exports go under build\, which holds a .gdignore so Godot never imports what's in it.
$BuildDir = Join-Path $ProjectDir 'build'
$WebDir = Join-Path $ProjectDir 'build\web'
# The same game with the persona playtest hooks on (feature test_hooks; scripts/test_hooks.gd).
$WebTestPreset = 'Web Test'
$WebTestDir = Join-Path $ProjectDir 'build\web-test'
$BuildIdFile = Join-Path $ProjectDir 'build_id.txt'


function Invoke-Download {
    param([string]$Url, [string]$OutFile)
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $previousProgress = $ProgressPreference
    $ProgressPreference = 'SilentlyContinue'  # the progress bar makes Invoke-WebRequest very slow
    try {
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
    } finally {
        $ProgressPreference = $previousProgress
    }
}


function Assert-Checksum {
    param([string]$Path, [string]$Expected)
    $hash = (Get-FileHash -Path $Path -Algorithm SHA512).Hash.ToLowerInvariant()
    if ($hash -ne $Expected) {
        Remove-Item $Path -Force
        throw "Checksum mismatch for $(Split-Path $Path -Leaf); the download was deleted. Expected $Expected, got $hash."
    }
}


function Initialize-ToolsDir {
    New-Item -ItemType Directory -Force $ToolsDir | Out-Null
    # Keep Godot from scanning the downloaded tools as project files.
    $gdignore = Join-Path $ToolsDir '.gdignore'
    if (-not (Test-Path $gdignore)) {
        Set-Content -Path $gdignore -Value '' -Encoding ascii
    }
}


function Install-Godot {
    if ((Test-Path $GodotExe) -and (Test-Path $GodotConsole)) {
        return
    }
    Initialize-ToolsDir
    Write-Host "Downloading Godot $GodotVersion (about 85 MB, first run only)..."
    $zipPath = Join-Path $ToolsDir $ZipName
    Invoke-Download $ZipUrl $zipPath
    Assert-Checksum $zipPath $ZipSha512
    Write-Host 'Checksum OK, unpacking...'
    if (Test-Path $GodotDir) {
        Remove-Item $GodotDir -Recurse -Force
    }
    Expand-Archive -Path $zipPath -DestinationPath $GodotDir
    Remove-Item $zipPath -Force
}


# Godot only publishes the export templates in one archive with every platform's (about
# 1.3 GB), so this downloads it once, keeps the web templates (about 20 MB) and deletes the rest.
function Install-WebTemplates {
    $missing = $WebTemplates | Where-Object { -not (Test-Path (Join-Path $TemplatesDir $_)) }
    if (-not $missing) {
        return
    }
    Initialize-ToolsDir
    $tpzPath = Join-Path $ToolsDir $TemplatesName
    if (-not (Test-Path $tpzPath)) {
        Write-Host "Downloading Godot $GodotVersion export templates (about 1.3 GB, first web build only)..."
        Invoke-Download $TemplatesUrl $tpzPath
    }
    Assert-Checksum $tpzPath $TemplatesSha512
    Write-Host 'Checksum OK, unpacking the web templates...'
    New-Item -ItemType Directory -Force $TemplatesDir | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($tpzPath)
    try {
        foreach ($name in $WebTemplates) {
            $entry = $archive.GetEntry("templates/$name")
            if (-not $entry) {
                throw "$TemplatesName has no templates/$name."
            }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $TemplatesDir $name), $true)
        }
    } finally {
        $archive.Dispose()
    }
    Remove-Item $tpzPath -Force
}


# Godot needs its import cache (.godot\) to resolve class_name scripts and resources. Rebuild
# it on the first run, or when any project file is newer than the cache.
function Update-ProjectCache {
    $cache = Join-Path $ProjectDir '.godot\global_script_class_cache.cfg'
    $stale = -not (Test-Path $cache)
    if (-not $stale) {
        $cacheTime = (Get-Item $cache).LastWriteTimeUtc
        $stale = [bool](Get-ChildItem -Path $ProjectDir -Recurse -Include *.gd, *.gdshader, *.tscn, *.tres, *.png, *.svg, *.wav, *.ogg, project.godot -File |
            Where-Object { $_.FullName -notlike "$ToolsDir*" -and $_.FullName -notlike "$BuildDir*" -and $_.LastWriteTimeUtc -gt $cacheTime } |
            Select-Object -First 1)
    }
    if (-not $stale) {
        return
    }
    Write-Host 'Importing project...'
    $output = & $GodotConsole --headless --path $ProjectDir --import 2>&1
    if ($LASTEXITCODE -ne 0) {
        $output | Write-Host
        throw "Godot import failed with exit code $LASTEXITCODE."
    }
    # Godot leaves the cache untouched when nothing changed; mark it fresh so we don't re-import.
    if (Test-Path $cache) {
        (Get-Item $cache).LastWriteTimeUtc = [DateTime]::UtcNow
    }
}


# The build id: the commit, with "-dirty" when the working tree has changes. The game shows it
# in its state (window.boxedIn.build) and the receipt names it.
function Get-BuildId {
    $commit = (& git -C $ProjectDir rev-parse --short HEAD 2>$null)
    if (-not $commit) {
        return 'nogit'
    }
    $dirty = (& git -C $ProjectDir status --porcelain 2>$null)
    if ($dirty) {
        return "$commit-dirty"
    }
    return $commit
}


# Exports a preset in export_presets.cfg to a folder, with the build id baked in, then writes
# receipt.json beside it: the build id and the SHA-256 of every file, so a test can prove the
# server sent exactly this build.
function Export-Preset {
    param([string]$Preset, [string]$Dir)
    if (Test-Path $Dir) {
        Remove-Item $Dir -Recurse -Force
    }
    New-Item -ItemType Directory -Force $Dir | Out-Null
    New-Item -ItemType File -Force (Join-Path $BuildDir '.gdignore') | Out-Null
    $buildId = Get-BuildId
    [System.IO.File]::WriteAllText($BuildIdFile, $buildId)
    Write-Host "Exporting $Preset ($buildId)..."
    $output = & $GodotConsole --headless --path $ProjectDir --export-release $Preset (Join-Path $Dir 'index.html') 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $Dir 'index.pck'))) {
        $output | Write-Host
        throw "The $Preset export failed (Godot exit code $LASTEXITCODE)."
    }
    $files = [ordered]@{}
    foreach ($file in Get-ChildItem $Dir -File | Sort-Object Name) {
        $files[$file.Name] = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLower()
    }
    $receipt = [ordered]@{ build = $buildId; preset = $Preset; exported = (Get-Date).ToUniversalTime().ToString('o'); files = $files }
    $json = $receipt | ConvertTo-Json -Depth 4
    [System.IO.File]::WriteAllText((Join-Path $Dir 'receipt.json'), $json, (New-Object System.Text.UTF8Encoding $false))
    $sizeMb = [math]::Round(((Get-ChildItem $Dir -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
    Write-Host "Exported to $Dir ($sizeMb MB)"
}


function Export-Web {
    Export-Preset $WebPreset $WebDir
}


Install-Godot

if ($Godot) {
    & $GodotConsole @ExtraArgs
    exit $LASTEXITCODE
}

Update-ProjectCache

if ($Setup) {
    Install-WebTemplates
    Write-Host "Ready: Godot $GodotVersion and the web templates are in $ToolsDir"
} elseif ($Web) {
    Install-WebTemplates
    Export-Web
} elseif ($WebTest) {
    Install-WebTemplates
    Export-Preset $WebTestPreset $WebTestDir
} elseif ($Test) {
    & $GodotConsole --headless --path $ProjectDir --script res://tests/run_tests.gd
} elseif ($Sounds) {
    & $GodotConsole --headless --path $ProjectDir --script res://scripts/dev/make_sounds.gd
    if ($LASTEXITCODE -eq 0) {
        # Import the new files now, so the next run sees them.
        & $GodotConsole --headless --path $ProjectDir --import 2>&1 | Out-Null
    }
} elseif ($Shots) {
    & $GodotConsole --path $ProjectDir res://scenes/dev/shots.tscn -- @ExtraArgs
} elseif ($Balance) {
    & $GodotConsole --headless --path $ProjectDir --script res://scripts/dev/balance.gd -- @ExtraArgs
} elseif ($Editor) {
    & $GodotExe --path $ProjectDir --editor
} elseif ($ExtraArgs) {
    & $GodotConsole --path $ProjectDir -- @ExtraArgs
} else {
    & $GodotConsole --path $ProjectDir
}
exit $LASTEXITCODE
