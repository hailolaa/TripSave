Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("d:\Project\TripSave\apps\mobile\images\logo.jpg")
$bmp = New-Object System.Drawing.Bitmap 1024, 1024
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$size = 600
$ratio = $img.Width / $img.Height
if ($ratio -gt 1) {
    $w = $size
    $h = $size / $ratio
} else {
    $w = $size * $ratio
    $h = $size
}
$x = [math]::Round((1024 - $w) / 2)
$y = [math]::Round((1024 - $h) / 2)
$g.DrawImage($img, $x, $y, [math]::Round($w), [math]::Round($h))
$bmp.Save("d:\Project\TripSave\apps\mobile\images\logo_padded.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Host "Image padded successfully."
