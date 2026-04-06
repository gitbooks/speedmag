/* ==========================================
   SpeedMag — admin.js
   Admin panel: auth, manage ideas, drag-and-drop
   ========================================== */

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

let currentIdeas = [];

document.addEventListener('DOMContentLoaded', () => {
    if (getToken()) {
        showDashboard();
    } else {
        showLogin();
    }
    initLogin();
    initLogout();
    initEditModal();
});

// ===== AUTH =====
function getToken() {
    return localStorage.getItem('speedmag_admin_token');
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
    };
}

function showLogin() {
    document.getElementById('login-section').style.display = '';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('admin-actions').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = '';
    document.getElementById('admin-actions').style.display = '';
    document.getElementById('admin-username').textContent = localStorage.getItem('speedmag_admin_user') || 'admin';
    loadAdminIdeas();
}

function initLogin() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value.trim();
        const password = document.getElementById('login-pass').value;
        const errEl = document.getElementById('login-error');
        errEl.textContent = '';

        try {
            const res = await fetch(API_BASE + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('speedmag_admin_token', data.token);
                localStorage.setItem('speedmag_admin_user', data.username);
                showDashboard();
            } else {
                errEl.textContent = data.error || 'Login failed';
            }
        } catch {
            errEl.textContent = 'Could not connect to server.';
        }
    });
}

function initLogout() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('speedmag_admin_token');
        localStorage.removeItem('speedmag_admin_user');
        showLogin();
    });
}

// ===== LOAD & RENDER IDEAS =====
async function loadAdminIdeas() {
    const columns = ['submitted', 'under_review', 'in_progress', 'shipped'];
    columns.forEach(s => {
        document.getElementById('admin-col-' + s).innerHTML = '<div class="loading-state"><div class="loading-spinner"></div></div>';
    });

    try {
        const res = await fetch(API_BASE + '/admin/ideas', { headers: getHeaders() });
        if (res.status === 401) {
            localStorage.removeItem('speedmag_admin_token');
            showLogin();
            return;
        }
        if (!res.ok) throw new Error('Failed');

        currentIdeas = await res.json();

        const grouped = { submitted: [], under_review: [], in_progress: [], shipped: [] };
        currentIdeas.forEach(idea => {
            if (grouped[idea.status]) grouped[idea.status].push(idea);
        });

        // Sort each group by upvotes descending
        Object.keys(grouped).forEach(k => {
            grouped[k].sort((a, b) => b.upvote_count - a.upvote_count);
        });

        columns.forEach(status => {
            const col = document.getElementById('admin-col-' + status);
            const count = document.getElementById('admin-count-' + status);
            count.textContent = grouped[status].length;

            if (grouped[status].length === 0) {
                col.innerHTML = '<div class="empty-state">Empty</div>';
            } else {
                col.innerHTML = grouped[status].map(renderAdminCard).join('');
            }
        });

        // Stats
        document.getElementById('stat-total').textContent = currentIdeas.length + ' ideas';
        document.getElementById('stat-new').textContent = grouped.submitted.length + ' new';

        // Attach listeners
        initDragAndDrop();
        document.querySelectorAll('.admin-card-edit').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.id)));
        });

    } catch (err) {
        console.error('Load admin ideas:', err);
    }
}

function renderAdminCard(idea) {
    const hasResponse = idea.admin_response ? '<span class="admin-card-badge">Responded</span>' : '';
    return `
        <div class="admin-card" draggable="true" data-id="${idea.id}">
            ${hasResponse}
            <div class="admin-card-title">${esc(idea.title)}</div>
            <div class="admin-card-desc">${esc(idea.description)}</div>
            <div class="admin-card-footer">
                <span class="admin-card-author">${idea.author_name ? esc(idea.author_name) : 'Anonymous'}</span>
                <span class="admin-card-votes">${idea.upvote_count} votes</span>
                <button class="admin-card-edit" data-id="${idea.id}">Edit</button>
            </div>
        </div>`;
}

// ===== DRAG AND DROP =====
function initDragAndDrop() {
    const cards = document.querySelectorAll('.admin-card[draggable]');
    const zones = document.querySelectorAll('.admin-drop-zone');

    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', card.dataset.id);
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            zones.forEach(z => z.classList.remove('drag-over'));
        });
    });

    zones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');

            const ideaId = e.dataTransfer.getData('text/plain');
            const newStatus = zone.dataset.status;

            try {
                const res = await fetch(`${API_BASE}/admin/ideas/${ideaId}`, {
                    method: 'PATCH',
                    headers: getHeaders(),
                    body: JSON.stringify({ status: newStatus }),
                });

                if (res.ok) {
                    loadAdminIdeas();
                }
            } catch (err) {
                console.error('Drag drop update failed:', err);
            }
        });
    });
}

// ===== EDIT MODAL =====
function initEditModal() {
    const overlay = document.getElementById('edit-modal');
    const statusSelect = document.getElementById('edit-status');
    const changelogGroup = document.getElementById('changelog-group');

    const closeModal = () => overlay.classList.remove('active');
    document.getElementById('close-edit-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-edit').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Show changelog field when status is shipped
    statusSelect.addEventListener('change', () => {
        changelogGroup.style.display = statusSelect.value === 'shipped' ? '' : 'none';
    });

    // Save
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const status = document.getElementById('edit-status').value;
        const admin_response = document.getElementById('edit-response').value.trim() || null;
        const changelog_url = document.getElementById('edit-changelog').value.trim() || null;

        try {
            const res = await fetch(`${API_BASE}/admin/ideas/${id}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ status, admin_response, changelog_url }),
            });

            if (res.ok) {
                closeModal();
                loadAdminIdeas();
            }
        } catch (err) {
            console.error('Update failed:', err);
        }
    });

    // Delete
    document.getElementById('delete-idea-btn').addEventListener('click', async () => {
        const id = document.getElementById('edit-id').value;
        if (!confirm('Delete this idea permanently?')) return;

        try {
            const res = await fetch(`${API_BASE}/admin/ideas/${id}`, {
                method: 'DELETE',
                headers: getHeaders(),
            });

            if (res.ok) {
                closeModal();
                loadAdminIdeas();
            }
        } catch (err) {
            console.error('Delete failed:', err);
        }
    });
}

function openEditModal(id) {
    const idea = currentIdeas.find(i => i.id === id);
    if (!idea) return;

    document.getElementById('edit-id').value = idea.id;
    document.getElementById('edit-title').textContent = idea.title;
    document.getElementById('edit-desc').textContent = idea.description;
    document.getElementById('edit-status').value = idea.status;
    document.getElementById('edit-response').value = idea.admin_response || '';
    document.getElementById('edit-changelog').value = idea.changelog_url || '';

    document.getElementById('changelog-group').style.display =
        idea.status === 'shipped' ? '' : 'none';

    document.getElementById('edit-modal').classList.add('active');
}

// ===== UTIL =====
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
