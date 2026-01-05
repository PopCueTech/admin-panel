// ═════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════

const API_BASE_URL = 'https://popcue-api-812411253957.us-central1.run.app';
const TOKEN_KEY = 'popcue_admin_token';
const USER_KEY = 'popcue_admin_user';
const TENANT_ID_KEY = 'popcue_admin_tenant_id';

let currentUser = null;
let currentToken = null;

// ═════════════════════════════════════════════════════════
// INITIALIZATION
// ═════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
        currentToken = savedToken;
        currentUser = JSON.parse(savedUser);
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

        // Save to localStorage
        localStorage.setItem(TOKEN_KEY, currentToken);
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));

        showToast('Login successful!', 'success');
        showMainPanel();
    } catch (error) {
        showToast(`Login failed: ${error.message}`, 'error');
    }
}

function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
    currentToken = null;
    currentUser = null;

    // Reset form
    document.getElementById('surveyForm').reset();
    document.getElementById('responseSection').style.display = 'none';

    // Show auth section
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainPanel').style.display = 'none';
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';

    showToast('Logged out successfully', 'success');
}

// ═════════════════════════════════════════════════════════
// UI MANAGEMENT
// ═════════════════════════════════════════════════════════

function showMainPanel() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainPanel').style.display = 'block';

    // Load tenants (mock data for now)
    loadTenants();
}

async function loadTenants() {
    const tenantSelect = document.getElementById('tenantId');

    try {
        // Fetch real tenants from API
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/tenants`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            }
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

    if (!name || !description || !context || !tenantId) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Show loading spinner
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('responseSection').style.display = 'none';
    document.getElementById('surveyForm').style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys/generate-ai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                name,
                description,
                context,
                points,
                tenant_id: tenantId
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
    // Replace with your dashboard URL
    window.location.href = 'https://your-dashboard.com';
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
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${surveyId}/publish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            }
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
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${surveyId}/unpublish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            }
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
