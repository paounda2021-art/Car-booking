[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$filePath = "d:\Cars\app.js"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# 1. roleName L1 replacement using regex
$pattern1 = "(?s)if\s*\(primaryLevel\s*===\s*1\)\s*\{\s*roleKey\s*=\s*'supervisor';\s*roleName\s*=\s*'หัวหน้าสำนักงาน/หัวหน้าแผนก\s*\(L1\)';"
$replacement1 = "if (primaryLevel === 1) {
      roleKey = 'supervisor';
      roleName = (username === 'jaruwan.s' || username === 'supachai.j' || username === 'patiyoot.k') ? 'ผู้เสนอขอจองและหัวหน้างาน (L0 & L1)' : 'หัวหน้าสำนักงาน/หัวหน้าแผนก (L1)';"

if ($content -match $pattern1) {
    $content = $content -replace $pattern1, $replacement1
    Write-Host "Success: roleName L1"
} else {
    Write-Host "FAILED: roleName L1" -ForegroundColor Yellow
}

# 2. levelCode L0 & L1 replacement using regex
$pattern2 = "(?s)if\s*\(username\s*===\s*'sakda\.a'\)\s*\{\s*levelCode\s*=\s*'\(L0\s*&\s*L2\)';\s*\}\s*else\s*if\s*\(username\s*===\s*'panadon\.p'\)\s*\{\s*levelCode\s*=\s*'\(L0\s*&\s*L3\)';\s*\}\s*else\s*\{\s*levelCode\s*=\s*`\(L\$\\\{displayLevel\\\}\)`;\s*\}"
$replacement2 = "if (username === 'sakda.a') {
      levelCode = '(L0 & L2)';
    } else if (username === 'panadon.p') {
      levelCode = '(L0 & L3)';
    } else if (username === 'jaruwan.s' || username === 'supachai.j' || username === 'patiyoot.k') {
      levelCode = '(L0 & L1)';
    } else {
      levelCode = \`(L\${displayLevel})\`;
    }"

if ($content -match $pattern2) {
    $content = $content -replace $pattern2, $replacement2
    Write-Host "Success: levelCode L0 & L1"
} else {
    # Let's inspect what pattern2 matches or didn't match. We'll escape the backticks or check
    Write-Host "FAILED: levelCode L0 & L1" -ForegroundColor Yellow
}

# 3. creation email dates replacement
$oldEmail1 = "\${new Date(newBooking.startDate).toLocaleString('th-TH')} ถึง \${new Date(newBooking.endDate).toLocaleString('th-TH')}"
$newEmail1 = "\${formatThaiDateTime(newBooking.startDate)} ถึง \${formatThaiDateTime(newBooking.endDate)}"

if ($content.Contains($oldEmail1)) {
    $content = $content.Replace($oldEmail1, $newEmail1)
    Write-Host "Success: creation email dates"
} else {
    # Try regex match
    $patternEmail1 = '(?s)\$\{new Date\(newBooking\.startDate\)\.toLocaleString\(''th-TH''\)\}\s*ถึง\s*\$\{new Date\(newBooking\.endDate\)\.toLocaleString\(''th-TH''\)\}'
    $repEmail1 = '${formatThaiDateTime(newBooking.startDate)} ถึง ${formatThaiDateTime(newBooking.endDate)}'
    if ($content -match $patternEmail1) {
        $content = $content -replace $patternEmail1, $repEmail1
        Write-Host "Success (regex): creation email dates"
    } else {
        Write-Host "FAILED: creation email dates" -ForegroundColor Yellow
    }
}

# 4. approval email dates replacement
$oldEmail2 = "\${new Date(b.startDate).toLocaleString('th-TH')} ถึง \${new Date(b.endDate).toLocaleString('th-TH')}"
$newEmail2 = "\${formatThaiDateTime(b.startDate)} ถึง \${formatThaiDateTime(b.endDate)}"

if ($content.Contains($oldEmail2)) {
    $content = $content.Replace($oldEmail2, $newEmail2)
    Write-Host "Success: approval email dates"
} else {
    # Try regex match
    $patternEmail2 = '(?s)\$\{new Date\(b\.startDate\)\.toLocaleString\(''th-TH''\)\}\s*ถึง\s*\$\{new Date\(b\.endDate\)\.toLocaleString\(''th-TH''\)\}'
    $repEmail2 = '${formatThaiDateTime(b.startDate)} ถึง ${formatThaiDateTime(b.endDate)}'
    if ($content -match $patternEmail2) {
        $content = $content -replace $patternEmail2, $repEmail2
        Write-Host "Success (regex): approval email dates"
    } else {
        Write-Host "FAILED: approval email dates" -ForegroundColor Yellow
    }
}

# Write back content
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "Execution finished."
