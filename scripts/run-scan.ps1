$jdkPath = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:JAVA_HOME = $jdkPath
$env:PATH = "$jdkPath\bin;" + $env:PATH

Write-Host "Starting SonarQube scan with JAVA_HOME=$env:JAVA_HOME..."

npx sonarqube-scanner
