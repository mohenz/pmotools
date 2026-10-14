$jdkPath = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
$env:JAVA_HOME = $jdkPath
$env:SONAR_JAVA_PATH = "$jdkPath\bin\java.exe"
$env:PATH = "$jdkPath\bin;" + $env:PATH

Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "SONAR_JAVA_PATH: $env:SONAR_JAVA_PATH"

Set-Location "d:\Workspace\sonarqube-26.9.0.129388\bin\windows-x86-64"
& ".\StartSonar.bat"
