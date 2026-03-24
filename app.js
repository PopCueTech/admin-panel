// ═════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════

const API_URL_PROD = 'https://popcue-api-prod-g7mtgi7cwa-uc.a.run.app';
const API_URL_DEV = 'https://popcue-api-812411253957.us-central1.run.app';
const TOKEN_KEY = 'popcue_admin_token';
const REFRESH_TOKEN_KEY = 'popcue_admin_refresh_token';
const USER_KEY = 'popcue_admin_user';
const TENANT_ID_KEY = 'popcue_admin_tenant_id';
const ENV_KEY = 'popcue_admin_env';

let API_BASE_URL = API_URL_PROD;
let currentUser = null;
let currentToken = null;
let currentSurveyData = null;
let currentSurveyMetrics = null;
let refreshTimer = null;

// ═════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Load saved environment
    const savedEnv = localStorage.getItem(ENV_KEY) || 'prod';
    applyEnvironment(savedEnv);

    // Check if user is already logged in
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser = JSON.parse(savedUser);
        startRefreshTimer();
        showMainPanel();
    }

    // Character counters
    document.getElementById('surveyName').addEventListener('input', (e) => {
        document.getElementById('nameCount').textContent = `${e.target.value.length}/500`;
    });

    document.getElementById('surveyDescription').addEventListener('input', (e) => {
        document.getElementById('descCount').textContent = `${e.target.value.length}/2000`;
    });

    document.getElementById('surveyContext').addEventListener('input', (e) => {
        document.getElementById('contextCount').textContent = `${e.target.value.length}/50000`;
    });

    // Form submission
    document.getElementById('surveyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateSurvey();
    });
});

// ═════════════════════════════════════════════════════════
// AUTHENTICATION
// ═════════════════════════════════════════════════════════

async function login() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    try {
        // Simulate login - replace with actual API call
        // In production, call your backend login endpoint
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();
        currentToken = data.access_token;
        currentUser = data.user;

        // Save to localStorage
        localStorage.setItem(TOKEN_KEY, currentToken);
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        if (data.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        }

        startRefreshTimer();
        showToast('Login successful!', 'success');
        showMainPanel();
    } catch (error) {
        showToast(`Login failed: ${error.message}`, 'error');
    }
}

function logout() {
    stopRefreshTimer();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    currentToken = null;
    currentUser = null;

    // Reset form
    const surveyForm = document.getElementById('surveyForm');
    if (surveyForm) surveyForm.reset();
    const responseSection = document.getElementById('responseSection');
    if (responseSection) responseSection.style.display = 'none';

    // Show auth section
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainPanel').style.display = 'none';
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';

    showToast('Logged out successfully', 'success');
}

// ═════════════════════════════════════════════════════════
// UI MANAGEMENT - NAVIGATION
// ═════════════════════════════════════════════════════════

function showMainPanel() {
    const authSection = document.getElementById('authSection');
    const mainPanel = document.getElementById('mainPanel');

    if (authSection) authSection.style.display = 'none';
    if (mainPanel) mainPanel.style.display = 'block';

    // Load tenants
    loadTenants();

    // Show dashboard by default
    showDashboard();
}

function showSurveyForm() {
    // Hide all sections except survey form
    hideAllSections();
    const surveyFormSection = document.getElementById('surveyFormSection');
    const responseSection = document.getElementById('responseSection');
    const surveyForm = document.getElementById('surveyForm');

    if (surveyFormSection) surveyFormSection.style.display = 'block';
    if (responseSection) responseSection.style.display = 'none';
    if (surveyForm) surveyForm.style.display = 'block';

    setActiveTab('create');

    // Scroll to top
    window.scrollTo(0, 0);
}

function showSurveysList() {
    // Hide all sections except surveys list
    hideAllSections();
    const surveysListSection = document.getElementById('surveysListSection');

    if (surveysListSection) surveysListSection.style.display = 'block';

    setActiveTab('list');

    // Load surveys from API
    loadSurveysList();

    // Scroll to top
    window.scrollTo(0, 0);
}

// ═════════════════════════════════════════════════════════
// DASHBOARD
// ═════════════════════════════════════════════════════════

async function showDashboard() {
    hideAllSections();
    document.getElementById('dashboardSection').style.display = 'block';
    setActiveTab('dashboard');
    await loadDashboard();
}

async function loadDashboard() {
    const timeFilter = document.getElementById('timeFilter').value;

    try {
        const response = await fetchWithAuth(
            `${API_BASE_URL}/api/v1/admin/stats?time_filter=${timeFilter}`
        );

        if (response.status === 403) {
            showToast('Admin access required', 'error');
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        displayDashboard(data);

    } catch (error) {
        console.error('Dashboard error:', error);
        showToast(`Failed to load dashboard: ${error.message}`, 'error');
    }
}

function displayDashboard(data) {
    // User metrics
    document.getElementById('totalUsers').textContent = data.users.total.toLocaleString();
    document.getElementById('activeUsers').textContent = data.users.active.toLocaleString();
    document.getElementById('newSignups').textContent = data.users.new_signups.toLocaleString();
    document.getElementById('userGrowth').textContent = `${data.users.growth_rate >= 0 ? '+' : ''}${data.users.growth_rate.toFixed(1)}%`;

    // Survey metrics
    document.getElementById('totalSurveys').textContent = data.surveys.total;
    document.getElementById('publishedSurveys').textContent = data.surveys.published;
    document.getElementById('completedSurveys').textContent = data.surveys.completed.toLocaleString();
    document.getElementById('incompleteSurveys').textContent = data.surveys.incomplete.toLocaleString();
    document.getElementById('completionRate').textContent = `${data.surveys.completion_rate.toFixed(1)}%`;

    // Reward metrics
    document.getElementById('pointsCirculation').textContent = data.rewards.points_in_circulation.toLocaleString();
    document.getElementById('totalEarned').textContent = data.rewards.total_earned.toLocaleString();
    document.getElementById('totalRedeemed').textContent = data.rewards.total_redeemed.toLocaleString();
    document.getElementById('redemptionRate').textContent = `${data.rewards.redemption_rate.toFixed(1)}%`;

    // Voucher metrics
    document.getElementById('voucherCount').textContent = data.vouchers.redemptions_count.toLocaleString();
    document.getElementById('voucherValue').textContent = `$${data.vouchers.redemptions_value_usd.toFixed(2)}`;

    const brandsHTML = data.vouchers.top_brands.map(b =>
        `<li>${b.brand}: ${b.redemption_count} ($${b.total_value_usd.toFixed(2)})</li>`
    ).join('');
    document.getElementById('topBrands').innerHTML = brandsHTML || '<li>No data</li>';

    // Referral metrics
    document.getElementById('referralSignups').textContent = data.referrals.total_signups.toLocaleString();
    document.getElementById('newReferrals').textContent = data.referrals.new_signups.toLocaleString();
    document.getElementById('referralConversion').textContent = `${data.referrals.conversion_rate.toFixed(1)}%`;

    // Cache info
    if (data.cache_info) {
        document.getElementById('cacheAge').textContent = `${data.cache_info.age_minutes.toFixed(1)} min ago`;
        document.getElementById('cacheExpires').textContent = `${data.cache_info.expires_in_minutes.toFixed(1)} min`;
    }
}

async function refreshDashboard() {
    const timeFilter = document.getElementById('timeFilter').value;

    try {
        showToast('Refreshing stats...', 'info');

        const response = await fetchWithAuth(
            `${API_BASE_URL}/api/v1/admin/stats/refresh?time_filter=${timeFilter}`,
            { method: 'POST' }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        displayDashboard(data);
        showToast('✅ Stats refreshed!', 'success');

    } catch (error) {
        console.error('Refresh error:', error);
        showToast(`Refresh failed: ${error.message}`, 'error');
    }
}

function hideAllSections() {
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('surveyFormSection').style.display = 'none';
    document.getElementById('surveysListSection').style.display = 'none';
    document.getElementById('notificationsSection').style.display = 'none';
    document.getElementById('surveyDetailsSection').style.display = 'none';
    document.getElementById('backfillDemographicsSection').style.display = 'none';
    document.getElementById('backfillMetricsSection').style.display = 'none';
    document.getElementById('emailBroadcastSection').style.display = 'none';
}

function setActiveTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'dashboard') document.querySelectorAll('.nav-tab')[0].classList.add('active');
    if (tab === 'create') document.querySelectorAll('.nav-tab')[1].classList.add('active');
    if (tab === 'list') document.querySelectorAll('.nav-tab')[2].classList.add('active');
    if (tab === 'notifications') document.querySelectorAll('.nav-tab')[3].classList.add('active');
    if (tab === 'backfill') document.querySelectorAll('.nav-tab')[4].classList.add('active');
    if (tab === 'metrics') document.querySelectorAll('.nav-tab')[5].classList.add('active');
    if (tab === 'email') document.querySelectorAll('.nav-tab')[6].classList.add('active');
}

async function loadSurveysList() {
    const tableBody = document.getElementById('surveysTableBody');
    const noCurveysMessage = document.getElementById('noCurveysMessage');

    if (!tableBody) {
        console.error('surveys table body not found');
        return;
    }

    try {
        // Use admin endpoint to get ALL surveys (not filtered by user/active)
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/surveys`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status === 403) {
            showToast('Admin access required to view surveys', 'error');
            throw new Error('Admin access required (403 Forbidden)');
        }

        if (!response.ok) {
            let detail = `HTTP ${response.status}`;
            try {
                const errData = await response.json();
                detail = errData.detail || detail;
            } catch (e) {}
            throw new Error(detail);
        }

        const surveys = await response.json();

        if (!surveys || surveys.length === 0) {
            tableBody.innerHTML = '';
            if (noCurveysMessage) noCurveysMessage.style.display = 'block';
            return;
        }

        if (noCurveysMessage) noCurveysMessage.style.display = 'none';

        // Populate table with surveys (includes completed_count from admin endpoint)
        tableBody.innerHTML = surveys.map(survey => `
            <tr>
                <td><strong>${survey.title || 'Untitled'}</strong></td>
                <td>${survey.questions_count || 0}</td>
                <td>
                    <span class="status-${survey.is_active ? 'active' : 'draft'}">
                        ${survey.is_active ? '✓ Published' : '⏱ Draft'}
                    </span>
                </td>
                <td>${survey.completed_count || 0} / ${survey.max_responses || 100}</td>
                <td>${new Date(survey.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewSurvey('${survey.id}')">View</button>
                    ${!survey.is_active ? `<button class="btn btn-sm btn-success" onclick="publishSurveyDirect('${survey.id}')">Publish</button>` : ''}
                </td>
            </tr>
        `).join('');

        console.log(`✅ Loaded ${surveys.length} survey(s)`);
    } catch (error) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: #e74c3c;">
                    Error loading surveys: ${error.message}
                </td>
            </tr>
        `;
        console.error('Error loading surveys:', error);
    }
}

async function viewSurvey(surveyId) {
    try {
        // Fetch survey details using the regular endpoint
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Failed to load survey details');
        }

        const surveyData = await response.json();
        currentSurveyData = surveyData;

        // Navigate to details view
        showSurveyDetails(surveyData);

        // Load metrics in background
        loadSurveyMetrics(surveyId);
    } catch (error) {
        showToast(`Error loading survey: ${error.message}`, 'error');
        console.error('Error:', error);
    }
}

async function publishSurveyDirect(surveyId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to publish survey');
        }

        const data = await response.json();
        showToast(`✅ ${data.message}`, 'success');

        // Reload surveys list
        loadSurveysList();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Publish error:', error);
    }
}

async function loadTenants() {
    const tenantSelect = document.getElementById('tenantId');

    try {
        // Fetch real tenants from API
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/auth/tenants`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            console.warn('Failed to fetch tenants from API, using fallback');
            loadMockTenants();
            return;
        }

        const data = await response.json();
        const tenants = data.tenants || data || [];

        if (tenants.length === 0) {
            console.warn('No tenants found in API response, using fallback');
            loadMockTenants();
            return;
        }

        // Clear existing options
        tenantSelect.innerHTML = '<option value="">Select Organization</option>';

        // Add real tenants
        tenants.forEach(tenant => {
            const option = document.createElement('option');
            option.value = tenant.id;
            option.textContent = tenant.name || `Tenant ${tenant.id.substring(0, 8)}`;
            tenantSelect.appendChild(option);
        });

        // Set first tenant as default
        if (tenants.length > 0) {
            tenantSelect.value = tenants[0].id;
            localStorage.setItem(TENANT_ID_KEY, tenants[0].id);
        }

        console.log(`✅ Loaded ${tenants.length} tenants from API`);
    } catch (error) {
        console.error('Error loading tenants:', error);
        loadMockTenants();
    }
}

function loadMockTenants() {
    // Fallback mock tenants if API fails
    const tenantSelect = document.getElementById('tenantId');
    const mockTenants = [
        { id: '00000000-0000-0000-0000-000000000001', name: 'Test Company' },
        { id: '00000000-0000-0000-0000-000000000002', name: 'Another Corp' }
    ];

    console.warn('⚠️ Using mock tenants - API call failed or returned no data');

    mockTenants.forEach(tenant => {
        const option = document.createElement('option');
        option.value = tenant.id;
        option.textContent = tenant.name;
        tenantSelect.appendChild(option);
    });

    // Set first tenant as default
    if (mockTenants.length > 0) {
        tenantSelect.value = mockTenants[0].id;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ═════════════════════════════════════════════════════════
// ENVIRONMENT SWITCHER
// ═════════════════════════════════════════════════════════

function applyEnvironment(env) {
    const banner = document.getElementById('envBanner');
    const label = document.getElementById('envLabel');
    const urlDisplay = document.getElementById('envUrl');
    const prodBtn = document.getElementById('envProdBtn');
    const devBtn = document.getElementById('envDevBtn');

    if (env === 'dev') {
        API_BASE_URL = API_URL_DEV;
        banner.className = 'env-banner env-dev';
        label.textContent = 'DEVELOPMENT';
        urlDisplay.textContent = API_URL_DEV.replace('https://', '');
        prodBtn.classList.remove('env-btn-active');
        devBtn.classList.add('env-btn-active');
    } else {
        API_BASE_URL = API_URL_PROD;
        banner.className = 'env-banner env-prod';
        label.textContent = 'PRODUCTION';
        urlDisplay.textContent = API_URL_PROD.replace('https://', '');
        prodBtn.classList.add('env-btn-active');
        devBtn.classList.remove('env-btn-active');
    }
}

function switchEnvironment(env) {
    const currentEnv = localStorage.getItem(ENV_KEY) || 'prod';
    if (env === currentEnv) return;

    const envName = env === 'dev' ? 'DEVELOPMENT' : 'PRODUCTION';
    if (!confirm(`Switch to ${envName} environment? You will be logged out.`)) {
        return;
    }

    // Logout and clear state
    stopRefreshTimer();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    currentToken = null;
    currentUser = null;

    // Save new env and apply
    localStorage.setItem(ENV_KEY, env);
    applyEnvironment(env);

    // Reset UI to login
    const surveyForm = document.getElementById('surveyForm');
    if (surveyForm) surveyForm.reset();
    const responseSection = document.getElementById('responseSection');
    if (responseSection) responseSection.style.display = 'none';

    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainPanel').style.display = 'none';
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';

    showToast(`Switched to ${envName}`, 'success');
}

// ═════════════════════════════════════════════════════════
// REFRESH TOKEN HANDLING
// ═════════════════════════════════════════════════════════

function startRefreshTimer() {
    stopRefreshTimer();
    // Refresh token every 25 minutes (access tokens typically expire at 30 min)
    refreshTimer = setTimeout(refreshAccessToken, 25 * 60 * 1000);
}

function stopRefreshTimer() {
    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
        console.warn('No refresh token available');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!response.ok) {
            console.error('Token refresh failed, logging out');
            logout();
            return false;
        }

        const data = await response.json();
        currentToken = data.access_token;
        localStorage.setItem(TOKEN_KEY, currentToken);

        if (data.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        }

        startRefreshTimer();
        console.log('Token refreshed successfully');
        return true;
    } catch (error) {
        console.error('Token refresh error:', error);
        logout();
        return false;
    }
}

async function fetchWithAuth(url, options = {}) {
    // Add auth header
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${currentToken}`;

    let response = await fetch(url, options);

    // If 401, attempt token refresh and retry once
    if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${currentToken}`;
            response = await fetch(url, options);
        }
    }

    return response;
}

// ═════════════════════════════════════════════════════════
// SURVEY GENERATION
// ═════════════════════════════════════════════════════════

async function generateSurvey() {
    const name = document.getElementById('surveyName').value;
    const description = document.getElementById('surveyDescription').value;
    const context = document.getElementById('surveyContext').value;
    const points = parseInt(document.getElementById('surveyPoints').value);
    const maxResponses = parseInt(document.getElementById('maxResponses').value) || 100;
    const tenantId = document.getElementById('tenantId').value;
    const surveyType = document.getElementById('surveyType').value;
    const isMultiConcept = document.querySelector('input[name="conceptType"]:checked').value === 'multi';

    if (!name || !description || !context || !tenantId || !surveyType) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Show loading spinner
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('responseSection').style.display = 'none';
    document.getElementById('surveyForm').style.display = 'none';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/generate-ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                description,
                context,
                points,
                max_responses: maxResponses,
                tenant_id: tenantId,
                test_type: surveyType,
                is_multi_concept: isMultiConcept,
                concepts: getConceptsFromForm()  // ss: send concepts with image URLs
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate survey');
        }

        const data = await response.json();

        // Display response
        displaySurveyResponse(data);
        showToast('Survey generated successfully!', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Generation error:', error);
    } finally {
        document.getElementById('loadingSpinner').style.display = 'none';
    }
}

function displaySurveyResponse(data) {
    const responseSection = document.getElementById('responseSection');
    const successMessage = document.getElementById('successMessage');
    const surveyDetails = document.getElementById('surveyDetails');

    // Set survey ID
    document.getElementById('surveyIdDisplay').textContent = data.survey_id;

    // Set questions count
    document.getElementById('questionsCountDisplay').textContent = data.questions_count;

    // Display structure
    document.getElementById('structurePreview').textContent = JSON.stringify(data.structure, null, 2);

    // Display warnings if any
    if (data.validation_warnings && data.validation_warnings.length > 0) {
        const warningsSection = document.getElementById('warningsSection');
        const warningsList = document.getElementById('warningsList');

        warningsList.innerHTML = data.validation_warnings
            .map(w => `<li>${w}</li>`)
            .join('');

        warningsSection.style.display = 'block';
    } else {
        document.getElementById('warningsSection').style.display = 'none';
    }

    // Show success message
    successMessage.textContent = data.message;
    successMessage.style.display = 'block';

    // Show details
    surveyDetails.style.display = 'block';
    responseSection.style.display = 'block';
}

function resetForm() {
    document.getElementById('surveyForm').reset();
    document.getElementById('surveyType').value = '';
    document.getElementById('responseSection').style.display = 'none';
    document.getElementById('surveyForm').style.display = 'block';
    document.getElementById('nameCount').textContent = '0/500';
    document.getElementById('descCount').textContent = '0/2000';
    document.getElementById('contextCount').textContent = '0/50000';
}

function copySurveyId() {
    const surveyId = document.getElementById('surveyIdDisplay').textContent;
    navigator.clipboard.writeText(surveyId).then(() => {
        showToast('Survey ID copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

function goToDashboard() {
    // Go back to survey creation form to create more surveys
    document.getElementById('surveyForm').style.display = 'block';
    document.getElementById('responseSection').style.display = 'none';

    // Reset form
    document.getElementById('surveyForm').reset();
    document.getElementById('surveyType').value = '';
    document.getElementById('nameCount').textContent = '0/500';
    document.getElementById('descCount').textContent = '0/2000';
    document.getElementById('contextCount').textContent = '0/50000';

    // Scroll to top
    window.scrollTo(0, 0);
}

// ═════════════════════════════════════════════════════════
// PUBLISH/UNPUBLISH SURVEY
// ═════════════════════════════════════════════════════════

async function publishSurvey() {
    const surveyId = document.getElementById('surveyIdDisplay').textContent;

    if (!surveyId) {
        showToast('No survey ID found', 'error');
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to publish survey');
        }

        const data = await response.json();
        showToast(`✅ ${data.message}`, 'success');

        // Update UI to show published status
        document.querySelector('.status-badge').textContent = 'Published (Live)';
        document.querySelector('.status-badge').style.backgroundColor = '#4CAF50';

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Publish error:', error);
    }
}

async function unpublishSurvey() {
    const surveyId = document.getElementById('surveyIdDisplay').textContent;

    if (!surveyId) {
        showToast('No survey ID found', 'error');
        return;
    }

    if (!confirm('Are you sure you want to unpublish this survey? Users won\'t be able to take it anymore.')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}/unpublish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to unpublish survey');
        }

        const data = await response.json();
        showToast(`✅ ${data.message}`, 'success');

        // Update UI to show draft status
        document.querySelector('.status-badge').textContent = 'Draft (Manual Review Required)';
        document.querySelector('.status-badge').style.backgroundColor = '#FF9800';

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Unpublish error:', error);
    }
}

// ═════════════════════════════════════════════════════════
// SURVEY DETAILS VIEW
// ═════════════════════════════════════════════════════════

function showSurveyDetails(survey) {
    // Hide all sections except survey details
    hideAllSections();
    document.getElementById('surveyDetailsSection').style.display = 'block';

    // Populate survey metadata
    document.getElementById('surveyTitleDetail').textContent = survey.title;
    document.getElementById('surveyDescriptionDetail').textContent = survey.description || 'No description';
    document.getElementById('surveyIdDetail').textContent = survey.id;
    document.getElementById('surveyPointsDetail').textContent = survey.points || 0;
    document.getElementById('surveyMaxResponsesDetail').textContent = survey.max_responses || 100;
    document.getElementById('surveyCreatedDetail').textContent = new Date(survey.created_at).toLocaleDateString();

    // Set status badge
    const statusBadge = document.getElementById('surveyStatusBadge');
    if (survey.is_active) {
        statusBadge.textContent = '✓ Published';
        statusBadge.className = 'status-badge status-active';
    } else {
        statusBadge.textContent = '⏱ Draft';
        statusBadge.className = 'status-badge status-draft';
    }

    // Display questions
    const questionsList = document.getElementById('questionsListDetail');
    if (survey.current_version && survey.current_version.structure && survey.current_version.structure.questions) {
        const questions = survey.current_version.structure.questions;
        document.getElementById('surveyQuestionsDetail').textContent = questions.length;

        questionsList.innerHTML = questions.map((q, idx) => {
            const options = q.answers || q.options || [];
            const optionsHTML = options.length > 0 ? `
                <div style="margin-top: 8px; padding-left: 12px; border-left: 2px solid #e5e7eb;">
                    ${options.map(opt => `<div style="font-size: 0.9em; color: #666; padding: 4px 0;">• ${opt.label || opt.text || opt}</div>`).join('')}
                </div>
            ` : '';
            return `
                <div class="question-item">
                    <strong>Q${idx + 1}:</strong> ${q.label || q.text || 'Untitled Question'}
                    <span class="question-type">(${q.type})</span>
                    ${optionsHTML}
                </div>
            `;
        }).join('');
    } else {
        document.getElementById('surveyQuestionsDetail').textContent = '0';
        questionsList.innerHTML = '<p>No questions available</p>';
    }

    // Show/hide action buttons based on status
    updateActionButtons(survey);

    // Scroll to top
    window.scrollTo(0, 0);
}

function updateActionButtons(survey) {
    const downloadBtn = document.getElementById('downloadReportBtn');
    const downloadMetricsBtn = document.getElementById('downloadMetricsBtn');
    const publishBtn = document.getElementById('publishDetailBtn');
    const unpublishBtn = document.getElementById('unpublishDetailBtn');

    // Only show download button for published surveys
    if (survey.is_active) {
        downloadBtn.style.display = 'inline-block';
        downloadMetricsBtn.style.display = 'inline-block';
        publishBtn.style.display = 'none';
        unpublishBtn.style.display = 'inline-block';
    } else {
        downloadBtn.style.display = 'none';
        downloadMetricsBtn.style.display = 'none';
        publishBtn.style.display = 'inline-block';
        unpublishBtn.style.display = 'none';
    }
}

function backToSurveysList() {
    currentSurveyData = null;
    showSurveysList();
}

function copySurveyIdDetail() {
    const surveyId = document.getElementById('surveyIdDetail').textContent;
    navigator.clipboard.writeText(surveyId).then(() => {
        showToast('Survey ID copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

// ═════════════════════════════════════════════════════════
// REPORT GENERATION
// ═════════════════════════════════════════════════════════

async function downloadSurveyReport() {
    if (!currentSurveyData) {
        showToast('No survey data available', 'error');
        return;
    }

    const surveyId = currentSurveyData.id;
    const downloadBtn = document.getElementById('downloadReportBtn');
    const loadingSpinner = document.getElementById('reportLoadingSpinner');

    try {
        // Disable button and show loading state
        downloadBtn.disabled = true;
        downloadBtn.textContent = '⏳ Generating Report...';
        loadingSpinner.style.display = 'flex';

        // Make API call to get PDF
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}/report/pdf`, {
            method: 'GET',
        });

        // Handle error responses
        if (!response.ok) {
            const contentType = response.headers.get('content-type');

            // Parse error message
            let errorMessage = 'Failed to generate report';
            if (contentType && contentType.includes('application/json')) {
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use status text
                    errorMessage = response.statusText || errorMessage;
                }
            }

            // Specific error handling
            if (response.status === 400) {
                throw new Error('Invalid survey ID format');
            } else if (response.status === 404) {
                if (errorMessage.includes('No responses') || errorMessage.includes('no responses')) {
                    throw new Error('No responses available yet. Reports can only be generated for surveys with at least one response.');
                } else {
                    throw new Error('Survey not found');
                }
            } else {
                throw new Error(errorMessage);
            }
        }

        // Convert response to blob
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey_${surveyId}_report.pdf`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Show success message
        showToast('✅ Report downloaded successfully!', 'success');

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Report download error:', error);
    } finally {
        // Reset button state
        downloadBtn.disabled = false;
        downloadBtn.textContent = '📊 Download Report (PDF)';
        loadingSpinner.style.display = 'none';
    }
}

// ═════════════════════════════════════════════════════════
// METRICS JSON DOWNLOAD
// ═════════════════════════════════════════════════════════

async function downloadMetricsJSON() {
    if (!currentSurveyMetrics || !currentSurveyData) {
        showToast('No metrics data available', 'error');
        return;
    }

    try {
        // Prepare the JSON data with survey info
        const jsonData = {
            survey_id: currentSurveyData.id,
            survey_title: currentSurveyData.title,
            survey_description: currentSurveyData.description,
            exported_at: new Date().toISOString(),
            metrics: currentSurveyMetrics
        };

        // Convert to JSON string
        const jsonString = JSON.stringify(jsonData, null, 2);

        // Create blob and download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey_${currentSurveyData.id}_metrics.json`;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showToast('✅ Metrics JSON downloaded successfully!', 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('JSON download error:', error);
    }
}

// ═════════════════════════════════════════════════════════
// SURVEY ACTIONS FROM DETAILS
// ═════════════════════════════════════════════════════════

async function publishSurveyFromDetail() {
    if (!currentSurveyData) return;

    await publishSurveyDirect(currentSurveyData.id);

    // Refresh the view with updated data
    await viewSurvey(currentSurveyData.id);
}

async function unpublishSurveyFromDetail() {
    if (!currentSurveyData) return;

    // Confirmation dialog
    if (!confirm('Are you sure you want to unpublish this survey? Users won\'t be able to take it anymore.')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${currentSurveyData.id}/unpublish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to unpublish survey');
        }

        const data = await response.json();
        showToast(`✅ ${data.message}`, 'success');

        // Refresh the view
        await viewSurvey(currentSurveyData.id);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Unpublish error:', error);
    }
}


// ═════════════════════════════════════════════════════════
// SURVEY METRICS
// ═════════════════════════════════════════════════════════

async function loadSurveyMetrics(surveyId) {
    const metricsCard = document.getElementById('metricsCard');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}/metrics`);

        if (!response.ok) {
            // If 404 or no data, show card with "no data" message
            if (response.status === 404) {
                metricsCard.style.display = 'block';
                document.getElementById('metricCompletedSessions').textContent = '0';
                document.getElementById('metricTotalResponses').textContent = '0';
                document.getElementById('metricCompletionRate').textContent = '0%';
                document.getElementById('kpiMetrics').innerHTML = '<p class="no-data">No responses yet. Metrics will appear after users complete this survey.</p>';
                document.getElementById('questionAnalyticsSection').style.display = 'none';
                return;
            }
            let detail = `HTTP ${response.status}`;
            try {
                const errData = await response.json();
                detail = errData.detail || detail;
            } catch (e) {}
            throw new Error(detail);
        }

        const data = await response.json();
        displayMetrics(data);
        metricsCard.style.display = 'block';

    } catch (error) {
        console.error('Metrics load error:', error);
        metricsCard.style.display = 'block';
        document.getElementById('kpiMetrics').innerHTML = `<p class="no-data">Failed to load metrics: ${error.message}</p>`;
    }
}

function parseRankingKey(keyStr) {
    // Extract 'id' from strings like "{'id': 'price', 'rank': 1}"
    try {
        const match = keyStr.match(/'id':\s*'([^']+)'/);
        return match ? match[1] : keyStr;
    } catch {
        return keyStr;
    }
}

function displayMetrics(data) {
    // Store metrics data for download
    currentSurveyMetrics = data;

    // Response stats
    document.getElementById('metricCompletedSessions').textContent = data.completed_sessions || 0;
    document.getElementById('metricTotalResponses').textContent = data.total_responses || 0;
    document.getElementById('metricCompletionRate').textContent =
        `${(data.completion_rate || 0).toFixed(1)}%`;

    // KPI metrics
    const kpiContainer = document.getElementById('kpiMetrics');
    const metrics = data.metrics || {};
    const concepts = data.concepts || {};
    const isMultiConcept = data.is_multi_concept || false;

    if ((!metrics || Object.keys(metrics).length === 0) && !isMultiConcept) {
        kpiContainer.innerHTML = '<p class="no-data">No metrics data yet. Metrics are calculated after survey responses are submitted.</p>';
        return;
    }

    let kpiHTML = '';

    // ─── CONCEPT COMPARISON (scrollable card layout) ───
    if (isMultiConcept && Object.keys(concepts).length > 0) {
        const conceptMetricLabels = {
            purchase_intent: { label: 'Purchase Intent', icon: '🛒' },
            repeat_intent: { label: 'Repeat Intent', icon: '🔄' },
            appeal: { label: 'Appeal', icon: '❤️' },
            decision_time: { label: 'Decision Time', icon: '⏱️' },
            hesitation_rate: { label: 'Hesitation Rate', icon: '🤔' },
        };

        // Collect all metric keys across concepts (excluding "label")
        const allMetricKeys = new Set();
        for (const c of Object.values(concepts)) {
            for (const key of Object.keys(c)) {
                if (key !== 'label') allMetricKeys.add(key);
            }
        }

        const sortedMetricKeys = Array.from(allMetricKeys);

        kpiHTML += `<div class="metrics-section">
            <div class="metrics-section-title">Concept Comparison</div>
            <div class="concept-cards">`;

        for (const [cId, concept] of Object.entries(concepts)) {
            const conceptLabel = concept.label || cId;

            // Find max value for each metric to determine winner
            const metricsForWinner = {};
            for (const mKey of sortedMetricKeys) {
                const values = Object.entries(concepts)
                    .map(([, c]) => c[mKey])
                    .filter(v => v != null);
                metricsForWinner[mKey] = values.length > 0 ? Math.max(...values) : null;
            }

            const isWinner = sortedMetricKeys.some(key => {
                const val = concept[key];
                return val !== null && val !== undefined && val === metricsForWinner[key];
            });

            kpiHTML += `<div class="concept-card ${isWinner ? 'concept-card--winner' : ''}">
                <div class="concept-card-title">${conceptLabel}</div>`;

            for (const mKey of sortedMetricKeys) {
                const val = concept[mKey];
                if (val === null || val === undefined) continue;

                const info = conceptMetricLabels[mKey] || { label: formatMetricLabel(mKey), icon: '📊' };
                const displayVal = typeof val === 'number' ? val.toFixed(1) : val;

                kpiHTML += `<div class="concept-metric-row">
                    <span class="concept-metric-row-icon">${info.icon}</span>
                    <span class="concept-metric-row-label">${info.label}</span>
                    <span class="concept-metric-row-value">${displayVal}</span>
                </div>`;
            }

            kpiHTML += `</div>`;
        }

        kpiHTML += `</div></div>`;
    }

    // ─── SHARED KPI METRICS (smaller cards) ───
    const metricLabels = {
        purchase_intent_percent: { label: 'Purchase Intent', unit: '%', icon: '🛒' },
        clarity_score: { label: 'Clarity Score', unit: '/5', icon: '💡' },
        visual_appeal_score: { label: 'Visual Appeal', unit: '/5', icon: '🎨' },
        perceived_quality_score: { label: 'Perceived Quality', unit: '/5', icon: '⭐' },
        shelf_impact_score: { label: 'Shelf Impact', unit: '/5', icon: '📦' },
        repeat_intent_percent: { label: 'Repeat Intent', unit: '%', icon: '🔄' },
        appeal_score: { label: 'Appeal', unit: '/5', icon: '❤️' },
        decision_time_median_ms: { label: 'Decision Time', unit: 'ms', icon: '⏱️' },
        decision_time_mean_seconds: { label: 'Decision Time', unit: 's', icon: '⏱️' },
        hesitation_rate_percent: { label: 'Hesitation Rate', unit: '%', icon: '🤔' },
    };

    let shownDecisionTime = false;
    const kpiCards = [];

    for (const [key, value] of Object.entries(metrics)) {
        if (key === 'pick_rates' || key === 'attribute_drivers') continue;
        if (value === null || value === undefined) continue;

        // Avoid showing both decision_time variants
        if (key === 'decision_time_mean_seconds' && metrics.decision_time_median_ms != null) continue;
        if (key.startsWith('decision_time') && shownDecisionTime) continue;
        if (key.startsWith('decision_time')) shownDecisionTime = true;

        const info = metricLabels[key] || { label: formatMetricLabel(key), unit: '', icon: '📊' };
        const displayValue = typeof value === 'number' ? value.toFixed(1) : value;

        kpiCards.push(`
            <div class="kpi-card">
                <span class="kpi-icon">${info.icon}</span>
                <span class="kpi-value">${displayValue}${info.unit}</span>
                <span class="kpi-label">${info.label}</span>
            </div>
        `);
    }

    if (kpiCards.length > 0) {
        kpiHTML += kpiCards.join('');
    }

    // ─── PICK RATES ───
    if (metrics.pick_rates && Object.keys(metrics.pick_rates).length > 0) {
        kpiHTML += `
            <div class="kpi-card kpi-wide">
                <span class="kpi-icon">🎯</span>
                <span class="kpi-label">Pick Rates</span>
                <div class="pick-rates-list">
                    ${Object.entries(metrics.pick_rates).map(([option, pct]) => {
                        const conceptLabel = concepts[option]?.label || option;
                        return `<div class="pick-rate-item">
                            <span class="pick-rate-label">${conceptLabel}</span>
                            <div class="pick-rate-bar-bg">
                                <div class="pick-rate-bar" style="width: ${pct}%"></div>
                            </div>
                            <span class="pick-rate-value">${pct.toFixed(1)}%</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // ─── RESPONDENT DEMOGRAPHICS ───
    if (data.respondent_demographics) {
        const demo = data.respondent_demographics;
        const hasAge = demo.age_known_count > 0;
        const hasGender = demo.respondent_count > 0;

        if (hasAge || hasGender) {
            const genderBars = demo.gender_distribution ? Object.entries(demo.gender_distribution)
                .filter(([, stats]) => stats.count > 0)
                .map(([gender, stats]) =>
                    `<div class="pick-rate-item">
                        <span class="pick-rate-label">${gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
                        <div class="pick-rate-bar-bg">
                            <div class="pick-rate-bar" style="width: ${stats.percent}%"></div>
                        </div>
                        <span class="pick-rate-value">${stats.percent.toFixed(1)}% (n=${stats.count})</span>
                    </div>`
                ).join('') : '';

            const ageBars = demo.age_distribution ? Object.entries(demo.age_distribution)
                .filter(([, stats]) => stats.count > 0)
                .map(([range, stats]) =>
                    `<div class="pick-rate-item">
                        <span class="pick-rate-label">${range}</span>
                        <div class="pick-rate-bar-bg">
                            <div class="pick-rate-bar" style="width: ${stats.percent}%"></div>
                        </div>
                        <span class="pick-rate-value">${stats.percent.toFixed(1)}% (n=${stats.count})</span>
                    </div>`
                ).join('') : '';

            kpiHTML += `
                <div class="kpi-card kpi-wide">
                    <span class="kpi-icon">👥</span>
                    <span class="kpi-label">Respondent Demographics</span>
                    <div style="padding: 12px 0;">
                        <div style="margin-bottom: 16px; font-size: 13px;">
                            <span style="font-weight: 500;">Total Respondents:</span> ${demo.respondent_count}
                        </div>
                        ${hasAge ? `
                        <div style="margin-bottom: 16px;">
                            <span style="font-weight: 500; font-size: 13px; display: block; margin-bottom: 8px;">Age Distribution (${demo.age_known_count} with data)</span>
                            <div class="pick-rates-list">
                                ${ageBars}
                            </div>
                        </div>
                        ` : ''}
                        ${hasGender ? `
                        <div style="margin-top: 12px;">
                            <span style="font-weight: 500; font-size: 13px; display: block; margin-bottom: 8px;">Gender Distribution</span>
                            <div class="pick-rates-list">
                                ${genderBars}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }

    kpiContainer.innerHTML = kpiHTML || '<p class="no-data">No metrics data yet</p>';

    // ─── QUESTION ANALYTICS ───
    const qaSection = document.getElementById('questionAnalyticsSection');

    if (data.question_analytics && data.question_analytics.length > 0) {
        let qaHTML = `<div class="metrics-section-title">Question Analytics</div>`;

        for (const qa of data.question_analytics) {
            const questionText = qa.question_text || qa.question_id;
            const totalResponses = qa.total_responses || 0;

            qaHTML += `<div class="qa-card">
                <div class="qa-header">
                    <span class="qa-question-text">${questionText}</span>
                    <span class="qa-type-badge">${qa.question_type || 'unknown'}</span>
                    <span class="qa-response-badge">n=${totalResponses}</span>
                </div>`;

            // Render based on question type
            if (qa.question_type === 'multi_slider' && qa.analytics?.sliders) {
                qaHTML += `<div>`;
                for (const [sliderId, slider] of Object.entries(qa.analytics.sliders)) {
                    const label = slider.label || sliderId;
                    const mean = slider.mean || 0;
                    const barWidth = Math.min((mean / 100) * 100, 100);
                    qaHTML += `
                        <div class="qa-slider-row">
                            <span class="qa-row-label">${label}</span>
                            <div class="qa-row-bar-bg">
                                <div class="qa-row-bar" style="width: ${barWidth}%"></div>
                            </div>
                            <span class="qa-row-value">${mean.toFixed(1)}</span>
                        </div>`;
                }
                qaHTML += `</div>`;
            } else if (qa.question_type === 'mcq' && qa.analytics?.options) {
                qaHTML += `<div>`;
                for (const [optId, opt] of Object.entries(qa.analytics.options)) {
                    const label = opt.label || optId;
                    const percent = opt.percent || 0;
                    const count = opt.count || 0;
                    qaHTML += `
                        <div class="qa-option-row">
                            <span class="qa-row-label">${label}</span>
                            <div class="qa-row-bar-bg">
                                <div class="qa-row-bar" style="width: ${percent}%"></div>
                            </div>
                            <span class="qa-row-value">${percent.toFixed(1)}% (n=${count})</span>
                        </div>`;
                }
                qaHTML += `</div>`;
            } else if (qa.question_type === 'ranking' && qa.analytics?.items) {
                const rankingItems = Object.entries(qa.analytics.items)
                    .map(([key, item]) => ({
                        id: parseRankingKey(key),
                        label: item.label || parseRankingKey(key),
                        avgRank: item.avg_rank || 0
                    }))
                    .sort((a, b) => a.avgRank - b.avgRank);

                qaHTML += `<div class="qa-rank-list">`;
                rankingItems.forEach((item, idx) => {
                    qaHTML += `
                        <div class="qa-rank-item">
                            <span class="qa-rank-number">${idx + 1}</span>
                            <span class="qa-row-label">${item.label}</span>
                        </div>`;
                });
                qaHTML += `</div>`;
            } else if (qa.question_type === 'text') {
                const responseCount = qa.analytics?.response_count || 0;
                qaHTML += `<div class="qa-text-note">📝 ${responseCount} open-ended response${responseCount !== 1 ? 's' : ''} (not displayed)</div>`;
            }

            qaHTML += `</div>`;
        }

        qaSection.innerHTML = qaHTML;
        qaSection.style.display = 'block';
    } else {
        qaSection.style.display = 'none';
    }
}

function formatMetricLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}


// ss: collect concept labels and image URLs from concept cards
function getConceptsFromForm() {
    const cards = document.getElementById('conceptCards');
    if (!cards) return [];
    const concepts = [];
    Array.from(cards.children).forEach((card) => {
        const idMatch = card.id.match(/concept-card-(\d+)/);
        if (!idMatch) return;
        const cid = idMatch[1];
        const label = (document.getElementById(`concept-label-${cid}`)?.value || '').trim();
        const imageUrl = (document.getElementById(`concept-imageurl-${cid}`)?.value || '').trim();
        if (label) {
            concepts.push({
                id: label.toLowerCase().replace(/\s+/g, '_'),
                label,
                image_url: imageUrl || null
            });
        }
    });
    return concepts;
}

// ═════════════════════════════════════════════════════════
// ADMIN NOTIFICATIONS
// ═════════════════════════════════════════════════════════

function showNotifications() {
    hideAllSections();
    document.getElementById('notificationsSection').style.display = 'block';
    setActiveTab('notifications');
    loadRecentNotifications();
    window.scrollTo(0, 0);
}

function showBackfillDemographics() {
    hideAllSections();
    document.getElementById('backfillDemographicsSection').style.display = 'block';
    setActiveTab('backfill');
    document.getElementById('backfillResultsSection').style.display = 'none';
    window.scrollTo(0, 0);
}

function updateBackfillUI() {
    // Update UI based on selected mode
    const mode = document.querySelector('input[name="backfillMode"]:checked').value;
    const surveyIdInput = document.getElementById('backfillSurveyId');

    if (mode === 'single') {
        surveyIdInput.style.display = 'block';
    } else {
        surveyIdInput.style.display = 'none';
    }
}

function hideBackfillResults() {
    document.getElementById('backfillResultsSection').style.display = 'none';
}

async function dryRunSingleSurvey() {
    const surveyId = document.getElementById('backfillSurveyId').value.trim();
    if (!surveyId) {
        showToast('❌ Please enter a Survey ID', 'error');
        return;
    }
    await backfillDemographics(surveyId, true, 'single');
}

async function backfillSingleSurvey() {
    const surveyId = document.getElementById('backfillSurveyId').value.trim();
    if (!surveyId) {
        showToast('❌ Please enter a Survey ID', 'error');
        return;
    }
    if (!confirm(`Backfill demographics for survey ${surveyId}? This will recalculate and update demographic data.`)) return;
    await backfillDemographics(surveyId, false, 'single');
}

async function dryRunAllSurveys() {
    await backfillDemographics(null, true, 'all');
}

async function backfillAllSurveys() {
    if (!confirm('⚠️ Backfill demographics for ALL surveys? This will process all surveys with completed responses. Continue?')) return;
    await backfillDemographics(null, false, 'all');
}

async function backfillDemographics(surveyId, dryRun, mode) {
    try {
        showToast('Processing backfill...', 'info');
        document.getElementById('backfillResultsSection').style.display = 'block';
        document.getElementById('backfillResultsContent').textContent = 'Processing...';

        let url = `${API_BASE_URL}/api/v1/admin/backfill-demographics?dry_run=${dryRun}`;
        if (surveyId) {
            url += `&survey_id=${surveyId}`;
        }

        const response = await fetchWithAuth(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const result = await response.json();

        // Format results for display
        let resultText = `${dryRun ? '🔍 DRY RUN' : '✅ EXECUTED'} - ${result.mode.toUpperCase()} BACKFILL\n`;
        resultText += `Surveys Processed: ${result.surveys_processed}\n`;
        resultText += `Dry Run Mode: ${dryRun}\n`;
        resultText += `\n${'='.repeat(80)}\n\n`;

        if (result.backfill_details && result.backfill_details.length > 0) {
            result.backfill_details.forEach((detail, idx) => {
                resultText += `Survey ${idx + 1}/${result.surveys_processed}\n`;
                resultText += `  Survey ID: ${detail.survey_id}\n`;
                resultText += `  Title: ${detail.survey_title}\n`;
                resultText += `  Changed: ${detail.changed ? 'YES' : 'NO'}\n\n`;

                if (detail.before) {
                    resultText += `  BEFORE (Old Demographics):\n`;
                    resultText += `${JSON.stringify(detail.before, null, 4).split('\n').map(l => '    ' + l).join('\n')}\n\n`;
                }

                if (detail.after) {
                    resultText += `  AFTER (New Demographics):\n`;
                    resultText += `${JSON.stringify(detail.after, null, 4).split('\n').map(l => '    ' + l).join('\n')}\n\n`;
                }

                resultText += `${'-'.repeat(80)}\n\n`;
            });
        }

        document.getElementById('backfillResultsContent').textContent = resultText;

        if (dryRun) {
            showToast(`✅ Dry run complete! Reviewed ${result.surveys_processed} survey(s)`, 'success');
        } else {
            showToast(`✅ Backfill complete! Updated ${result.surveys_processed} survey(s)`, 'success');
        }

    } catch (error) {
        console.error('Backfill error:', error);
        document.getElementById('backfillResultsContent').textContent = `ERROR:\n\n${error.message}`;
        showToast(`❌ Backfill failed: ${error.message}`, 'error');
    }
}

async function sendCustomNotification() {
    const title = document.getElementById('notifTitle').value.trim();
    const body = document.getElementById('notifBody').value.trim();
    const type = document.getElementById('notifType').value;

    if (!title || !body) {
        showToast('❌ Title and message are required', 'error');
        return;
    }

    if (!confirm(`Send "${title}" to ALL users? This cannot be undone.`)) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                body: body,
                notification_type: type
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to send notification');
        }

        const data = await response.json();
        showToast(`✅ Sent to ${data.success_count} users!`, 'success');

        // Clear form
        document.getElementById('notifTitle').value = '';
        document.getElementById('notifBody').value = '';

        // Refresh history
        loadRecentNotifications();
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

async function loadRecentNotifications() {
    const container = document.getElementById('recentNotifsList');
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/notifications/recent`);
        if (!response.ok) throw new Error('Failed to load');
        const items = await response.json();

        if (items.length === 0) {
            container.innerHTML = '<p style="color: #999;">No notifications sent yet.</p>';
            return;
        }

        const tableHTML = `
            <table class="surveys-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Recipients</th>
                        <th>Sent At</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(n => {
                        const sentAt = new Date(n.created_at).toLocaleString();
                        const preview = n.body.substring(0, 80) + (n.body.length > 80 ? '...' : '');
                        return `
                            <tr>
                                <td>
                                    <strong>${n.title}</strong><br>
                                    <small style="color: #666;">${preview}</small>
                                </td>
                                <td><span class="status-active">${n.notification_type}</span></td>
                                <td>${n.recipient_count}</td>
                                <td>${sentAt}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHTML;
    } catch (error) {
        container.innerHTML = `<p style="color: red;">Error loading history: ${error.message}</p>`;
    }
}

// ═══════════════════════════════════════════════════════════
// BACKFILL METRICS FUNCTIONS
// ═══════════════════════════════════════════════════════════

function showBackfillMetrics() {
    hideAllSections();
    document.getElementById('backfillMetricsSection').style.display = 'block';
    setActiveTab('metrics');
    document.getElementById('backfillMetricsResultsSection').style.display = 'none';
    window.scrollTo(0, 0);
}

function updateBackfillMetricsUI() {
    // Update UI based on selected mode
    const mode = document.querySelector('input[name="backfillMetricsMode"]:checked').value;
    const surveyIdInput = document.getElementById('backfillMetricsSurveyId');

    if (mode === 'single') {
        surveyIdInput.style.display = 'block';
    } else {
        surveyIdInput.style.display = 'none';
    }
}

function hideBackfillMetricsResults() {
    document.getElementById('backfillMetricsResultsSection').style.display = 'none';
}

async function dryRunMetricsSingleSurvey() {
    const surveyId = document.getElementById('backfillMetricsSurveyId').value.trim();
    if (!surveyId) {
        showToast('❌ Please enter a Survey ID', 'error');
        return;
    }
    await backfillMetrics(surveyId, true, 'single');
}

async function backfillMetricsSingleSurvey() {
    const surveyId = document.getElementById('backfillMetricsSurveyId').value.trim();
    if (!surveyId) {
        showToast('❌ Please enter a Survey ID', 'error');
        return;
    }
    if (!confirm(`Recalculate metrics for survey ${surveyId}? This will recalculate Decision Time and Hesitation using the latest formulas.`)) return;
    await backfillMetrics(surveyId, false, 'single');
}

async function dryRunMetricsAllSurveys() {
    await backfillMetrics(null, true, 'all');
}

async function backfillMetricsAllSurveys() {
    if (!confirm('⚠️ Recalculate metrics for ALL surveys? This will process all surveys with completed responses using the latest formulas. Continue?')) return;
    await backfillMetrics(null, false, 'all');
}

async function backfillMetrics(surveyId, dryRun, mode) {
    try {
        showToast('Processing metrics backfill...', 'info');
        document.getElementById('backfillMetricsResultsSection').style.display = 'block';
        document.getElementById('backfillMetricsResultsContent').textContent = 'Processing...';

        let url = `${API_BASE_URL}/api/v1/admin/backfill-metrics?dry_run=${dryRun}`;
        if (surveyId) {
            url += `&survey_id=${surveyId}`;
        }

        const response = await fetchWithAuth(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const result = await response.json();

        // Format results for display
        let resultText = `${dryRun ? '🔍 DRY RUN' : '✅ EXECUTED'} - ${result.mode.toUpperCase()} BACKFILL\n`;
        resultText += `Surveys Processed: ${result.surveys_processed}\n`;
        resultText += `Dry Run Mode: ${dryRun}\n`;
        resultText += `\n${'='.repeat(80)}\n\n`;

        if (result.backfill_details && result.backfill_details.length > 0) {
            result.backfill_details.forEach((detail, idx) => {
                resultText += `Survey ${idx + 1}/${result.surveys_processed}\n`;
                resultText += `  Survey ID: ${detail.survey_id}\n`;
                resultText += `  Title: ${detail.survey_title}\n`;
                resultText += `  Status: ${detail.status || 'success'}\n`;

                if (detail.completed_sessions !== undefined) {
                    resultText += `  Completed Sessions: ${detail.completed_sessions}\n`;
                }

                if (detail.old_metric_count !== undefined && detail.new_metric_count !== undefined) {
                    resultText += `  Metrics Before: ${detail.old_metric_count}\n`;
                    resultText += `  Metrics After: ${detail.new_metric_count}\n`;
                }

                if (detail.error) {
                    resultText += `  Error: ${detail.error}\n`;
                }

                resultText += `${'-'.repeat(80)}\n\n`;
            });
        }

        document.getElementById('backfillMetricsResultsContent').textContent = resultText;

        if (dryRun) {
            showToast(`✅ Dry run complete! Reviewed ${result.surveys_processed} survey(s)`, 'success');
        } else {
            showToast(`✅ Backfill complete! Updated ${result.surveys_processed} survey(s)`, 'success');
        }

    } catch (error) {
        console.error('Metrics backfill error:', error);
        document.getElementById('backfillMetricsResultsContent').textContent = `ERROR:\n\n${error.message}`;
        showToast(`❌ Backfill failed: ${error.message}`, 'error');
    }
}

// ═════════════════════════════════════════════════════════════════
// EMAIL BROADCAST
// ═════════════════════════════════════════════════════════════════

function showEmailBroadcast() {
    hideAllSections();
    document.getElementById('emailBroadcastSection').style.display = 'block';
    setActiveTab('email');
    loadEmailBroadcastHistory();
    window.scrollTo(0, 0);
}

async function sendEmailBroadcast() {
    const subject = document.getElementById('broadcastSubject').value.trim();
    const bodyHtml = document.getElementById('broadcastBody').value.trim();
    const bodyText = document.getElementById('broadcastBodyText').value.trim() || null;
    const filter = document.getElementById('broadcastFilter').value;

    if (!subject || !bodyHtml) {
        showToast('❌ Subject and message body are required', 'error');
        return;
    }

    const filterLabel = filter === 'verified' ? 'verified users' : 'all active users';
    if (!confirm(`Send "${subject}" to ALL ${filterLabel}? This cannot be undone.`)) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/email/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject: subject,
                body_html: bodyHtml,
                body_text: bodyText,
                recipient_filter: filter
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to queue email broadcast');
        }

        const data = await response.json();
        showToast(`✅ Email broadcast queued for ${data.total_recipients} recipients!`, 'success');

        // Clear form
        document.getElementById('broadcastSubject').value = '';
        document.getElementById('broadcastBody').value = '';
        document.getElementById('broadcastBodyText').value = '';

        // Refresh history after a short delay to let background task update status
        setTimeout(() => loadEmailBroadcastHistory(), 2000);
    } catch (error) {
        showToast(`❌ ${error.message}`, 'error');
    }
}

async function loadEmailBroadcastHistory() {
    const container = document.getElementById('emailBroadcastHistoryList');
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/email/broadcasts`);
        if (!response.ok) throw new Error('Failed to load broadcast history');
        const items = await response.json();

        if (items.length === 0) {
            container.innerHTML = '<p style="color: #999;">No broadcasts sent yet.</p>';
            return;
        }

        const tableHTML = `
            <table class="surveys-table">
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th>Filter</th>
                        <th>Status</th>
                        <th>Sent / Failed</th>
                        <th>Initiated By</th>
                        <th>Sent At</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>${item.subject}</td>
                            <td>${item.recipient_filter}</td>
                            <td><span style="color: ${item.status === 'completed' ? '#2e7d32' : item.status === 'failed' ? '#c62828' : '#f57c00'}; font-weight: 600;">${item.status}</span></td>
                            <td>${item.sent_count} / ${item.failed_count}</td>
                            <td style="font-size: 12px; color: #666;">${item.initiated_by}</td>
                            <td style="font-size: 12px;">${new Date(item.created_at).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = tableHTML;
    } catch (error) {
        container.innerHTML = `<p style="color: #c00;">Failed to load history: ${error.message}</p>`;
    }
}
