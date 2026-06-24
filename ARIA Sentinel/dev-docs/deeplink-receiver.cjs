// DoD criterion 3 helper — stands in for the installed Sentinel app as the registered aria-sentinel://
// handler. Windows invokes this with the full URL as argv[2]; we write it out so the proof can confirm the
// OS delivered the complete deep-link, then feed it through the REAL parser/validator.
const fs = require("fs");
const url = process.argv[2] || "";
fs.writeFileSync(process.env.DEEPLINK_OUT || "deeplink-received.txt", url, "utf8");
