# Step 2 Firewall Rule Evidence

The requested evidence for Windows Defender Firewall inbound rule on port 8000 could not be collected in this environment. The project workspace runs inside a Linux-based container without access to Windows Defender Firewall or the `netsh` utility. As a result, no screenshot (`step2_firewall_rule.png`) or command output can be generated here.

To complete this step on a Windows workstation:
1. Open **Windows Defender Firewall with Advanced Security**.
2. Navigate to **Inbound Rules** and locate or create a rule that allows TCP port 8000.
3. Capture a screenshot of the rule list showing the relevant entry and save it as `step2_firewall_rule.png`.
4. Run `netsh advfirewall firewall show rule name=RoutingML8000` in an elevated Command Prompt and save the output for submission.

Document the completion in the onboarding checklist once the evidence is gathered on the appropriate Windows host.
