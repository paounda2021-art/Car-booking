Add-Type -AssemblyName System.Drawing

$imgPath = "C:\Users\FMO-10\.gemini\antigravity\brain\2eb46ce1-d9ca-4054-ba81-19315170318e\media__1787408678735.jpg"
$outPath = "C:\apps\car-booking\piyawan_sig_transparent.png"

$bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
$transparentBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)

for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $pixel = $bmp.GetPixel($x, $y)
        # If pixel is near white/light grey, make it transparent
        if ($pixel.R -gt 180 -and $pixel.G -gt 180 -and $pixel.B -gt 180) {
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            # Enhance blue ink color crispness
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $pixel.R, $pixel.G, $pixel.B))
        }
    }
}

$transparentBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$transparentBmp.Dispose()
Write-Host "Transparent PNG created successfully at: $outPath"
