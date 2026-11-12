$ErrorActionPreference = 'Stop'
try {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
    if (-not $nodePath) {
        $candidates = @(
            "$env:ProgramFiles\nodejs\node.exe",
            "$env:LOCALAPPDATA\Programs\nodejs\node.exe"
        )
        $nodePath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        # Explorer does not inherit Codex's bundled-Node PATH.
        if (-not $nodePath) {
            $runtimes = Get-AppxPackage -Name '*CodexPrimaryRuntime*' -ErrorAction SilentlyContinue |
                Sort-Object Version -Descending
            foreach ($runtime in $runtimes) {
                $candidate = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe'
                if (Test-Path -LiteralPath $candidate -PathType Leaf) { $nodePath = $candidate; break }
            }
        }
    }
    if (-not $nodePath) { throw 'Node.js was not found. Install Node.js or run this launcher from the Codex terminal.' }
    # Synchronous child shares this console. Closing the console ends hosting.
    & $nodePath (Join-Path $PSScriptRoot 'play.mjs') @args
    exit $LASTEXITCODE
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
