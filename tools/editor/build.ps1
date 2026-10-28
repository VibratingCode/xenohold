# Builds XenoholdEditor.exe (in the game folder) using the C# compiler that ships with Windows.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$ico = Join-Path $here 'editor.ico'

# Draw the icon: the game's hex badge in amber, with a grid and a placed block
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)
$hex = @(); for ($i = 0; $i -lt 6; $i++) { $a = [Math]::PI / 3 * $i + [Math]::PI / 6; $hex += New-Object System.Drawing.PointF ([float](128 + 120 * [Math]::Cos($a))), ([float](128 + 120 * [Math]::Sin($a))) }
$g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 18, 16, 12))), $hex)
$amber = [System.Drawing.Color]::FromArgb(255, 255, 184, 64)
$g.DrawPolygon((New-Object System.Drawing.Pen $amber, 10), $hex)
$gp = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 255, 184, 64)), 3
for ($k = 0; $k -le 4; $k++) { $v = 68 + $k * 30; $g.DrawLine($gp, 68, $v, 188, $v); $g.DrawLine($gp, $v, 68, $v, 188) }
$g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 125, 255, 154))), 128, 98, 30, 60)
$g.FillRectangle((New-Object System.Drawing.SolidBrush $amber), 98, 128, 30, 30)
$g.Dispose()
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$fs = [System.IO.File]::Create($ico); $w = New-Object System.IO.BinaryWriter $fs
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]1)
$w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0); $w.Write([Byte]0)
$w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$png.Length); $w.Write([UInt32]22)
$w.Write($png); $w.Close()

$fw = Get-ChildItem 'C:\Windows\Microsoft.NET\Framework64\v4*' -Directory | Select-Object -First 1 -ExpandProperty FullName
$csc = Join-Path $fw 'csc.exe'
$exe = Join-Path $root 'XenoholdEditor.exe'
$src = Join-Path $here 'Editor.cs'
& $csc /nologo /target:winexe /optimize "/win32icon:$ico" /r:System.Windows.Forms.dll "/r:$fw\System.Web.Extensions.dll" "/out:$exe" "$src"
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
Write-Output "Built $exe"
