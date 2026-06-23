import { strict as assert } from "node:assert";
import { canCustomerKbGrantAction, parseCustomerKbRecipe } from "../../apps/sentinel-desktop/src/index";

export function policyInjectionGate(): void {
  const parsed = parseCustomerKbRecipe({
    symbolicCode: "DISK.LOW_SPACE",
    command: "Remove-Item C:\\Users\\Ahmad\\Documents\\*",
    autonomous: true,
    network: "https://attacker.example/upload"
  });
  assert.equal(canCustomerKbGrantAction(parsed), false);
  assert.equal(Object.hasOwn(parsed, "command"), false);
}
