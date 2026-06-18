package aria

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultBaseURL = "https://iisupp.net/.netlify/functions"

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

type Lead struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Company    string `json:"company,omitempty"`
	Phone      string `json:"phone,omitempty"`
	Message    string `json:"message,omitempty"`
	Source     string `json:"source,omitempty"`
	LastIntent string `json:"last_intent,omitempty"`
}

type Handoff struct {
	Email       string `json:"email"`
	Name        string `json:"name,omitempty"`
	ChatSummary string `json:"chat_summary,omitempty"`
	LastIntent  string `json:"last_intent,omitempty"`
	Urgency     string `json:"urgency,omitempty"`
}

type Theme struct {
	BrandName    string `json:"brand_name,omitempty"`
	LogoURL      string `json:"logo_url,omitempty"`
	AccentColor  string `json:"accent_color,omitempty"`
	SupportEmail string `json:"support_email,omitempty"`
	HideIISBadge bool   `json:"hide_iis_badge,omitempty"`
}

func NewClient(httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	return &Client{BaseURL: DefaultBaseURL, HTTPClient: httpClient}
}

func (c *Client) CaptureLead(ctx context.Context, lead Lead) (map[string]any, error) {
	return c.post(ctx, "aria-lead-capture", lead)
}

func (c *Client) RequestHandoff(ctx context.Context, handoff Handoff) (map[string]any, error) {
	return c.post(ctx, "aria-warm-handoff", handoff)
}

func (c *Client) MRR(ctx context.Context) (map[string]any, error) {
	return c.post(ctx, "aria-mrr-dashboard", map[string]any{"event": "snapshot"})
}

func (c *Client) AnalyticsSnapshot(ctx context.Context, adminToken string) (map[string]any, error) {
	payload := map[string]any{"event": "snapshot"}
	if adminToken != "" {
		payload["admin_token"] = adminToken
	}
	return c.post(ctx, "aria-analytics-dashboard", payload)
}

func (c *Client) WhiteLabelTheme(ctx context.Context, tenantID string) (map[string]any, error) {
	return c.get(ctx, "aria-white-label", url.Values{"tenant_id": {tenantID}, "format": {"json"}})
}

func (c *Client) WhiteLabelSet(ctx context.Context, tenantID string, theme Theme, adminToken string) (map[string]any, error) {
	return c.post(ctx, "aria-white-label", map[string]any{
		"event":       "set",
		"tenant_id":   tenantID,
		"theme":       theme,
		"admin_token": adminToken,
	})
}

func (c *Client) BreakerStatus(ctx context.Context) (map[string]any, error) {
	return c.post(ctx, "aria-breaker-status", map[string]any{"event": "status"})
}

func (c *Client) post(ctx context.Context, path string, payload any) (map[string]any, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint(path), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req)
}

func (c *Client) get(ctx context.Context, path string, values url.Values) (map[string]any, error) {
	endpoint := c.endpoint(path)
	if encoded := values.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	return c.do(req)
}

func (c *Client) do(req *http.Request) (map[string]any, error) {
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var out map[string]any
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &out); err != nil {
			return nil, err
		}
	} else {
		out = map[string]any{}
	}

	if resp.StatusCode >= 400 {
		if msg, ok := out["error"].(string); ok && msg != "" {
			return nil, fmt.Errorf("aria %s: %s", resp.Status, msg)
		}
		return nil, fmt.Errorf("aria %s", resp.Status)
	}
	return out, nil
}

func (c *Client) endpoint(path string) string {
	base := strings.TrimRight(c.BaseURL, "/")
	return base + "/" + strings.TrimLeft(path, "/")
}
