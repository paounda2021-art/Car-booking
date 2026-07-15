[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $workbook = $excel.Workbooks.Open('d:\Cars\users.xlsx')
    $sheet = $workbook.Sheets.Item(1)
    $row = 2
    $updatedCount = 0
    
    while ($true) {
        $empId = $sheet.Cells.Item($row, 1).Value2
        if (-not $empId) { break }
        
        # 1. Update Username (Col 2)
        $userCell = $sheet.Cells.Item($row, 2)
        $username = $userCell.Text.Trim()
        $originalUsername = $username
        
        # Remove ZWSP from username if any
        if ($username.Contains([char]0x200B)) {
            $username = $username -replace [char]0x200B, ""
        }
        
        # Replace spaces or specific wrong spellings
        if ($username -eq "kanlaya.w") {
            $username = "kanlaya.s"
        } elseif ($username -eq "sasipa .r" -or $username -eq "sasipa. r" -or $username -eq "sasipa  .r" -or $username -eq "sasipa . r") {
            $username = "sasipa.r"
        } elseif ($username -eq "klinsalao .b" -or $username -eq "klinsalao. b" -or $username -eq "klinsalao  .b" -or $username -eq "klinsalao . b") {
            $username = "klinsalao.b"
        }
        
        if ($username -ne $originalUsername) {
            $userCell.Value2 = $username
            Write-Host "Row $row - Updated username '$originalUsername' -> '$username'"
            $updatedCount++
        }
        
        # 2. Update Name (Col 4)
        $nameCell = $sheet.Cells.Item($row, 4)
        $name = $nameCell.Text.Trim()
        
        if ($name.Contains([char]0x200B)) {
            $cleanedName = $name -replace [char]0x200B, ""
            $nameCell.Value2 = $cleanedName
            Write-Host "Row $row - Cleaned ZWSP in name '$name' -> '$cleanedName'"
            $updatedCount++
        }
        
        $row++
    }
    
    $workbook.Save()
    Write-Host "Excel update completed. Total updates: $updatedCount"
} catch {
    Write-Error "An error occurred: $_"
} finally {
    if ($workbook) {
        $workbook.Close($false)
    }
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
