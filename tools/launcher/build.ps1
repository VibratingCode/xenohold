# Builds Xenohold.exe (in the game folder) using the C# compiler that ships with Windows.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$ico = Join-Path $here 'xenohold.ico'

# The icon: a steel hex badge with a glowing alien eye in a gun sight, drawn at every size Windows uses (icon.ps1)
& (Join-Path $here 'icon.ps1') -Out $ico

$csc = Get-ChildItem 'C:\Windows\Microsoft.NET\Framework64\v4*\csc.exe' | Select-Object -First 1 -ExpandProperty FullName
$exe = Join-Path $root 'Xenohold.exe'
$src = Join-Path $here 'Launcher.cs'
& $csc /nologo /target:winexe /optimize "/win32icon:$ico" /r:System.Windows.Forms.dll "/out:$exe" "$src"
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
Write-Output "Built $exe"
