# Draws the Xenohold icon at every size Windows asks for (16 to 256 px) and writes a multi-size .ico:
# a bevelled steel hex badge, a dark hex-grid field, and a glowing slit-pupil alien eye in a gun sight.
# Small sizes drop the fine detail so the eye still reads.
#   icon.ps1 -Out xenohold.ico [-Preview preview.png]
param([string]$Out, [string]$Preview = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function C([int]$a, [int]$r, [int]$g, [int]$b) { [System.Drawing.Color]::FromArgb($a, $r, $g, $b) }
function P([double]$x, [double]$y) { New-Object System.Drawing.PointF ([float]$x), ([float]$y) }
function Hex([double]$cx, [double]$cy, [double]$r) {
  $pts = @(); for ($i = 0; $i -lt 6; $i++) { $a = [Math]::PI / 3 * $i + [Math]::PI / 6; $pts += (P ($cx + $r * [Math]::Cos($a)) ($cy + $r * [Math]::Sin($a))) }
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath; $gp.AddPolygon([System.Drawing.PointF[]]$pts); return $gp
}
function Radial($path, $center, $mid) {
  $b = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $b.CenterColor = $center; $b.SurroundColors = [System.Drawing.Color[]]@($mid); return $b
}

function Draw([int]$S) {
  $bmp = New-Object System.Drawing.Bitmap $S, $S, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'; $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::Transparent)
  $k = $S / 256.0; $cx = $S / 2.0; $cy = $S / 2.0
  $small = $S -le 32; $tiny = $S -le 20

  # outer glow around the badge
  if (-not $small) { for ($i = 6; $i -ge 1; $i--) { $hp = Hex $cx $cy ((118 + $i * 1.6) * $k); $g.FillPath((New-Object System.Drawing.SolidBrush (C (10 + (7 - $i) * 6) 90 255 140)), $hp) } }
  # steel rim: a vertical gradient, lighter at the top
  $rimR = ($(if ($small) { 124 } else { 118 })) * $k
  $rim = Hex $cx $cy $rimR
  $rb = New-Object System.Drawing.Drawing2D.LinearGradientBrush ((P 0 ($cy - $rimR - 1))), ((P 0 ($cy + $rimR + 1))), (C 255 150 164 172), (C 255 38 46 54); $rb.WrapMode = 'TileFlipXY'
  $g.FillPath($rb, $rim)
  # inner field: dark green-black, a little lighter in the middle
  $inR = $rimR - ($(if ($small) { 26 } else { 17 })) * $k
  $field = Hex $cx $cy $inR
  $g.FillPath((Radial $field (C 255 18 44 34) (C 255 5 10 9)), $field)
  # a faint hex grid inside the field
  if (-not $small) {
    $g.SetClip($field)
    $gridPen = New-Object System.Drawing.Pen (C 38 110 255 160), ([float](1.3 * $k))
    $hr = 15 * $k; $w = [Math]::Sqrt(3) * $hr
    for ($row = -9; $row -le 9; $row++) { for ($col = -9; $col -le 9; $col++) {
      $x = $cx + $col * $w + ($row % 2) * $w / 2; $y = $cy + $row * $hr * 1.5
      $g.DrawPath($gridPen, (Hex $x $y $hr))
    } }
    $g.ResetClip()
  }
  # bevel: a bright line inside the rim, a dark one outside the field
  $g.DrawPath((New-Object System.Drawing.Pen (C 255 125 255 154), ([float]([Math]::Max(1.2, 4.5 * $k)))), (Hex $cx $cy ($inR + 1.5 * $k)))
  if (-not $small) { $g.DrawPath((New-Object System.Drawing.Pen (C 200 10 14 18), ([float](3 * $k))), $rim) }
  # rivets on the rim corners
  if (-not $small) { for ($i = 0; $i -lt 6; $i++) { $a = [Math]::PI / 3 * $i + [Math]::PI / 6; $rx = $cx + ($rimR - 8.5 * $k) * [Math]::Cos($a); $ry = $cy + ($rimR - 8.5 * $k) * [Math]::Sin($a)
      $g.FillEllipse((New-Object System.Drawing.SolidBrush (C 255 30 36 42)), [float]($rx - 4 * $k), [float]($ry - 4 * $k), [float](8 * $k), [float](8 * $k))
      $g.FillEllipse((New-Object System.Drawing.SolidBrush (C 255 200 212 220)), [float]($rx - 2.6 * $k), [float]($ry - 3 * $k), [float](4 * $k), [float](4 * $k)) } }

  # the gun sight round the eye
  if (-not $tiny) {
    $sr = 78 * $k; $sp = New-Object System.Drawing.Pen (C 150 125 255 154), ([float]([Math]::Max(1, 3 * $k)))
    if (-not $small) { $g.DrawEllipse($sp, [float]($cx - $sr), [float]($cy - $sr), [float](2 * $sr), [float](2 * $sr)) }
    $tp = New-Object System.Drawing.Pen (C 230 125 255 154), ([float]([Math]::Max(1.4, 5 * $k)))
    foreach ($d in @(@(0, -1), @(0, 1), @(-1, 0), @(1, 0))) {
      $in = $(if ($d[1] -eq 0) { $sr - 2 * $k } else { $sr - 12 * $k }); $x0 = $cx + $d[0] * $in; $y0 = $cy + $d[1] * $in; $x1 = $cx + $d[0] * ($sr + 9 * $k); $y1 = $cy + $d[1] * ($sr + 9 * $k)
      if (-not $small -or $d[1] -eq 0) { $g.DrawLine($tp, [float]$x0, [float]$y0, [float]$x1, [float]$y1) }
    }
  }

  # the eye: an almond, glow behind it
  $ew = ($(if ($small) { 86 } else { 68 })) * $k; $eh = ($(if ($small) { 46 } else { 40 })) * $k
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath; $glow.AddEllipse([float]($cx - $ew * 1.35), [float]($cy - $eh * 1.9), [float](2.7 * $ew), [float](3.8 * $eh))
  $g.FillPath((Radial $glow (C 170 140 255 110) (C 0 60 255 120)), $glow)
  $eye = New-Object System.Drawing.Drawing2D.GraphicsPath
  $eye.AddBezier((P ($cx - $ew) $cy), (P ($cx - $ew * 0.45) ($cy - $eh * 1.25)), (P ($cx + $ew * 0.45) ($cy - $eh * 1.25)), (P ($cx + $ew) $cy))
  $eye.AddBezier((P ($cx + $ew) $cy), (P ($cx + $ew * 0.45) ($cy + $eh * 1.25)), (P ($cx - $ew * 0.45) ($cy + $eh * 1.25)), (P ($cx - $ew) $cy))
  $eye.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush (C 255 12 26 10)), $eye)
  $g.SetClip($eye)
  # iris: acid green going yellow at the middle
  $ir = $eh * 1.05
  $iris = New-Object System.Drawing.Drawing2D.GraphicsPath; $iris.AddEllipse([float]($cx - $ir), [float]($cy - $ir), [float](2 * $ir), [float](2 * $ir))
  $ib = Radial $iris (C 255 236 255 120) (C 255 40 170 60)
  $ib.CenterPoint = (P $cx ($cy + $ir * 0.1))
  $g.FillPath($ib, $iris)
  if (-not $small) {
    $vp = New-Object System.Drawing.Pen (C 110 10 60 20), ([float](1.6 * $k))
    for ($i = 0; $i -lt 18; $i++) { $a = [Math]::PI * 2 * $i / 18; $g.DrawLine($vp, [float]($cx + [Math]::Cos($a) * $ir * 0.35), [float]($cy + [Math]::Sin($a) * $ir * 0.35), [float]($cx + [Math]::Cos($a) * $ir * 0.95), [float]($cy + [Math]::Sin($a) * $ir * 0.95)) }
    $g.DrawEllipse((New-Object System.Drawing.Pen (C 220 10 40 14), ([float](3 * $k))), [float]($cx - $ir), [float]($cy - $ir), [float](2 * $ir), [float](2 * $ir))
  }
  # slit pupil
  $pw = ($(if ($small) { 9 } else { 11 })) * $k; $ph = $eh * 1.02
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (C 255 4 6 4)), [float]($cx - $pw), [float]($cy - $ph), [float](2 * $pw), [float](2 * $ph))
  # lid shadow along the top of the almond
  if (-not $small) { $lid = New-Object System.Drawing.Drawing2D.LinearGradientBrush ((P 0 ($cy - $eh * 1.3))), ((P 0 ($cy - $eh * 0.1))), (C 150 0 0 0), (C 0 0 0 0); $lid.WrapMode = 'TileFlipXY'; $g.FillRectangle($lid, [float]($cx - $ew), [float]($cy - $eh * 1.3), [float](2 * $ew), [float]($eh * 1.15)) }
  $g.ResetClip()
  $g.DrawPath((New-Object System.Drawing.Pen (C 255 150 255 150), ([float]([Math]::Max(1, 2.5 * $k)))), $eye)
  # the shine
  $hs = ($(if ($small) { 8 } else { 9 })) * $k
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (C 235 255 255 255)), [float]($cx + $ir * 0.28), [float]($cy - $ir * 0.62), [float](1.4 * $hs), [float]($hs))
  # gloss over the top half of the badge
  if (-not $small) {
    $g.SetClip($rim)
    $gl = New-Object System.Drawing.Drawing2D.LinearGradientBrush ((P 0 ($cy - $rimR))), ((P 0 ($cy + 0.1 * $rimR))), (C 60 255 255 255), (C 0 255 255 255); $gl.WrapMode = 'TileFlipXY'
    $g.FillEllipse($gl, [float]($cx - $rimR * 1.3), [float]($cy - $rimR * 1.55), [float](2.6 * $rimR), [float](1.6 * $rimR))
    $g.ResetClip()
  }
  $g.Dispose()
  return $bmp
}

$sizes = 16, 20, 24, 32, 40, 48, 64, 96, 128, 256
$pngs = @()
foreach ($s in $sizes) { $b = Draw $s; $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $pngs += , $ms.ToArray(); $b.Dispose() }
$fs = [System.IO.File]::Create($Out); $w = New-Object System.IO.BinaryWriter $fs
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$off = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $d = if ($s -ge 256) { 0 } else { $s }
  $w.Write([Byte]$d); $w.Write([Byte]$d); $w.Write([Byte]0); $w.Write([Byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32); $w.Write([UInt32]$pngs[$i].Length); $w.Write([UInt32]$off)
  $off += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Close()

# a sheet of every size on a dark and a light background, to look at
if ($Preview) {
  $W = 0; foreach ($s in $sizes) { $W += $s + 12 }
  $sheet = New-Object System.Drawing.Bitmap ($W + 12), (2 * 256 + 36)
  $g = [System.Drawing.Graphics]::FromImage($sheet)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush (C 255 32 32 36)), 0, 0, $sheet.Width, 280)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush (C 255 236 238 240)), 0, 280, $sheet.Width, $sheet.Height - 280)
  $x = 12
  foreach ($s in $sizes) { $b = Draw $s; $g.DrawImage($b, $x, 12 + 256 - $s); $g.DrawImage($b, $x, 292 + 256 - $s); $x += $s + 12; $b.Dispose() }
  $g.Dispose(); $sheet.Save($Preview, [System.Drawing.Imaging.ImageFormat]::Png)
}
Write-Output "Icon: $Out ($($sizes.Count) sizes)"
