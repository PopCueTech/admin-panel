// ═════════════════════════════════════════════════════════
// PROFILE QUESTIONNAIRES
// ═════════════════════════════════════════════════════════
//
// Profile questionnaires populate user_profiles.profile_attributes (a flexible
// JSONB key/value store) — they do NOT feed survey analytics. Each question
// carries an `attribute_key` that names the JSONB key on the user profile.
//
// Backend endpoints used:
//   GET  /api/v1/admin/surveys                (filtered to survey_kind='profile')
//   GET  /api/v1/admin/profile-attributes/keys (autocomplete hint)
//   GET  /api/v1/auth/tenants                  (tenant dropdown)
//   POST /api/v1/admin/profile-surveys         (manual create — no AI)

const PQ_QUESTION_TYPES = [
    { value: 'mcq', label: 'Multiple choice' },
    { value: 'rating', label: 'Rating (1–5)' },
    { value: 'text', label: 'Text input' },
    { value: 'slider', label: 'Slider' },
    { value: 'imageSelection', label: 'Image selection' },
    { value: 'ranking', label: 'Ranking' },
];

const PQ_ATTRIBUTE_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

let _pqQuestionCounter = 0;

// ─── Section entry / toggling ───────────────────────────────────────

async function showProfileQuestionnaires() {
    hideAllSections();
    const section = document.getElementById('profileQuestionnairesSection');
    if (section) section.style.display = 'block';
    setActiveTab('profile-questionnaires');

    document.getElementById('profileQuestionnaireListView').style.display = 'block';
    document.getElementById('profileQuestionnaireFormView').style.display = 'none';

    await loadProfileQuestionnairesList();
}

async function showProfileQuestionnaireForm() {
    // Stay inside the section, swap inner view from list → form
    document.getElementById('profileQuestionnaireListView').style.display = 'none';
    document.getElementById('profileQuestionnaireFormView').style.display = 'block';

    // Reset form state
    document.getElementById('pqTitle').value = '';
    document.getElementById('pqDescription').value = '';
    document.getElementById('pqPoints').value = 0;
    const publishEl = document.getElementById('pqPublish');
    if (publishEl) publishEl.checked = true;
    document.getElementById('pqQuestionCards').innerHTML = '';
    _pqQuestionCounter = 0;

    await populatePqTenantSelect();
    await loadProfileAttributeKeysHint();

    // Start with one default question card
    addProfileQuestionCard();
}

function closeProfileQuestionnaireForm() {
    document.getElementById('profileQuestionnaireFormView').style.display = 'none';
    document.getElementById('profileQuestionnaireListView').style.display = 'block';
}

// ─── List view ──────────────────────────────────────────────────────

async function loadProfileQuestionnairesList() {
    const tbody = document.getElementById('profileQuestionnairesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#999;">Loading…</td></tr>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/surveys`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const surveys = await response.json();

        // Backend's admin endpoint may not yet return survey_kind on the row;
        // also accept the metadata fallback embedded in current_version.structure
        const profileSurveys = (surveys || []).filter(s =>
            s.survey_kind === 'profile' ||
            (s.current_version &&
             s.current_version.structure &&
             s.current_version.structure.metadata &&
             s.current_version.structure.metadata.kind === 'profile')
        );

        if (profileSurveys.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:40px; color:#999;">
                        No profile questionnaires yet. Click <strong>+ Create profile questionnaire</strong> to add one.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = profileSurveys.map(s => `
            <tr>
                <td><strong>${escapePqHtml(s.title || 'Untitled')}</strong></td>
                <td>${s.questions_count || 0}</td>
                <td>${s.is_active
                    ? '<span class="badge badge-success">Published</span>'
                    : '<span class="badge badge-warning">Draft</span>'}</td>
                <td>${s.completed_count || 0}</td>
                <td>${s.points || 0}</td>
                <td style="font-size:12px; color:#666;">
                    ${s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `
            <tr><td colspan="6" style="text-align:center; padding:40px; color:#c62828;">
                Failed to load: ${escapePqHtml(error.message)}
            </td></tr>`;
        console.error('[profile_questionnaire] list load failed:', error);
    }
}

// ─── Form helpers ───────────────────────────────────────────────────

async function populatePqTenantSelect() {
    const select = document.getElementById('pqTenantId');
    if (!select) return;
    select.innerHTML = '<option value="">Select organization</option>';
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/auth/tenants`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const tenants = data.tenants || data || [];
        tenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name || `Tenant ${String(t.id).substring(0, 8)}`;
            select.appendChild(opt);
        });
        if (tenants.length > 0) select.value = tenants[0].id;
    } catch (e) {
        console.warn('[profile_questionnaire] tenant load failed:', e);
    }
}

async function loadProfileAttributeKeysHint() {
    const hint = document.getElementById('pqExistingKeysHint');
    if (!hint) return;
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/profile-attributes/keys`);
        if (!response.ok) {
            hint.textContent = '';
            return;
        }
        const data = await response.json();
        const keys = data.keys || [];
        if (keys.length === 0) {
            hint.textContent = 'No attribute_keys used yet — these become keys on user_profiles.profile_attributes.';
        } else {
            hint.innerHTML = `<strong>Existing keys:</strong> ${keys.map(k => `<code>${escapePqHtml(k)}</code>`).join(', ')}`;
        }
    } catch (e) {
        hint.textContent = '';
    }
}

// ─── Question cards ─────────────────────────────────────────────────

function addProfileQuestionCard() {
    _pqQuestionCounter++;
    const id = _pqQuestionCounter;
    const cards = document.getElementById('pqQuestionCards');
    const typeOptions = PQ_QUESTION_TYPES
        .map(t => `<option value="${t.value}">${t.label}</option>`).join('');

    const card = document.createElement('div');
    card.className = 'pq-question-card';
    card.id = `pq-q-${id}`;
    card.style.cssText = 'border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:10px; background:#f9fafb;';

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Question ${cards.children.length + 1}</strong>
            <button type="button" class="btn btn-ghost btn-sm" onclick="removeProfileQuestionCard(${id})" style="color:#c62828; padding:2px 8px;">Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label style="font-size:0.85rem;">Question title *</label>
                <input type="text" id="pq-title-${id}" placeholder="e.g. What's your dietary preference?">
            </div>
            <div class="form-group">
                <label style="font-size:0.85rem;">Type *</label>
                <select id="pq-type-${id}" onchange="onPqTypeChange(${id})">
                    ${typeOptions}
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label style="font-size:0.85rem;">attribute_key * <small style="color:#666; font-weight:400;">(snake_case, becomes the JSONB key)</small></label>
                <input type="text" id="pq-attrkey-${id}" placeholder="e.g. dietary_preference" pattern="^[a-z][a-z0-9_]*$">
            </div>
            <div class="form-group">
                <label style="font-size:0.85rem; display:flex; align-items:center; gap:6px; margin-top:24px;">
                    <input type="checkbox" id="pq-required-${id}" checked> Required
                </label>
            </div>
        </div>
        <div id="pq-typeconfig-${id}" style="margin-top:8px;"></div>
    `;
    cards.appendChild(card);
    onPqTypeChange(id);
}

function removeProfileQuestionCard(id) {
    const cards = document.getElementById('pqQuestionCards');
    if (cards.children.length <= 1) {
        showToast('At least one question is required', 'error');
        return;
    }
    const target = document.getElementById(`pq-q-${id}`);
    if (target) target.remove();
}

function onPqTypeChange(id) {
    const typeEl = document.getElementById(`pq-type-${id}`);
    const wrap = document.getElementById(`pq-typeconfig-${id}`);
    if (!typeEl || !wrap) return;
    const type = typeEl.value;

    if (type === 'mcq') {
        wrap.innerHTML = `
            <label style="font-size:0.85rem;">Options (one per line) *</label>
            <textarea id="pq-options-${id}" rows="4" placeholder="Vegetarian&#10;Vegan&#10;Pescatarian&#10;No restrictions"></textarea>
        `;
    } else if (type === 'slider') {
        wrap.innerHTML = `
            <div class="form-row">
                <div class="form-group"><label style="font-size:0.85rem;">Min</label>
                    <input type="number" id="pq-min-${id}" value="1"></div>
                <div class="form-group"><label style="font-size:0.85rem;">Max</label>
                    <input type="number" id="pq-max-${id}" value="10"></div>
                <div class="form-group"><label style="font-size:0.85rem;">Step</label>
                    <input type="number" id="pq-step-${id}" value="1"></div>
            </div>
        `;
    } else if (type === 'rating') {
        wrap.innerHTML = `<small style="color:#666;">Rating uses a fixed 1–5 scale.</small>`;
    } else {
        wrap.innerHTML = `<small style="color:#666;">No additional configuration needed for this question type.</small>`;
    }
}

// ─── Submit ─────────────────────────────────────────────────────────

function _collectPqQuestion(cardId) {
    const titleEl = document.getElementById(`pq-title-${cardId}`);
    const typeEl = document.getElementById(`pq-type-${cardId}`);
    const attrKeyEl = document.getElementById(`pq-attrkey-${cardId}`);
    const reqEl = document.getElementById(`pq-required-${cardId}`);
    if (!titleEl || !typeEl || !attrKeyEl) return null;

    const title = titleEl.value.trim();
    const type = typeEl.value;
    const attribute_key = attrKeyEl.value.trim();

    if (!title) throw new Error('A question is missing its title');
    if (!attribute_key) throw new Error(`Question "${title}" is missing an attribute_key`);
    if (!PQ_ATTRIBUTE_KEY_REGEX.test(attribute_key)) {
        throw new Error(`attribute_key "${attribute_key}" must be snake_case (a-z, 0-9, _; start with a letter)`);
    }

    const data = {};
    if (type === 'mcq') {
        const raw = (document.getElementById(`pq-options-${cardId}`)?.value || '').trim();
        const opts = raw.split('\n').map(s => s.trim()).filter(Boolean);
        if (opts.length < 2) throw new Error(`Question "${title}" needs at least 2 options`);
        data.options = opts.map((label, i) => ({ id: `opt_${i + 1}`, label }));
    } else if (type === 'slider') {
        data.min = Number(document.getElementById(`pq-min-${cardId}`)?.value || 1);
        data.max = Number(document.getElementById(`pq-max-${cardId}`)?.value || 10);
        data.step = Number(document.getElementById(`pq-step-${cardId}`)?.value || 1);
    }

    return {
        id: `q_${attribute_key}`,
        type,
        title,
        attribute_key,
        required: !!(reqEl && reqEl.checked),
        data,
    };
}

async function submitProfileQuestionnaire() {
    const title = document.getElementById('pqTitle').value.trim();
    const description = document.getElementById('pqDescription').value.trim();
    const points = Number(document.getElementById('pqPoints').value) || 0;
    const tenant_id = document.getElementById('pqTenantId').value;
    const publish = document.getElementById('pqPublish').checked;

    if (!title || title.length < 3) {
        showToast('Title is required (min 3 chars)', 'error');
        return;
    }
    if (!tenant_id) {
        showToast('Please select a tenant', 'error');
        return;
    }

    const cards = document.getElementById('pqQuestionCards').children;
    const questions = [];
    try {
        for (const card of cards) {
            const cardId = Number(card.id.replace('pq-q-', ''));
            const q = _collectPqQuestion(cardId);
            if (q) questions.push(q);
        }
    } catch (e) {
        showToast(e.message, 'error');
        return;
    }
    if (questions.length === 0) {
        showToast('Add at least one question', 'error');
        return;
    }

    const seen = new Set();
    for (const q of questions) {
        if (seen.has(q.attribute_key)) {
            showToast(`Duplicate attribute_key: ${q.attribute_key}`, 'error');
            return;
        }
        seen.add(q.attribute_key);
    }

    const payload = {
        title,
        description: description || null,
        points,
        tenant_id,
        questions,
        publish,
    };

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/profile-surveys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        showToast(`✅ Created profile questionnaire (${data.questions_count} questions)`, 'success');
        closeProfileQuestionnaireForm();
        await loadProfileQuestionnairesList();
    } catch (e) {
        showToast(`Failed: ${e.message}`, 'error');
    }
}

// ─── XSS-safe escape (locally named to avoid clobbering anything) ─

function escapePqHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
