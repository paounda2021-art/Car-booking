# Extract cell signatures from the zip package in memory first (to avoid Excel file lock)
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
$zip = [System.IO.Compression.ZipFile]::OpenRead("d:\Cars\users.xlsx")

$getSignBase64 = {
    param($imagePath)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq $imagePath }
    if ($entry) {
        $stream = $entry.Open()
        $bytes = New-Object byte[] $entry.Length
        $offset = 0
        while ($offset -lt $entry.Length) {
            $read = $stream.Read($bytes, $offset, $entry.Length - $offset)
            if ($read -le 0) { break }
            $offset += $read
        }
        $stream.Close()
        
        $ms = [System.IO.MemoryStream]::new($bytes)
        $tempBmp = [System.Drawing.Bitmap]::new($ms)
        $ms.Close()
        
        # Create a new 32bpp ARGB Bitmap of the same size to support transparency
        $bmp = [System.Drawing.Bitmap]::new($tempBmp.Width, $tempBmp.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        
        # Copy pixels, converting bright background pixels to transparent
        for ($y = 0; $y -lt $tempBmp.Height; $y++) {
            for ($x = 0; $x -lt $tempBmp.Width; $x++) {
                $pixel = $tempBmp.GetPixel($x, $y)
                # Average brightness check
                $brightness = ($pixel.R + $pixel.G + $pixel.B) / 3
                if ($brightness -ge 200) {
                    # Transparent pixel
                    $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                } else {
                    # Keep original color and opacity
                    $bmp.SetPixel($x, $y, $pixel)
                }
            }
        }
        $tempBmp.Dispose()
        
        # Save as transparent PNG
        $outStream = [System.IO.MemoryStream]::new()
        $bmp.Save($outStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $outStream.ToArray()
        $bmp.Dispose()
        $outStream.Close()
        
        $base64 = [System.Convert]::ToBase64String($pngBytes)
        return "data:image/png;base64,$base64"
    }
    return ""
}

$piyawanSign = &$getSignBase64 "xl/media/image1.jpeg"
$saisuneeSign = &$getSignBase64 "xl/media/image2.jpeg"
$chalongSign = &$getSignBase64 "xl/media/image3.jpeg"

$zip.Dispose()

# Now open Excel to read metadata
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open("d:\Cars\users.xlsx")
$sheet = $workbook.Sheets.Item(1)

# Find header columns
$headers = @()
for ($col = 1; $col -le 15; $col++) {
    $val = $sheet.Cells.Item(1, $col).Value2
    if ($val) {
        $headers += $val.ToString().Trim()
    } else {
        break
    }
}

Write-Host "Headers: ($($headers -join ', '))"

$users = @()
$row = 2
while ($true) {
    # Check if employee_id is empty
    $empIdVal = $sheet.Cells.Item($row, 1).Value2
    if (-not $empIdVal) {
        break
    }
    
    $user = [ordered]@{}
    for ($col = 1; $col -le $headers.Count; $col++) {
        $key = $headers[$col - 1]
        if ($col -eq 9 -and $key -eq "email") {
            $key = "manager_email"
        }
        $val = $sheet.Cells.Item($row, $col).Value2
        
        $username = $sheet.Cells.Item($row, 2).Text.Trim()
        # Check sign column (col 10) and override error code with extracted base64 signatures
        if ($col -eq 10) {
            if ($username -eq "piyawan.k") { $val = $piyawanSign }
            elseif ($username -eq "saisunee.p") { $val = $saisuneeSign }
            elseif ($username -eq "chalong.c") { $val = $chalongSign }
            else { $val = "" }
        }
        
        # Override name spelling for chalong.c to match user request
        if ($col -eq 4 -and $username -eq "chalong.c") {
            $val = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("4LiZ4Liy4Lii4LiJ4Lil4Lit4LiHICDguYDguIjguLXguKLguKHguJzguLHguIHguYHguKfguYjguJk="))
        }
        
        # Override roles to reflect L2, L3, L4 permissions
        if ($col -eq 8) {
            if ($username -eq "sakda.a") {
                $val = "admin"
            }
        }
        
        if ($val) {
            $user[$key] = $val.ToString().Trim()
        } else {
            $user[$key] = ""
        }
    }
    $users += $user
    $row++
}

$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$users | ConvertTo-Json -Depth 10 | Out-File -FilePath "d:\Cars\users.json" -Encoding utf8
Write-Host "Successfully converted $($users.Count) users from users.xlsx to users.json"
