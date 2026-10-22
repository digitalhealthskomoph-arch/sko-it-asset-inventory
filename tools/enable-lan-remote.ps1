<#
.SYNOPSIS
  Prepares a Windows 10/11 Pro PC for remote support from the IT room over the office LAN.

.DESCRIPTION
  - Enables Remote Desktop with Network Level Authentication
  - Enables "Offer Remote Assistance" (msra /offerRA) so the user sees and approves the session
  - Opens the needed ports ONLY to the IT subnet(s) given in -ItSubnet (other floors cannot connect)

  Run as Administrator on each client PC (or deploy as a startup script / via your management tool).
  Test on one machine first. Safe to re-run.

.PARAMETER ItSubnet
  One or more CIDR ranges allowed to connect, e.g. 192.168.10.0/24

.PARAMETER Helpers
  Accounts allowed to offer Remote Assistance. In a workgroup this must be a local account on
  this PC that has the same user name and password as the technician's account.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File enable-lan-remote.ps1 -ItSubnet 192.168.10.0/24 -Helpers "$env:COMPUTERNAME\itadmin"
#>
param(
  [Parameter(Mandatory = $true)][string[]]$ItSubnet,
  [string[]]$Helpers = @("$env:COMPUTERNAME\Administrators")
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Please run this script as Administrator.'
}

foreach ($cidr in $ItSubnet) {
  if ($cidr -notmatch '^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$') { throw "Invalid subnet: $cidr" }
}

# 1. Remote Desktop + NLA
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server' -Name fDenyTSConnections -Value 0
Set-ItemProperty 'HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp' -Name UserAuthentication -Value 1

# 2a. Allow Remote Assistance invitations (used by the SKO Help app: the user asks for help)
$ra = 'HKLM:\SYSTEM\CurrentControlSet\Control\Remote Assistance'
Set-ItemProperty $ra -Name fAllowToGetHelp -Value 1 -Type DWord
Set-ItemProperty $ra -Name fAllowFullControl -Value 1 -Type DWord

# 2b. Offer Remote Assistance (equivalent to the Group Policy setting "Configure Offer Remote Assistance")
$ts = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services'
New-Item -Path $ts -Force | Out-Null
Set-ItemProperty $ts -Name fAllowUnsolicited -Value 1 -Type DWord
Set-ItemProperty $ts -Name fAllowUnsolicitedFullControl -Value 1 -Type DWord   # user can still decline
$helperKey = Join-Path $ts 'RAUnsolicit'
New-Item -Path $helperKey -Force | Out-Null
foreach ($h in $Helpers) { Set-ItemProperty $helperKey -Name $h -Value $h -Type String }

# 3. Firewall: replace our rules, allowing the IT subnet only
$group = 'SKO IT LAN Remote'
Get-NetFirewallRule -Group $group -ErrorAction SilentlyContinue | Remove-NetFirewallRule

New-NetFirewallRule -Group $group -DisplayName 'SKO IT - Remote Desktop (TCP 3389)' `
  -Direction Inbound -Protocol TCP -LocalPort 3389 -RemoteAddress $ItSubnet -Action Allow -Profile Any | Out-Null
New-NetFirewallRule -Group $group -DisplayName 'SKO IT - Remote Desktop (UDP 3389)' `
  -Direction Inbound -Protocol UDP -LocalPort 3389 -RemoteAddress $ItSubnet -Action Allow -Profile Any | Out-Null
New-NetFirewallRule -Group $group -DisplayName 'SKO IT - Remote Assistance (DCOM 135)' `
  -Direction Inbound -Protocol TCP -LocalPort 135 -RemoteAddress $ItSubnet -Action Allow -Profile Any | Out-Null
New-NetFirewallRule -Group $group -DisplayName 'SKO IT - Remote Assistance (raserver)' `
  -Direction Inbound -Program "$env:SystemRoot\System32\raserver.exe" -RemoteAddress $ItSubnet -Action Allow -Profile Any | Out-Null
New-NetFirewallRule -Group $group -DisplayName 'SKO IT - Remote Assistance (msra)' `
  -Direction Inbound -Program "$env:SystemRoot\System32\msra.exe" -RemoteAddress $ItSubnet -Action Allow -Profile Any | Out-Null

Write-Host "Done. RDP and Offer Remote Assistance are enabled for: $($ItSubnet -join ', ')" -ForegroundColor Green
Write-Host 'Group Policy changes for Remote Assistance apply after: gpupdate /force (or a restart).'
