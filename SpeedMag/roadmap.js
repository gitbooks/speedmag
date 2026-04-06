/* ==========================================
   SpeedMag — roadmap.js
   Public roadmap board: fetch, render, upvote, submit
   ========================================== */

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

document.addEventListener('DOMContentLoaded', () => {
    loadIdeas();
    initModal();
    initMobileMenu();
});

// ===== FETCH & RENDER IDEAS =====
async function loadIdeas() {
    const columns = ['submitted', 'under_review', 'in_progress', 'shipped'];
    columns.forEach(s => {
        document.getElementById('col-' + s).innerHTML = '<div class="loading-state"><div class="loading-spinner"></div>Loading...</div>';
    });

    try {
        const res = await fetch(API_BASE + '/ideas');
        if (!res.ok) throw new Error('Failed to fetch');
        const ideas = await res.json();

        // Group by status
        const grouped = { submitted: [], under_review: [], in_progress: [], shipped: [] };
        ideas.forEach(idea => {
            if (grouped[idea.status]) grouped[idea.status].push(idea);
        });

        columns.forEach(status => {
            const col = document.getElementById('col-' + status);
            const count = document.getElementById('count-' + status);
            count.textContent = grouped[status].length;

            if (grouped[status].length === 0) {
                col.innerHTML = '<div class="empty-state">No ideas yet</div>';
            } else {
                col.innerHTML = grouped[status].map(idea => renderCard(idea)).join('');
            }
        });

        // Attach upvote listeners
        document.querySelectorAll('.idea-upvote:not(.voted)').forEach(btn => {
            btn.addEventListener('click', () => handleUpvote(btn));
        });

    } catch (err) {
        console.error('Load ideas error:', err);
        columns.forEach(s => {
            document.getElementById('col-' + s).innerHTML =
                '<div class="empty-state">Could not load ideas. Is the server running?</div>';
        });
    }
}

function renderCard(idea) {
    const voted = getVotedIds().includes(idea.id);
    const votedClass = voted ? ' voted' : '';

    let html = `
        <div class="idea-card" data-id="${idea.id}">
            <div class="idea-title">${esc(idea.title)}</div>
            <div class="idea-desc">${esc(idea.description)}</div>`;

    if (idea.admin_response) {
        html += `
            <div class="idea-response">
                <div class="idea-response-label">SpeedMag Team</div>
                ${esc(idea.admin_response)}
            </div>`;
    }

    if (idea.status === 'shipped' && idea.changelog_url) {
        html += `
            <a href="${esc(idea.changelog_url)}" class="idea-changelog">
                View in Changelog
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 9l6-6m0 0H4m5 0v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </a>`;
    }

    html += `
            <div class="idea-meta">
                <span class="idea-author">${idea.author_name ? esc(idea.author_name) : 'Anonymous'}</span>
                <button class="idea-upvote${votedClass}" data-id="${idea.id}"${voted ? ' disabled' : ''}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10V2m0 0L2 6m4-4l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <span>${idea.upvote_count}</span>
                </button>
            </div>
        </div>`;

    return html;
}

// ===== UPVOTE =====
async function handleUpvote(btn) {
    const id = parseInt(btn.dataset.id);
    if (getVotedIds().includes(id)) return;

    btn.classList.add('voted');
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/ideas/${id}/upvote`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            btn.querySelector('span').textContent = data.upvote_count;
            saveVotedId(id);
        } else if (res.status === 409) {
            // Already voted server-side
            saveVotedId(id);
        } else {
            btn.classList.remove('voted');
            btn.disabled = false;
        }
    } catch {
        btn.classList.remove('voted');
        btn.disabled = false;
    }
}

function getVotedIds() {
    try {
        return JSON.parse(localStorage.getItem('speedmag_votes') || '[]');
    } catch { return []; }
}

function saveVotedId(id) {
    const ids = getVotedIds();
    if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem('speedmag_votes', JSON.stringify(ids));
    }
}

// ===== SUBMIT MODAL =====
function initModal() {
    const overlay = document.getElementById('submit-modal');
    const form = document.getElementById('idea-form');
    const success = document.getElementById('form-success');
    const titleInput = document.getElementById('idea-title');
    const titleCount = document.getElementById('title-count');

    document.getElementById('open-submit-modal').addEventListener('click', () => {
        overlay.classList.add('active');
        form.style.display = '';
        success.style.display = 'none';
        form.reset();
        titleCount.textContent = '0';
    });

    const closeModal = () => overlay.classList.remove('active');
    document.getElementById('close-submit-modal').addEventListener('click', closeModal);
    document.getElementById('cancel-submit').addEventListener('click', closeModal);
    document.getElementById('close-success').addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    titleInput.addEventListener('input', () => {
        titleCount.textContent = titleInput.value.length;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('idea-title').value.trim();
        const description = document.getElementById('idea-desc').value.trim();
        const author_name = document.getElementById('idea-name').value.trim() || null;

        if (!title || !description) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const res = await fetch(API_BASE + '/ideas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, author_name }),
            });

            if (res.ok) {
                form.style.display = 'none';
                success.style.display = '';
                loadIdeas(); // refresh board
            } else {
                const data = await res.json();
                alert(data.error || 'Submission failed. Try again.');
            }
        } catch {
            alert('Could not connect to server.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Idea';
        }
    });
}

// ===== MOBILE MENU (copied from main site) =====
function initMobileMenu() {
    const toggle = document.getElementById('mobile-toggle');
    const links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        links.classList.toggle('active');
        document.body.style.overflow = links.classList.contains('active') ? 'hidden' : '';
    });

    links.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            toggle.classList.remove('active');
            links.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

// ===== UTIL =====
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
