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

  function bindRemoteForm(formId, outputId, endpoint, builder) {
    var form = $(formId);
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var payload = builder ? builder(readForm(form)) : readForm(form);
      payload.staged_at = new Date().toISOString();
      writeOutput(outputId, { status: "checking", endpoint: endpoint });
      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok) throw new Error(json.error || ("HTTP " + res.status));
          return json;
        });
      }).then(function (json) {
        var result = { staged_input: payload, backend_result: json };
        localStorage.setItem("aria:" + formId, JSON.stringify(result));
        writeOutput(outputId, result);
      }).catch(function (err) {
        var fallback = {
          staged_input: payload,
          backend_error: String(err && err.message || err),
          safe_fallback: "Local staging only. Do not perform CEO final action until backend check passes."
        };
        localStorage.setItem("aria:" + formId, JSON.stringify(fallback));
        writeOutput(outputId, fallback);
      });
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
    bindRemoteForm: bindRemoteForm,
    writeOutput: writeOutput,
    readForm: readForm
  };

  document.addEventListener("DOMContentLoaded", function () {
    bindChecklist();
    bindRemoteForm("screenshare-consent-form", "screenshare-consent-output", "/.netlify/functions/aria-room-provider-test", function (data) {
      return {
        action: "mock_contract",
        email: data.email,
        tenant: data.tenant,
        screen_share_allowed: data.screen_share_allowed === "yes",
        recording_allowed: data.recording_allowed === "yes",
        remote_control_allowed: data.remote_control_allowed === "yes",
        notes: data.notes || "",
        next_ceo_action: "Ahmad may create the live room only after consent is confirmed."
      };
    });
    bindRemoteForm("partner-checker-form", "partner-checker-output", "/.netlify/functions/aria-partner-readiness", function (data) {
      var blockers = [];
      if (data.duns !== "yes") blockers.push("D-U-N-S confirmation required before MS/AWS partner drafts can be submitted.");
      if (data.duns === "yes" && !/^\d{9}$/.test(String(data.duns_number || "").replace(/\D/g, ""))) blockers.push("Confirmed 9-digit D-U-N-S number required.");
      if (data.legal !== "yes") blockers.push("Legal name/address consistency check required.");
      if (data.legal === "yes" && !data.registered_address) blockers.push("CEO-confirmed registered address required.");
      if (!data.business_email) blockers.push("Business email required for partner drafts.");
      if (data.mpn !== "yes") blockers.push("Microsoft partner profile still needs CEO final submit.");
      if (data.aws !== "yes") blockers.push("AWS Partner Central profile still needs CEO final submit.");
      return {
        action: blockers.length === 0 ? "draft_submission" : "check",
        company: {
          legal_name: "Integrated IT Support Inc.",
          website: "https://iisupp.net",
          duns: String(data.duns_number || "").replace(/\D/g, ""),
          registered_address: data.registered_address || "",
          business_email: data.business_email || "",
          phone: data.phone || "+1 647-581-3182"
        },
        checklist: data,
        local_blockers: blockers,
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
