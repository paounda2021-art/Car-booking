# PowerShell Static Web Server for Windows
# Run this script to serve index.html, style.css, and app.js locally.

$port = 8080
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $rootDir) { $rootDir = Get-Location }

# Try to find a free port
while ($true) {
    try {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$port/")
        $listener.Start()
        break
    } catch {
        Write-Host "Port $port is in use. Trying next port..."
        $port++
        if ($port -gt 8100) {
            Write-Error "Could not find a free port in range 8080-8100"
            exit 1
        }
    }
}

Write-Host "=========================================================="
Write-Host "  Corporate Car Booking System Local Web Server"
Write-Host "  Listening on: http://localhost:$port/"
Write-Host "  Root Directory: $rootDir"
Write-Host "  To stop the server, press Ctrl+C in this console."
Write-Host "=========================================================="

# Launch the default browser to open the app (Commented out for background PM2 execution)
# Start-Process "http://localhost:$port/"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $urlPath = $request.Url.LocalPath
        
        # API: get-bookings
        if ($urlPath -eq "/api/get-bookings" -and $request.HttpMethod -eq "GET") {
            $bookingsFile = Join-Path $rootDir "bookings.json"
            $bookingsData = "[]"
            if (Test-Path $bookingsFile) {
                $bookingsData = Get-Content $bookingsFile -Raw -Encoding UTF8
            }
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes($bookingsData)
            $response.ContentLength64 = $resBytes.Length
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
            continue
        }

        # API: save-bookings
        if ($urlPath -eq "/api/save-bookings" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $bookingsFile = Join-Path $rootDir "bookings.json"
                Set-Content -Path $bookingsFile -Value $bodyText -Encoding UTF8

                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","message":"Bookings saved successfully"}')
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $errObj = @{ status = "error"; message = $_.ToString() } | ConvertTo-Json
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($errObj)
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        # API: send-email
        if ($urlPath -eq "/api/send-email" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $emailData = ConvertFrom-Json $bodyText
                if (-not $emailData -or -not $emailData.to) {
                    throw "Invalid request data. Recipient 'to' is required."
                }

                $configPath = Join-Path $rootDir "smtp_config.json"
                $config = Get-Content $configPath -Raw | ConvertFrom-Json

                # Start the background job to send SMTP mail asynchronously
                $job = Start-Job -ScriptBlock {
                    param($cfg, $to, $subject, $body)
                    try {
                        $mail = New-Object System.Net.Mail.MailMessage
                        $fromAddr = if ($cfg.from) { $cfg.from } else { "carbooking@workd.go.th" }
                        $mail.From = New-Object System.Net.Mail.MailAddress($fromAddr)
                        
                        # Add recipients (can be comma-separated)
                        $to.Split(',') | ForEach-Object {
                            if ($_.Trim()) { $mail.To.Add($_.Trim()) }
                        }
                        
                        $mail.Subject = $subject
                        $mail.Body = $body
                        $mail.IsBodyHtml = $true
                        $mail.BodyEncoding = [System.Text.Encoding]::UTF8
                        $mail.SubjectEncoding = [System.Text.Encoding]::UTF8

                        $smtp = New-Object System.Net.Mail.SmtpClient($cfg.smtpServer, $cfg.port)
                        $smtp.EnableSsl = $cfg.enableSsl
                        $smtp.Timeout = 10000 # 10 seconds timeout

                        if ($cfg.username -and $cfg.password) {
                            $smtp.UseDefaultCredentials = $false
                            $smtp.Credentials = New-Object System.Net.NetworkCredential($cfg.username, $cfg.password)
                        } else {
                            $smtp.UseDefaultCredentials = $false
                            $smtp.Credentials = $null
                        }

                        $smtp.Send($mail)
                        $mail.Dispose()
                        $smtp.Dispose()
                    } catch {
                        Write-Host "Error in background SMTP send: $_"
                    }
                } -ArgumentList $config, $emailData.to, $emailData.subject, $emailData.body

                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","message":"Email queued for sending asynchronously"}')
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                Write-Host "Error queueing email: $_"
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $errObj = @{
                    status = "error"
                    message = $_.ToString()
                } | ConvertTo-Json
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($errObj)
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        # API: notify-driver-group
        if ($urlPath -eq "/api/notify-driver-group" -and $request.HttpMethod -eq "POST") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $payload = ConvertFrom-Json $bodyText
                
                $lineConfigPath = Join-Path $rootDir "line_config.json"
                if (Test-Path $lineConfigPath) {
                    $config = Get-Content $lineConfigPath -Raw | ConvertFrom-Json
                    $accessToken = $config.channelAccessToken
                    $groupId = $config.groupId
                    
                    if ($accessToken -and $groupId -and -not $accessToken.Contains("YOUR_LINE_") -and -not $groupId.Contains("YOUR_LINE_")) {
                        
                        $isCancel = $payload.type -eq "cancel"
                        $headerTitle = if ($isCancel) { "⚠️ แจ้งยกเลิกใบสั่งงาน พขร." } else { "📋 ใบสั่งงานพนักงานขับรถ" }
                        $headerColor = if ($isCancel) { "#dc2626" } else { "#1e3a8a" }
                        $headerBg = if ($isCancel) { "#fef2f2" } else { "#f8fafc" }
                        $altText = if ($isCancel) { "⚠️ แจ้งยกเลิกคิวงาน พขร. - ปลายทาง: $($payload.destination)" } else { "📢 ใบสั่งงาน พขร. คิวใหม่ (อนุมัติเสร็จสิ้น) - ปลายทาง: $($payload.destination)" }

                        # Build body contents list dynamically
                        $bodyContents = [System.Collections.ArrayList]::new()
                        if ($isCancel) {
                            $bodyContents.Add(@{
                                type = "text"
                                text = "❌ คิวงานนี้ถูกยกเลิกแล้ว"
                                weight = "bold"
                                size = "md"
                                color = "#dc2626"
                            }) > $null
                            $bodyContents.Add(@{
                                type = "text"
                                text = "💬 เหตุผล: $($payload.cancelReason)"
                                size = "sm"
                                color = "#ef4444"
                                margin = "xs"
                                wrap = $true
                            }) > $null
                            $bodyContents.Add(@{
                                type = "separator"
                                margin = "md"
                                color = "#e2e8f0"
                            }) > $null
                        }

                        $bodyContents.Add(@{
                            type = "box"
                            layout = "horizontal"
                            margin = if ($isCancel) { "md" } else { "none" }
                            contents = @(
                                @{ type = "text"; text = "👤 พขร. ปฏิบัติหน้าที่:"; size = "sm"; color = "#64748b"; flex = 4 },
                                @{ type = "text"; text = $payload.driverName; size = "sm"; color = "#1e293b"; weight = "bold"; flex = 6; wrap = $true }
                            )
                        }) > $null

                        $bodyContents.Add(@{
                            type = "box"
                            layout = "horizontal"
                            margin = "md"
                            contents = @(
                                @{ type = "text"; text = "🚗 ยานพาหนะ:"; size = "sm"; color = "#64748b"; flex = 4 },
                                @{ type = "text"; text = $payload.carInfo; size = "sm"; color = "#1e293b"; flex = 6; wrap = $true }
                            )
                        }) > $null

                        $bodyContents.Add(@{
                            type = "box"
                            layout = "horizontal"
                            margin = "md"
                            contents = @(
                                @{ type = "text"; text = "📍 สถานที่ปลายทาง:"; size = "sm"; color = "#64748b"; flex = 4 },
                                @{ type = "text"; text = $payload.destination; size = "sm"; color = "#1e293b"; flex = 6; wrap = $true }
                            )
                        }) > $null

                        $bodyContents.Add(@{
                            type = "box"
                            layout = "horizontal"
                            margin = "md"
                            contents = @(
                                @{ type = "text"; text = "📅 วันเวลาเดินทาง:"; size = "sm"; color = "#64748b"; flex = 4 },
                                @{ type = "text"; text = $payload.dateTime; size = "sm"; color = "#1e293b"; flex = 6; wrap = $true }
                            )
                        }) > $null

                        $bodyContents.Add(@{
                            type = "box"
                            layout = "horizontal"
                            margin = "md"
                            contents = @(
                                @{ type = "text"; text = "👥 ผู้ขอใช้รถ:"; size = "sm"; color = "#64748b"; flex = 4 },
                                @{ type = "text"; text = $payload.passenger; size = "sm"; color = "#1e293b"; flex = 6; wrap = $true }
                            )
                        }) > $null

                        $bodyContents.Add(@{
                            type = "box"
                            layout = "horizontal"
                            margin = "md"
                            contents = @(
                                @{ type = "text"; text = "👨‍👩‍👦‍👦 ผู้ร่วมเดินทาง:"; size = "sm"; color = "#64748b"; flex = 4 },
                                @{ type = "text"; text = $payload.passengers; size = "sm"; color = "#1e293b"; flex = 6; wrap = $true }
                            )
                        }) > $null

                        $linePayload = @{
                            to = $groupId
                            messages = @(
                                @{
                                    type = "flex"
                                    altText = $altText
                                    contents = @{
                                        type = "bubble"
                                        header = @{
                                            type = "box"
                                            layout = "vertical"
                                            contents = @(
                                                @{ type = "text"; text = $headerTitle; weight = "bold"; size = "lg"; color = $headerColor },
                                                @{ type = "text"; text = "ระบบจองรถยนต์สะพานปลา (FMO)"; size = "xs"; color = "#64748b"; margin = "xs" }
                                            )
                                            backgroundColor = $headerBg
                                            paddingAll = "15px"
                                        }
                                        body = @{
                                            type = "box"
                                            layout = "vertical"
                                            contents = $bodyContents
                                        }
                                    }
                                }
                            )
                        }

                        $headers = @{
                            "Authorization" = "Bearer $accessToken"
                            "Content-Type" = "application/json"
                        }
                        
                        $jsonPayload = $linePayload | ConvertTo-Json -Depth 10
                        $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonPayload)
                        
                        $requestUri = "https://api.line.me/v2/bot/message/push"
                        
                        # Send to LINE API asynchronously using Start-Job
                        Start-Job -ScriptBlock {
                            param($uri, $headers, $bytes)
                            try {
                                $webRequest = [System.Net.WebRequest]::Create($uri)
                                $webRequest.Method = "POST"
                                $webRequest.ContentType = "application/json"
                                foreach ($h in $headers.Keys) {
                                    if ($h -eq "Authorization") {
                                        $webRequest.Headers.Add($h, $headers[$h])
                                    }
                                }
                                $webRequest.ContentLength = $bytes.Length
                                $requestStream = $webRequest.GetRequestStream()
                                $requestStream.Write($bytes, 0, $bytes.Length)
                                $requestStream.Close()
                                
                                $webResponse = $webRequest.GetResponse()
                                $webResponse.Close()
                            } catch {
                                Write-Host "Error in background LINE push: $_"
                            }
                        } -ArgumentList $requestUri, $headers, $utf8Bytes
                    }
                }

                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"success","message":"Notification queued"}')
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            } catch {
                Write-Host "Error in notify-driver-group: $_"
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $errObj = @{ status = "error"; message = $_.ToString() } | ConvertTo-Json
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes($errObj)
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            }
            $response.Close()
            continue
        }

        if ($urlPath -eq "/") { $urlPath = "/index.html" }

        # Resolve clean paths
        $filePath = Join-Path $rootDir $urlPath.Substring(1)
        
        # Security check: Ensure requested file is inside workspace
        $resolvedPath = [System.IO.Path]::GetFullPath($filePath)
        $resolvedRoot = [System.IO.Path]::GetFullPath($rootDir)
        if (-not $resolvedPath.StartsWith($resolvedRoot)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $resolvedPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($resolvedPath).ToLower()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $mime
            $bytes = [System.IO.File]::ReadAllBytes($resolvedPath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.StatusCode = 200
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("<h1>404 Not Found</h1>")
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $errBytes.Length
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "Server stopped or encountered error: $_"
} finally {
    if ($null -ne $listener) {
        $listener.Stop()
        $listener.Close()
    }
}
