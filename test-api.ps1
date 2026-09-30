$body = @{ jobName = 'Test_Job'; status = 'SUCCESS'; output = 'Manual test run'; durationMs = 120 } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://localhost:3020/api/batch/log' -Method Post -Body $body -Headers @{ 'Content-Type' = 'application/json'; 'Authorization' = 'Bearer PmoBatchSuperSecretToken2026' }
