# deploy_server.ps1
# 1. Download database from Cloudflare Pages
Write-Host "Syncing bookings database..."
Invoke-RestMethod -Uri "https://car-booking-5l7.pages.dev/api/get-bookings" | ConvertTo-Json -Depth 10 | Out-File -FilePath "D:\Cars\car-booking\bookings.json" -Encoding utf8
Copy-Item -Path "D:\Cars\car-booking\bookings.json" -Destination "D:\deploy_latest\bookings.json" -Force

# 2. Sync codebase
Write-Host "Updating code files..."
Copy-Item -Path D:\Cars\car-booking\app.js, D:\Cars\car-booking\index.html, D:\Cars\car-booking\style.css, D:\Cars\car-booking\server.js -Destination D:\deploy_latest\ -Force

# 3. Restart server
Write-Host "Restarting server..."
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
cd D:\Cars\car-booking
Start-Process node -ArgumentList "server.js" -WindowStyle Hidden

Write-Host "Server successfully updated!"
