# LingDian 本地开发启动：backend / uniapp / web
# 用法: .\start.ps1 <命令>
#   backend - 启动 Nest 后端（npm run start:dev）
#   uniapp  - 启动 uni-app H5 开发（npm run dev:h5）
#   web     - 启动 web 前端（优先 pnpm，否则 npm）
#   all     - 在新窗口中同时启动上述三项
#   help    - 显示说明（默认）

param(
    [Parameter(Position = 0)]
    [ValidateSet('backend', 'uniapp', 'web', 'all', 'help')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$DirBackend = Join-Path $Root 'backend'
$DirUni = Join-Path $Root 'uniapp'
$DirWeb = Join-Path $Root 'web'

function Show-Help {
    Write-Host 'LingDian 启动脚本'
    Write-Host ''
    Write-Host '  .\start.ps1 backend  启动 Nest 后端'
    Write-Host '  .\start.ps1 uniapp   启动 uni-app（H5 开发服务器）'
    Write-Host '  .\start.ps1 web      启动 web（Vite）'
    Write-Host '  .\start.ps1 all      在新 PowerShell 窗口中同时启动 backend / uniapp / web'
    Write-Host '  .\start.ps1 help     显示本说明'
    Write-Host ''
    Write-Host '首次使用前请在对应目录安装依赖：'
    Write-Host '  cd backend; npm install'
    Write-Host '  cd uniapp; npm install'
    Write-Host '  cd web; pnpm install   （或 npm install）'
}

function Invoke-BackendDev {
    Set-Location $DirBackend
    npm run start:dev
}

function Invoke-WebDev {
    if (Test-Path (Join-Path $DirWeb 'pnpm-lock.yaml')) {
        if (Get-Command pnpm -ErrorAction SilentlyContinue) {
            Set-Location $DirWeb
            pnpm run dev
            return
        }
    }
    Set-Location $DirWeb
    npm run dev
}

switch ($Command) {
    'help' {
        Show-Help
    }
    'backend' {
        Invoke-BackendDev
    }
    'uniapp' {
        Set-Location $DirUni
        npm run dev:h5
    }
    'web' {
        Invoke-WebDev
    }
    'all' {
        $psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        if (-not (Test-Path -LiteralPath $psExe)) { $psExe = 'powershell.exe' }
        Start-Process $psExe -ArgumentList @(
            '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', (Join-Path $Root 'start.ps1'), 'backend'
        )
        Start-Process $psExe -ArgumentList @(
            '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', (Join-Path $Root 'start.ps1'), 'uniapp'
        )
        Start-Process $psExe -ArgumentList @(
            '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', (Join-Path $Root 'start.ps1'), 'web'
        )
        Write-Host '已打开三个窗口：backend、uniapp（H5）与 web。关闭对应窗口即可停止服务。'
    }
}
