package aria

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTrip func(*http.Request) (*http.Response, error)

func (r roundTrip) RoundTrip(req *http.Request) (*http.Response, error) { return r(req) }

func TestCaptureLeadPostsPayload(t *testing.T) {
	var path string
	var body string
	client := NewClient(&http.Client{Transport: roundTrip(func(req *http.Request) (*http.Response, error) {
		path = req.URL.Path
		raw, _ := io.ReadAll(req.Body)
		body = string(raw)
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"ok":true}`)), Header: http.Header{}}, nil
	})})
	client.BaseURL = "https://example.test/functions"

	out, err := client.CaptureLead(context.Background(), Lead{Name: "Clinic Ops", Email: "ops@example.com", Source: "test"})
	if err != nil {
		t.Fatal(err)
	}
	if out["ok"] != true {
		t.Fatalf("expected ok true, got %#v", out)
	}
	if path != "/functions/aria-lead-capture" {
		t.Fatalf("unexpected path %s", path)
	}
	if !strings.Contains(body, `"email":"ops@example.com"`) {
		t.Fatalf("missing email in body %s", body)
	}
}

func TestWhiteLabelThemeUsesGET(t *testing.T) {
	var method string
	var query string
	client := NewClient(&http.Client{Transport: roundTrip(func(req *http.Request) (*http.Response, error) {
		method = req.Method
		query = req.URL.RawQuery
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"ok":true}`)), Header: http.Header{}}, nil
	})})
	client.BaseURL = "https://example.test/functions"

	if _, err := client.WhiteLabelTheme(context.Background(), "clinic.example"); err != nil {
		t.Fatal(err)
	}
	if method != http.MethodGet {
		t.Fatalf("unexpected method %s", method)
	}
	if !strings.Contains(query, "tenant_id=clinic.example") || !strings.Contains(query, "format=json") {
		t.Fatalf("unexpected query %s", query)
	}
}
