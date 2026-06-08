$config = Get-Content "d:\Cars\smtp_config.json" -Raw | ConvertFrom-Json
$mail = New-Object System.Net.Mail.MailMessage
$mail.From = New-Object System.Net.Mail.MailAddress($config.from)
$mail.To.Add("ranida.c@fishmarket.co.th") # Default test recipient in their sheet
$mail.Subject = "Test Email Connection"
$mail.Body = "This is a test email from the car booking system using anonymous SMTP configuration."

$smtp = New-Object System.Net.Mail.SmtpClient($config.smtpServer, $config.port)
$smtp.EnableSsl = $config.enableSsl
$smtp.UseDefaultCredentials = $false
$smtp.Credentials = $null

try {
    $smtp.Send($mail)
    Write-Host "Email sent successfully!"
} catch {
    Write-Error "Failed to send email: $_"
} finally {
    $mail.Dispose()
    $smtp.Dispose()
}
