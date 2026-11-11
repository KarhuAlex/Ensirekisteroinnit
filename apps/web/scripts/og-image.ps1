# Draws public/og.png, the image shown when a link to the site is shared (1200 x 630).
# Windows only: it uses System.Drawing. Run it from the repository root after changing the name or
# the colours, and commit the new PNG:
#   powershell -ExecutionPolicy Bypass -File apps/web/scripts/og-image.ps1 -Out apps/web/public/og.png
# The size is also written into the Open Graph tags (OG_IMAGE in seo.mjs); a test checks they agree.
param([string]$Out)
Add-Type -AssemblyName System.Drawing

$o = [char]0x00F6   # o with diaeresis
$a = [char]0x00E4   # a with diaeresis
$title = "Ensirekister${o}innit"
$line1 = "Henkil${o}autojen ensirekister${o}innit"
$line2 = "ja autokanta Suomessa"
$source = "Avoin data: Traficom ja Tilastokeskus"

$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0b1f33'))

function Brush($hex) { New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex)) }

# brand mark: a green rounded square with a rising line, drawn like the favicon
$markX = 80; $markY = 84; $size = 96; $r = 22
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($markX, $markY, $r, $r, 180, 90)
$path.AddArc($markX + $size - $r, $markY, $r, $r, 270, 90)
$path.AddArc($markX + $size - $r, $markY + $size - $r, $r, $r, 0, 90)
$path.AddArc($markX, $markY + $size - $r, $r, $r, 90, 90)
$path.CloseFigure()
$g.FillPath((Brush '#0e8f78'), $path)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 9
$pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
$scale = $size / 32.0
$points = @(
  (New-Object System.Drawing.PointF ($markX + 6 * $scale), ($markY + 22 * $scale)),
  (New-Object System.Drawing.PointF ($markX + 12 * $scale), ($markY + 14 * $scale)),
  (New-Object System.Drawing.PointF ($markX + 17 * $scale), ($markY + 18 * $scale)),
  (New-Object System.Drawing.PointF ($markX + 26 * $scale), ($markY + 8 * $scale))
)
$g.DrawLines($pen, $points)

# text
$fTitle = New-Object System.Drawing.Font 'Segoe UI Semibold', 78, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fSub = New-Object System.Drawing.Font 'Segoe UI', 38, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fSmall = New-Object System.Drawing.Font 'Segoe UI', 28, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString($title, $fTitle, (Brush '#e6eef6'), 74, 214)
$g.DrawString($line1, $fSub, (Brush '#a3b8cc'), 80, 336)
$g.DrawString($line2, $fSub, (Brush '#a3b8cc'), 80, 388)
$g.DrawString($source, $fSmall, (Brush '#6f8aa5'), 80, 520)

# ring of fuel shares, in the colours of the site's dark theme
$cx = 930; $cy = 315; $outer = 190; $thick = 64
$rect = New-Object System.Drawing.RectangleF ($cx - $outer + $thick / 2), ($cy - $outer + $thick / 2), ($outer * 2 - $thick), ($outer * 2 - $thick)
$segments = @(
  @{ Hex = '#2fd197'; Share = 0.56 },
  @{ Hex = '#5ca6f2'; Share = 0.10 },
  @{ Hex = '#f2b42a'; Share = 0.29 },
  @{ Hex = '#9fb0c2'; Share = 0.05 }
)
$gap = 2.2
$start = -90.0
foreach ($s in $segments) {
  $sweep = 360.0 * $s.Share
  $segPen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($s.Hex)), $thick
  $segPen.StartCap = 'Flat'; $segPen.EndCap = 'Flat'
  $g.DrawArc($segPen, $rect, [single]($start + $gap / 2), [single]($sweep - $gap))
  $start += $sweep
}

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "wrote $Out"
