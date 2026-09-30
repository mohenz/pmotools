$ErrorActionPreference = "Stop"

try {
    # 1. Allow TCP 3000 (Gitea)
    Write-Host "Checking Gitea Firewall Rule..."
    $giteaRule = Get-NetFirewallRule -DisplayName "Allow Gitea (TCP 3000)" -ErrorAction SilentlyContinue
    if (-not $giteaRule) {
        Write-Host "Creating firewall rule for Gitea (Port 3000)..."
        New-NetFirewallRule -DisplayName "Allow Gitea (TCP 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any | Out-Null
        Write-Host "Gitea firewall rule created."
    } else {
        Write-Host "Gitea firewall rule already exists."
    }

    # 2. Allow ICMP (Ping)
    Write-Host "Checking ICMP (Ping) Firewall Rule..."
    $icmpRule = Get-NetFirewallRule -DisplayName "Allow ICMPv4-In" -ErrorAction SilentlyContinue
    if (-not $icmpRule) {
        Write-Host "Creating firewall rule for ICMP (Ping)..."
        New-NetFirewallRule -DisplayName "Allow ICMPv4-In" -Protocol ICMPv4 -IcmpType 8 -Direction Inbound -Action Allow -Profile Any | Out-Null
        Write-Host "ICMP firewall rule created."
    } else {
        Write-Host "ICMP firewall rule already exists."
        # Ensure it is enabled
        Set-NetFirewallRule -DisplayName "Allow ICMPv4-In" -Enabled True
    }
    
    # Enable File and Printer Sharing echo request if built-in rule exists
    Get-NetFirewallRule -DisplayGroup "File and Printer Sharing" | Where-Object { $_.DisplayName -like "*Echo Request*" } | Set-NetFirewallRule -Enabled True -ErrorAction SilentlyContinue

    Write-Host "Firewall configuration completed successfully."
} catch {
    Write-Error "Failed to configure firewall: $_"
    exit 1
}
