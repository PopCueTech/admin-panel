// ═════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════

const ENV_URLS = {
    prod: 'https://popcue-api-prod-g7mtgi7cwa-uc.a.run.app',
    dev: 'https://popcue-api-812411253957.us-central1.run.app'
};

const ENV_KEY = 'popcue_admin_env';
const TOKEN_KEY = 'popcue_admin_token';
const REFRESH_TOKEN_KEY = 'popcue_admin_refresh_token';
const USER_KEY = 'popcue_admin_user';
const TENANT_ID_KEY = 'popcue_admin_tenant_id';

let currentEnv = localStorage.getItem(ENV_KEY) || 'prod';
let API_BASE_URL = ENV_URLS[currentEnv];
let currentUser = null;
let currentToken = null;
let currentRefreshToken = null;
let currentSurveyData = null;
let refreshTimer = null;

// ═════════════════════════════════════════════════════════
// ENVIRONMENT SWITCHER
// ═════════════════════════════════════════════════════════

function initEnvSwitcher() {
    updateEnvUI(currentEnv);
}

function switchEnv(env) {
    if (env === currentEnv) return;

    const label = env === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT';
    if (!confirm(`Switch to ${label}? You will be logged out.`)) return;

    // Logout from current env
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    currentToken = null;
    currentRefreshToken = null;
    currentUser = null;
    if (refreshTimer) clearTimeout(refreshTimer);

    // Switch env
    currentEnv = env;
    API_BASE_URL = ENV_URLS[env];
    localStorage.setItem(ENV_KEY, env);

    updateEnvUI(env);

    // Show login
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainPanel').style.display = 'none';
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';

    showToast(`Switched to ${label}`, 'success');
}

function updateEnvUI(env) {
    const banner = document.getElementById('envBanner');
    const label = document.getElementById('envLabel');
    const url = document.getElementById('envUrl');
    const devBtn = document.getElementById('envDevBtn');
    const prodBtn = document.getElementById('envProdBtn');

    banner.className = `env-banner env-${env}`;
    label.textContent = env === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT';
    url.textContent = env === 'prod' ? 'popcue-api-prod' : 'popcue-api-dev';

    devBtn.classList.toggle('env-btn-active', env === 'dev');
    prodBtn.classList.toggle('env-btn-active', env === 'prod');
}

// ═════════════════════════════════════════════════════════
// TOKEN REFRESH
// ═════════════════════════════════════════════════════════

function scheduleTokenRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    // Refresh every 25 minutes (tokens typically expire at 30 min)
    refreshTimer = setTimeout(refreshAccessToken, 25 * 60 * 1000);
}

async function refreshAccessToken() {
    if (!currentRefreshToken) {
        console.warn('No refresh token available');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: currentRefreshToken })
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
            currentRefreshToken = data.refresh_token;
            localStorage.setItem(REFRESH_TOKEN_KEY, currentRefreshToken);
        }

        console.log('Token refreshed successfully');
        scheduleTokenRefresh();
        return true;
    } catch (error) {
        console.error('Token refresh error:', error);
        return false;
    }
}

async function fetchWithAuth(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${currentToken}`;

    let response = await fetch(url, options);

    // If 401, try refreshing token and retry once
    if (response.status === 401 && currentRefreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${currentToken}`;
            response = await fetch(url, options);
        }
    }

    return response;
}

// ═════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Initialize environment switcher
    initEnvSwitcher();

    // Check if user is already logged in
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    const savedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser = JSON.parse(savedUser);
        currentRefreshToken = savedRefreshToken;
        showMainPanel();
        scheduleTokenRefresh();
    }

    // Character counters
    document.getElementById('surveyName').addEventListener('input', (e) => {
        document.getElementById('nameCount').textContent = `${e.target.value.length}/500`;
    });

    document.getElementById('surveyDescription').addEventListener('input', (e) => {
        document.getElementById('descCount').textContent = `${e.target.value.length}/2000`;
    });

    document.getElementById('surveyContext').addEventListener('input', (e) => {
        document.getElementById('contextCount').textContent = `${e.target.value.length}/5000`;
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
        currentRefreshToken = data.refresh_token || null;

        // Save to localStorage
        localStorage.setItem(TOKEN_KEY, currentToken);
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        if (currentRefreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, currentRefreshToken);
        }

        showToast('Login successful!', 'success');
        showMainPanel();
        scheduleTokenRefresh();
    } catch (error) {
        showToast(`Login failed: ${error.message}`, 'error');
    }
}

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    currentToken = null;
    currentRefreshToken = null;
    currentUser = null;
    if (refreshTimer) clearTimeout(refreshTimer);

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
    document.getElementById('surveyDetailsSection').style.display = 'none';
}

function setActiveTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'dashboard') document.querySelectorAll('.nav-tab')[0].classList.add('active');
    if (tab === 'create') document.querySelectorAll('.nav-tab')[1].classList.add('active');
    if (tab === 'list') document.querySelectorAll('.nav-tab')[2].classList.add('active');
}

async function loadSurveysList() {
    const tableBody = document.getElementById('surveysTableBody');
    const noCurveysMessage = document.getElementById('noCurveysMessage');

    if (!tableBody) {
        console.error('surveys table body not found');
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys`, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Failed to load surveys');
        }

        const surveys = await response.json();

        if (!surveys || surveys.length === 0) {
            tableBody.innerHTML = '';
            if (noCurveysMessage) noCurveysMessage.style.display = 'block';
            return;
        }

        if (noCurveysMessage) noCurveysMessage.style.display = 'none';

        // Populate table with surveys
        tableBody.innerHTML = surveys.map(survey => `
            <tr>
                <td><strong>${survey.title || 'Untitled'}</strong></td>
                <td>${survey.current_version?.structure?.questions?.length || 0}</td>
                <td>
                    <span class="status-${survey.is_active ? 'active' : 'draft'}">
                        ${survey.is_active ? '✓ Published' : '⏱ Draft'}
                    </span>
                </td>
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
                <td colspan="5" style="text-align: center; padding: 20px; color: #e74c3c;">
                    ❌ Error loading surveys: ${error.message}
                </td>
            </tr>
        `;
        console.error('Error loading surveys:', error);
    }
}

async function viewSurvey(surveyId) {
    try {
        // Fetch survey details
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('Failed to load survey details');
        }

        const surveyData = await response.json();
        currentSurveyData = surveyData;

        // Navigate to details view
        showSurveyDetails(surveyData);
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
// SURVEY GENERATION
// ═════════════════════════════════════════════════════════

async function generateSurvey() {
    const name = document.getElementById('surveyName').value;
    const description = document.getElementById('surveyDescription').value;
    const context = document.getElementById('surveyContext').value;
    const points = parseInt(document.getElementById('surveyPoints').value);
    const tenantId = document.getElementById('tenantId').value;
    const surveyType = document.getElementById('surveyType').value;

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                context,
                points,
                tenant_id: tenantId,
                survey_type: surveyType
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
    document.getElementById('responseSection').style.display = 'none';
    document.getElementById('surveyForm').style.display = 'block';
    document.getElementById('nameCount').textContent = '0/500';
    document.getElementById('descCount').textContent = '0/2000';
    document.getElementById('contextCount').textContent = '0/5000';
    document.getElementById('surveyType').value = '';
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
    document.getElementById('nameCount').textContent = '0/500';
    document.getElementById('descCount').textContent = '0/2000';
    document.getElementById('contextCount').textContent = '0/5000';

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

        questionsList.innerHTML = questions.map((q, idx) => `
            <div class="question-item">
                <strong>Q${idx + 1}:</strong> ${q.label || q.text || 'Untitled Question'}
                <span class="question-type">(${q.type})</span>
            </div>
        `).join('');
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
    const publishBtn = document.getElementById('publishDetailBtn');
    const unpublishBtn = document.getElementById('unpublishDetailBtn');

    // Only show download button for published surveys
    if (survey.is_active) {
        downloadBtn.style.display = 'inline-block';
        publishBtn.style.display = 'none';
        unpublishBtn.style.display = 'inline-block';
    } else {
        downloadBtn.style.display = 'none';
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
        const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/surveys/${surveyId}/report/pdf`);

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
