(function () {
  const form = document.getElementById('caAnalyzeForm');
  if (!form) return;

  const state = {
    sessionId: '',
    report: null,
    goal: 'Meeting-Content',
    checkoutEmail: '',
    delivery: null
  };

  const fileInput = document.getElementById('caFile');
  const fileName = document.getElementById('caFileName');
  const transcript = document.getElementById('caTranscript');
  const locationInput = document.getElementById('caLocation');
  const statusBox = document.getElementById('caStatus');
  const analyzeButton = document.getElementById('caAnalyzeButton');
  const previewSection = document.getElementById('caPreviewSection');
  const unlockSection = document.getElementById('caUnlockSection');
  const deliverySection = document.getElementById('caDeliverySection');
  const expertsSection = document.getElementById('caExpertsWrap');
  const expertsButton = document.getElementById('caLoadExperts');
  const expertsList = document.getElementById('caExpertsList');
  const reportSummary = document.getElementById('caSummary');
  const reportKeyPoints = document.getElementById('caKeyPoints');
  const reportAi = document.getElementById('caAiLikelihood');
  const reportSensitive = document.getElementById('caSensitiveData');
  const reportGoal = document.getElementById('caGoalPlan');
  const reportTemplates = document.getElementById('caTemplates');
  const checkoutEmailInput = document.getElementById('caCheckoutEmail');
  const checkoutStatus = document.getElementById('caCheckoutStatus');
  const checkoutActions = document.getElementById('caCheckoutActions');
  const downloadZip = document.getElementById('caDownloadZip');
  const downloadPdf = document.getElementById('caDownloadPdf');
  const downloadJson = document.getElementById('caDownloadJson');
  const sendSelfButton = document.getElementById('caSendSelf');
  const sendClientButton = document.getElementById('caSendClient');
  const clientEmailInput = document.getElementById('caClientEmail');
  const emailStatus = document.getElementById('caEmailStatus');
  const purgeNote = document.getElementById('caPurgeNote');

  fileInput.addEventListener('change', function () {
    fileName.textContent = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : 'No file selected yet.';
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setStatus('info', 'Processing your file. The source content is analyzed in a temporary session and is not stored as a persistent document.');
    hideSections();

    const selectedModules = Array.from(form.querySelectorAll('input[name="modules"]:checked')).map((input) => input.value);
    const rightsAttestation = form.querySelector('input[name="rightsAttestation"]').checked;
    state.goal = document.getElementById('caGoal').value || 'Meeting-Content';

    if (selectedModules.length < 3) {
      setStatus('error', 'Select at least three modules before processing.');
      return;
    }
    if (!rightsAttestation) {
      setStatus('error', 'You must confirm you have the right to upload and analyze the content.');
      return;
    }
    if (!fileInput.files[0] && !transcript.value.trim()) {
      setStatus('error', 'Upload a supported file or paste a transcript to continue.');
      return;
    }

    analyzeButton.disabled = true;
    const payload = new FormData();
    if (fileInput.files[0]) payload.append('file', fileInput.files[0]);
    if (transcript.value.trim()) payload.append('transcript', transcript.value.trim());
    payload.append('modules', JSON.stringify(selectedModules));
    payload.append('goal', state.goal);
    payload.append('location', locationInput.value.trim());
    payload.append('rightsAttestation', 'true');

    try {
      const response = await fetch('/.netlify/functions/ca-analyze', {
        method: 'POST',
        body: payload
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Analysis failed.');

      state.sessionId = result.sessionId;
      state.report = result.report;
      sessionStorage.setItem('ca-session', state.sessionId);
      renderPreview(result.report);
      previewSection.classList.remove('ca-hidden');
      unlockSection.classList.remove('ca-hidden');
      purgeNote.textContent = 'Temporary session expires at ' + new Date(result.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.';
      if (selectedModules.includes('experts')) expertsSection.classList.remove('ca-hidden');
      setStatus('success', 'Preview ready. Review the report below, then unlock the delivery bundle.');
    } catch (error) {
      setStatus('error', error.message || 'Analysis failed.');
    } finally {
      analyzeButton.disabled = false;
    }
  });

  expertsButton.addEventListener('click', function () {
    loadExperts(false);
  });
  document.getElementById('caRegenerateExperts').addEventListener('click', function () {
    loadExperts(true);
  });

  document.getElementById('caCheckAccess').addEventListener('click', async function () {
    const email = checkoutEmailInput.value.trim().toLowerCase();
    state.checkoutEmail = email;
    if (!state.sessionId || !email) {
      setCheckoutStatus('error', 'Add the checkout email you want tied to this report.');
      return;
    }
    sessionStorage.setItem('ca-email-' + state.sessionId, email);
    setCheckoutStatus('info', 'Checking whether this email has an active Content Assurance allowance.');
    checkoutActions.innerHTML = '';
    try {
      const response = await postJson('/.netlify/functions/ca-checkout', {
        action: 'status',
        sessionId: state.sessionId,
        email
      });
      renderCheckoutStatus(response.status);
    } catch (error) {
      setCheckoutStatus('error', error.message || 'Could not check access.');
    }
  });

  sendSelfButton.addEventListener('click', function () {
    sendBundle(checkoutEmailInput.value.trim().toLowerCase());
  });
  sendClientButton.addEventListener('click', function () {
    sendBundle(clientEmailInput.value.trim().toLowerCase());
  });

  hydrateCheckoutReturn();

  function hideSections() {
    previewSection.classList.add('ca-hidden');
    unlockSection.classList.add('ca-hidden');
    deliverySection.classList.add('ca-hidden');
    expertsSection.classList.add('ca-hidden');
    checkoutActions.innerHTML = '';
    expertsList.innerHTML = '';
  }

  function setStatus(kind, message) {
    statusBox.className = 'ca-status is-' + kind;
    statusBox.textContent = message;
  }

  function setCheckoutStatus(kind, message) {
    checkoutStatus.className = 'ca-status is-' + kind;
    checkoutStatus.textContent = message;
  }

  function renderPreview(report) {
    reportSummary.textContent = report.summary.executiveSummary;
    reportKeyPoints.innerHTML = renderList(report.summary.keyPoints);
    reportAi.innerHTML = `
      <strong>${escapeHtml(String(report.aiLikelihood.estimatedLikelihoodPercent))}% estimated likelihood</strong>
      <p>${escapeHtml(report.aiLikelihood.explanation)}</p>
      <div class="ca-disclaimer">${escapeHtml(report.aiLikelihood.disclaimer)}</div>
    `;

    const sensitiveFindings = report.sensitiveData.findings.length
      ? renderList(report.sensitiveData.findings.map((item) => `${item.type} (${item.severity}) · sample ${item.sample}`))
      : '<p class="ca-panel-copy">No obvious personal or sensitive-data markers were detected in the processed sample.</p>';
    reportSensitive.innerHTML = `
      <p>${escapeHtml(report.sensitiveData.summary)}</p>
      ${sensitiveFindings}
      <div class="ca-disclaimer">${escapeHtml(report.sensitiveData.disclaimer)}</div>
    `;

    reportGoal.innerHTML = `
      <p>${escapeHtml(report.goalPlan.recommendedApproach)}</p>
      <h4 class="ca-label">Next 7 days</h4>
      ${renderList(report.goalPlan.next7Days)}
      <h4 class="ca-label">Next 30 days</h4>
      ${renderList(report.goalPlan.next30Days)}
      <h4 class="ca-label">Watchouts</h4>
      ${renderList(report.goalPlan.watchouts)}
    `;

    reportTemplates.innerHTML = report.templates.map((template) => `
      <article class="ca-template">
        <small>${escapeHtml(template.channel)}</small>
        <h4>${escapeHtml(template.title)}</h4>
        <pre>${escapeHtml(template.body)}</pre>
      </article>
    `).join('');
  }

  async function loadExperts(regenerate) {
    if (!state.sessionId) return;
    expertsButton.disabled = true;
    expertsList.innerHTML = '<div class="ca-status is-info">Loading live public search results. Only real returned fields will be shown.</div>';
    try {
      const response = await postJson('/.netlify/functions/ca-expert-search', {
        sessionId: state.sessionId,
        location: locationInput.value.trim(),
        regenerate
      });
      if (!response.results.length) {
        expertsList.innerHTML = `<div class="ca-status is-info">${escapeHtml(response.note || 'No expert results were returned for this attempt.')}</div>`;
        return;
      }
      expertsList.innerHTML = response.results.map((item) => `
        <article class="ca-expert-card">
          <h3>${escapeHtml(item.name || 'Public result')}</h3>
          <p>${escapeHtml(item.role || '')}</p>
          ${item.organization ? `<p><strong>Source:</strong> ${escapeHtml(item.organization)}</p>` : ''}
          ${item.location ? `<p><strong>Location:</strong> ${escapeHtml(item.location)}</p>` : ''}
          ${item.contact ? `<p><strong>Public contact:</strong> ${escapeHtml(item.contact)}</p>` : ''}
          <p><a href="${escapeAttribute(item.sourceUrl)}" target="_blank" rel="noopener">Open source link</a></p>
        </article>
      `).join('');
      expertsList.insertAdjacentHTML('beforeend', `<div class="ca-disclaimer">${escapeHtml(response.disclaimer)}</div>`);
    } catch (error) {
      expertsList.innerHTML = `<div class="ca-status is-error">${escapeHtml(error.message || 'Could not load expert suggestions.')}</div>`;
    } finally {
      expertsButton.disabled = false;
    }
  }

  function renderCheckoutStatus(status) {
    checkoutActions.innerHTML = '';
    if (status.kind === 'use-credit') {
      setCheckoutStatus('success', `Active monthly allowance found. ${status.creditsRemaining} included credit(s) are available through ${new Date(status.activeUntil).toLocaleDateString()}.`);
      checkoutActions.appendChild(makeActionButton('Use 1 included credit', function () {
        finalizeDelivery();
      }));
      return;
    }
    if (status.kind === 'overage') {
      setCheckoutStatus('info', `Active monthly plan found, but no included credits remain in the current period. Unlock this report for $2 or start a fresh monthly plan.`);
      checkoutActions.appendChild(makeActionButton('Pay $2 overage', function () {
        beginCheckout('overage');
      }));
      checkoutActions.appendChild(makeSecondaryButton('Start $20/month plan', function () {
        beginCheckout('subscription');
      }));
      return;
    }

    setCheckoutStatus('info', 'No active allowance found for this email. Choose a single report unlock or the monthly plan.');
    checkoutActions.appendChild(makeActionButton('Pay $5 single report', function () {
      beginCheckout('single');
    }));
    checkoutActions.appendChild(makeSecondaryButton('Start $20/month plan', function () {
      beginCheckout('subscription');
    }));
  }

  async function beginCheckout(choice) {
    if (!state.checkoutEmail || !state.sessionId) return;
    setCheckoutStatus('info', 'Opening secure Stripe checkout.');
    try {
      const response = await postJson('/.netlify/functions/ca-checkout', {
        action: 'create',
        choice,
        sessionId: state.sessionId,
        email: state.checkoutEmail
      });
      if (response.unlockNow) {
        await finalizeDelivery();
        return;
      }
      if (response.url) window.location.href = response.url;
    } catch (error) {
      setCheckoutStatus('error', error.message || 'Could not start checkout.');
    }
  }

  async function finalizeDelivery(checkoutSessionId) {
    setCheckoutStatus('info', 'Unlocking your delivery bundle.');
    try {
      const response = await postJson('/.netlify/functions/ca-delivery', {
        sessionId: state.sessionId,
        email: state.checkoutEmail,
        checkoutSessionId: checkoutSessionId || ''
      });
      state.delivery = response;
      deliverySection.classList.remove('ca-hidden');
      downloadZip.href = response.downloads.zip;
      downloadPdf.href = response.downloads.pdf;
      downloadJson.href = response.downloads.json;
      purgeNote.textContent = 'Bundle stays available until the temporary session expires. Download or email it before then.';
      setCheckoutStatus('success', 'Bundle unlocked. Download the files below or send them by email.');
      window.scrollTo({ top: deliverySection.offsetTop - 120, behavior: 'smooth' });
    } catch (error) {
      setCheckoutStatus('error', error.message || 'Could not unlock the bundle.');
    }
  }

  async function sendBundle(targetEmail) {
    if (!state.delivery || !state.delivery.token) {
      emailStatus.className = 'ca-status is-error';
      emailStatus.textContent = 'Unlock the bundle first before sending it.';
      return;
    }
    emailStatus.className = 'ca-status is-info';
    emailStatus.textContent = 'Sending the PDF and ZIP bundle.';
    try {
      const response = await postJson('/.netlify/functions/ca-email', {
        sessionId: state.sessionId,
        token: state.delivery.token,
        to: targetEmail
      });
      emailStatus.className = 'ca-status is-success';
      emailStatus.textContent = 'Bundle sent to ' + response.to + '.';
    } catch (error) {
      emailStatus.className = 'ca-status is-error';
      emailStatus.textContent = error.message || 'Could not send the bundle by email.';
    }
  }

  async function hydrateCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('ca_session') || sessionStorage.getItem('ca-session') || '';
    const checkoutSessionId = params.get('session_id') || '';
    const checkoutState = params.get('checkout') || '';
    if (!sessionId) return;
    state.sessionId = sessionId;
    state.checkoutEmail = sessionStorage.getItem('ca-email-' + sessionId) || checkoutEmailInput.value.trim().toLowerCase();
    if (state.checkoutEmail) checkoutEmailInput.value = state.checkoutEmail;

    if (checkoutState === 'success' && checkoutSessionId && state.checkoutEmail) {
      setCheckoutStatus('info', 'Secure checkout completed. Finalizing the delivery bundle.');
      unlockSection.classList.remove('ca-hidden');
      await finalizeDelivery(checkoutSessionId);
      return;
    }
    if (checkoutState === 'canceled') {
      unlockSection.classList.remove('ca-hidden');
      setCheckoutStatus('error', 'Checkout was canceled. Your preview is still here if you want to try again.');
    }
  }

  function renderList(items) {
    return '<ul class="ca-list">' + items.map((item) => `<li>${escapeHtml(item)}</li>`).join('') + '</ul>';
  }

  function makeActionButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ca-button';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function makeSecondaryButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ca-button-secondary';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }
})();
