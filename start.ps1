# LingDian local development launcher.
# Usage:
#   .\start.ps1 dev      Start api + admin + uniapp through pnpm workspace
#   .\start.ps1 api      Start NestJS API service
#   .\start.ps1 admin    Start admin console
#   .\start.ps1 uniapp   Start uni-app H5
#   .\start.ps1 web      Start web app
#   .\start.ps1 all      Open api/admin/uniapp in separate PowerShell windows
#   .\start.ps1 help     Show help

param(
    [Parameter(Position = 0)]
    [ValidateSet('dev', 'api', 'backend', 'admin', 'uniapp', 'miniapp', 'web', 'all', 'help')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

function Show-Help {
    Write-Host 'LingDian launcher'
    Write-Host ''
    Write-Host 'Commands:'
    Write-Host '  .\start.ps1 dev      Start api + admin + uniapp in this terminal'
    Write-Host '  .\start.ps1 api      Start API service (backend/)'
    Write-Host '  .\start.ps1 admin    Start admin console'
    Write-Host '  .\start.ps1 uniapp   Start uni-app H5'
    Write-Host '  .\start.ps1 web      Start web app'
    Write-Host '  .\start.ps1 all      Open api/admin/uniapp in separate PowerShell windows'
    Write-Host '  .\start.ps1 help     Show this help'
    Write-Host ''
    Write-Host 'Aliases: backend -> api, miniapp -> uniapp'
    Write-Host ''
    Write-Host 'First run:'
    Write-Host '  pnpm install'
    Write-Host '  pnpm prisma:generate'
}

function Assert-Pnpm {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        throw 'pnpm is required. Install it with: corepack enable; corepack prepare pnpm@11.7.0 --activate'
    }
}

function Invoke-PnpmScript {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptName
    )

    Assert-Pnpm
    Set-Location $Root
    pnpm run $ScriptName
}

function Start-DetachedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ChildCommand
    )

    $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if (-not (Test-Path -LiteralPath $psExe)) {
        $psExe = 'powershell.exe'
    }

    Start-Process $psExe -ArgumentList @(
        '-NoExit',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        (Join-Path $Root 'start.ps1'),
        $ChildCommand
    )
}

switch ($Command) {
    'help' {
        Show-Help
    }
    'dev' {
        Invoke-PnpmScript 'dev'
    }
    'api' {
        Invoke-PnpmScript 'dev:api'
    }
    'backend' {
        Invoke-PnpmScript 'dev:api'
    }
    'admin' {
        Invoke-PnpmScript 'dev:admin'
    }
    'uniapp' {
        Invoke-PnpmScript 'dev:uniapp'
    }
    'miniapp' {
        Invoke-PnpmScript 'dev:uniapp'
    }
    'web' {
        Invoke-PnpmScript 'dev:web'
    }
    'all' {
        Assert-Pnpm
        Start-DetachedCommand 'api'
        Start-DetachedCommand 'admin'
        Start-DetachedCommand 'uniapp'
        Write-Host 'Opened api, admin, and uniapp in separate PowerShell windows.'
    }
}
