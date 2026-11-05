$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$archivePath = Join-Path (Split-Path -Parent $projectRoot) 'biai-crm-submission.zip'
$stagingPath = Join-Path ([System.IO.Path]::GetTempPath()) ('biai-crm-submission-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stagingPath | Out-Null
try {
    # An explicit allowlist keeps .env, SQLite runtime files and logs out of delivery.
    foreach ($item in @('public','lib','tests','docs','README.md','package.json','server.js','evaluate-ai.js','package-submission.ps1','.env.example','.gitignore')) {
        Copy-Item -LiteralPath (Join-Path $projectRoot $item) -Destination $stagingPath -Recurse
    }
    $sampleDirectory = Join-Path $stagingPath 'data'
    New-Item -ItemType Directory -Path $sampleDirectory | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot 'data/sample-enquiries.json') -Destination $sampleDirectory
    # ZipFile includes dotfiles, including the safe empty-key template.
    if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($stagingPath, $archivePath)
    Write-Output "Created $archivePath"
} finally {
    $resolvedStage = [System.IO.Path]::GetFullPath($stagingPath)
    $resolvedTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if (-not $resolvedStage.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -or -not ([System.IO.Path]::GetFileName($resolvedStage)).StartsWith('biai-crm-submission-')) {
        throw 'Refusing to remove a staging path outside the intended temporary directory.'
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
