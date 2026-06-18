(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function writeOutput(id, value) {
    var node = $(id);
    if (!node) return;
    node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  function readForm(form) {
    var out = {};
    Array.from(new FormData(form).entries()).forEach(function (entry) {
      out[entry[0]] = entry[1];
    });
    return out;
  }

  function bindLocalForm(formId, outputId, builder) {
    var form = $(formId);
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var payload = builder ? builder(readForm(form)) : readForm(form);
      payload.staged_at = new Date().toISOString();
      localStorage.setItem("aria:" + formId, JSON.stringify(payload));
      writeOutput(outputId, payload);
    });
  }

  function bindChecklist() {
    Array.from(document.querySelectorAll("[data-f100-checklist] input[type=checkbox]")).forEach(function (box) {
      var key = "aria:finish100:" + (box.name || box.id);
      box.checked = localStorage.getItem(key) === "1";
      box.addEventListener("change", function () {
        localStorage.setItem(key, box.checked ? "1" : "0");
        updateChecklistScore(box.closest("[data-f100-checklist]"));
      });
    });
    Array.from(document.querySelectorAll("[data-f100-checklist]")).forEach(updateChecklistScore);
  }

  function updateChecklistScore(root) {
    if (!root) return;
    var boxes = Array.from(root.querySelectorAll("input[type=checkbox]"));
    var done = boxes.filter(function (box) { return box.checked; }).length;
    var pct = boxes.length ? Math.round((done / boxes.length) * 100) : 0;
    var target = root.querySelector("[data-f100-score]");
    if (target) target.textContent = pct + "%";
    var bar = root.querySelector(".f100-progress span");
    if (bar) bar.style.setProperty("--value", pct + "%");
  }

  window.finish100 = {
    bindLocalForm: bindLocalForm,
    writeOutput: writeOutput,
    readForm: readForm
  };

  document.addEventListener("DOMContentLoaded", function () {
    bindChecklist();
    bindLocalForm("screenshare-consent-form", "screenshare-consent-output", function (data) {
      return {
        event: "screenshare_consent_recorded",
        email: data.email,
        tenant: data.tenant,
        recording_allowed: data.recording_allowed === "yes",
        remote_control_allowed: data.remote_control_allowed === "yes",
        notes: data.notes || "",
        next_ceo_action: "Ahmad may create the live room only after consent is confirmed."
      };
    });
    bindLocalForm("partner-checker-form", "partner-checker-output", function (data) {
      var blockers = [];
      if (data.duns !== "yes") blockers.push("D-U-N-S confirmation required before MS/AWS partner drafts can be submitted.");
      if (data.legal !== "yes") blockers.push("Legal name/address consistency check required.");
      if (data.mpn !== "yes") blockers.push("Microsoft partner profile still needs CEO final submit.");
      if (data.aws !== "yes") blockers.push("AWS Partner Central profile still needs CEO final submit.");
      return {
        event: "partner_application_readiness",
        blockers: blockers,
        ready_for_ceo_submit: blockers.length === 0,
        next_ceo_action: blockers.length === 0 ? "Open partner portals and click final submit." : "Resolve blockers before any platform submission."
      };
    });
    bindLocalForm("white-label-form", "white-label-output", function (data) {
      return {
        event: "white_label_theme_staged",
        tenant_id: data.tenant_id,
        theme: {
          brand_name: data.brand_name,
          logo_url: data.logo_url,
          accent_color: data.accent_color,
          support_email: data.support_email,
          hide_iis_badge: data.hide_iis_badge === "yes"
        },
        function_target: "/.netlify/functions/aria-white-label",
        next_ceo_action: "If approved, paste admin token and run the function set action."
      };
    });
    bindLocalForm("write-gate-status-form", "write-gate-output", function (data) {
      return {
        event: "write_gate_status_lookup_staged",
        request_id: data.request_id,
        function_target: "/.netlify/functions/aria-write-gate",
        next_ceo_action: "Approve or deny only from the signed write-gate email link."
      };
    });
  });
})();
