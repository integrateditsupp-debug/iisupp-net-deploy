from iisupp_aria import ARIA


client = ARIA()
result = client.submit_tenant_kb(
    tenant_email="it@example.com",
    kb_title="VPN client approved fix",
    kb_content="If GlobalProtect shows gateway unavailable, restart PanGPS and retry.",
    contact_name="IT Admin",
)
print(result)
