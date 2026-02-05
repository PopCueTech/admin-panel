// ═════════════════════════════════════════════════════════
// CONFIGURATION
// ═════════════════════════════════════════════════════════

const API_BASE_URL = 'https://popcue-api-prod-g7mtgi7cwa-uc.a.run.app';
const TOKEN_KEY = 'popcue_admin_token';
const USER_KEY = 'popcue_admin_user';
const TENANT_ID_KEY = 'popcue_admin_tenant_id';

let currentUser = null;
let currentToken = null;
let currentSurveyData = null;

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

    // Show survey form by default
    showSurveyForm();
}

function showSurveyForm() {
    // Hide surveys list, show survey form
    const surveyFormSection = document.getElementById('surveyFormSection');
    const surveysListSection = document.getElementById('surveysListSection');
    const responseSection = document.getElementById('responseSection');
    const surveyForm = document.getElementById('surveyForm');

    if (surveyFormSection) surveyFormSection.style.display = 'block';
    if (surveysListSection) surveysListSection.style.display = 'none';
    if (responseSection) responseSection.style.display = 'none';
    if (surveyForm) surveyForm.style.display = 'block';

    // Scroll to top
    window.scrollTo(0, 0);
}

function showSurveysList() {
    // Hide survey form, show surveys list
    const surveyFormSection = document.getElementById('surveyFormSection');
    const surveysListSection = document.getElementById('surveysListSection');

    if (surveyFormSection) surveyFormSection.style.display = 'none';
    if (surveysListSection) surveysListSection.style.display = 'block';

    // Load surveys from API
    loadSurveysList();

    // Scroll to top
    window.scrollTo(0, 0);
}

async function loadSurveysList() {
    const tableBody = document.getElementById('surveysTableBody');
    const noCurveysMessage = document.getElementById('noCurveysMessage');

    if (!tableBody) {
        console.error('surveys table body not found');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            }
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
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${surveyId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            }
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

// ═════════════════════════════════════════════════════════
// SURVEY DETAILS VIEW
// ═════════════════════════════════════════════════════════

function showSurveyDetails(survey) {
    // Hide other sections
    document.getElementById('surveyFormSection').style.display = 'none';
    document.getElementById('surveysListSection').style.display = 'none';
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
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${surveyId}/report/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
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
        const response = await fetch(`${API_BASE_URL}/api/v1/surveys/${currentSurveyData.id}/unpublish`, {
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

        // Refresh the view
        await viewSurvey(currentSurveyData.id);
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
        console.error('Unpublish error:', error);
    }
}
