# Opens the DFS ports on the Windows firewall so other machines on your LAN can
# reach this one. RIGHT-CLICK this file -> "Run with PowerShell" as Administrator
# (or run it from an elevated PowerShell). Run it on the host AND on each member
# machine.
#
#   5000 = coordinator (only needed on the machine running `node app.js`)
#   7330 = embedded storage node (needed on any machine that Contributes storage)

$ports = @(5000, 7330)
foreach ($p in $ports) {
  $name = "DFS (TCP $p)"
  Remove-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $p -Profile Private | Out-Null
  Write-Host "Allowed inbound TCP $p on private networks"
}
Write-Host "Done. DFS can now be reached across your local network."
