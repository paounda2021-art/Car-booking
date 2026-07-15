$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open('d:\Cars\users.xlsx')
$sheet = $workbook.Sheets.Item(1)
$row = 2
$results = @()
while ($true) {
    $empId = $sheet.Cells.Item($row, 1).Value2
    if (-not $empId) { break }
    $username = $sheet.Cells.Item($row, 2).Text.Trim()
    $name = $sheet.Cells.Item($row, 4).Text.Trim()
    $email = $sheet.Cells.Item($row, 9).Text.Trim()
    $role = $sheet.Cells.Item($row, 8).Text.Trim()
    
    $lower = $username.ToLower()
    if ($lower -like "*jaruwan*" -or 
        $lower -like "*supachai*" -or 
        $lower -like "*pati*" -or 
        $lower -like "*path*" -or 
        $lower -like "*pat*" -or 
        $lower -like "*wich*" -or 
        $lower -like "*wits*" -or 
        $lower -like "*kanlaya*" -or 
        $lower -like "*sasipa*" -or 
        $lower -like "*klinsalao*") {
        $results += "Row: $row - EmpID: $empId - Username: $username - Name: $name - Email: $email - Role: $role"
    }
    $row++
}
$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$results | Out-File -FilePath "d:\Cars\search_results.txt" -Encoding utf8
Write-Host "Done searching, found $($results.Count) results."
