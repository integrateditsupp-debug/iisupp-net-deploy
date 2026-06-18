from iisupp_aria import ARIA


client = ARIA()
result = client.capture_lead(
    name="Clinic Ops",
    email="ops@example.com",
    company="Example Clinic",
    message="We want ARIA to cover after-hours Microsoft 365 support.",
    source="python-example",
)
print(result)
