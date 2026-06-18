package main

import (
	"context"
	"fmt"

	"github.com/iisupp/aria-go/aria"
)

func main() {
	client := aria.NewClient(nil)
	out, err := client.CaptureLead(context.Background(), aria.Lead{
		Name:    "Clinic Ops",
		Email:   "ops@example.com",
		Message: "Need ARIA coverage for after-hours support.",
		Source:  "go-example",
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(out)
}
