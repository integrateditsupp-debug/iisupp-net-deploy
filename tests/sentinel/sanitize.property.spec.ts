import { strict as assert } from "node:assert";
import { sanitizeToSignature } from "../../apps/sentinel-desktop/src/index";

export function sanitizePropertyGate(): void {
  for (let i = 0; i < 10000; i += 1) {
    const signature = sanitizeToSignature({ issue: `dns failed customer${i}@example.com C:\\Users\\Ahmad\\secret-${i}.txt` });
    const text = JSON.stringify(signature);
    assert.equal(text.includes("@example.com"), false);
    assert.equal(text.includes("C:\\Users"), false);
  }
}
