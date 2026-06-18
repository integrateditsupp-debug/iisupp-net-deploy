# ARIA Go SDK

Small Go client for Integrated IT Support Inc. ARIA Netlify functions.

```go
client := aria.NewClient(nil)
lead, err := client.CaptureLead(context.Background(), aria.Lead{
  Name: "Clinic Ops",
  Email: "ops@example.com",
  Source: "go-sdk",
})
```

This starter intentionally performs HTTP calls only. Publishing to a package registry requires Ahmad approval.
