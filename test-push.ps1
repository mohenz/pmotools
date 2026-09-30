$ErrorActionPreference = "Stop"
& 'C:\Program Files\Git\cmd\git.exe' add README.md
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'Test Gitea webhook'
& 'C:\Program Files\Git\cmd\git.exe' push gitea master
