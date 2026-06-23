import { strict as assert } from "node:assert";
import { sanitizeToSignature, contentSafeContext, EphemeralBuffer } from "../../apps/sentinel-desktop/src/index";

const canary = "customer@example.com https://customer.example.com C:\\Users\\Ahmad\\Documents\\secret.docx 4111 1111 1111 1111";

export function contentLeakGate(): void {
  const signature = sanitizeToSignature({ issue: `disk full ${canary}`, url: "https://customer.example.com/path" });
  assert.equal(JSON.stringify(signature).includes("customer@example.com"), false);
  assert.equal(JSON.stringify(contentSafeContext({ issue: canary })).includes("customer.example.com"), false);
  const bytes = new Uint8Array([1, 2, 3]);
  new EphemeralBuffer(bytes).use((value) => value.byteLength);
  assert.deepEqual(Array.from(bytes), [0, 0, 0]);
}
