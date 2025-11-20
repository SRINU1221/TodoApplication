document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const resetForm = document.getElementById('reset-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const backToLoginLink = document.getElementById('back-to-login');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('logout-btn');
    const todoInput = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const todoList = document.getElementById('todo-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const emptyState = document.getElementById('empty-state');
    const priorityToggle = document.getElementById('priority-toggle');

    // State
    let todos = [];
    let currentFilter = 'all';
    let token = localStorage.getItem('token');
    let user = null;

    try {
        user = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        user = null;
    }

    // Handle invalid token strings
    if (token === 'undefined' || token === 'null') {
        token = null;
        localStorage.removeItem('token');
    }

    let isPriorityInput = false;

    // API URL
    const API_URL = '/api';

    // Initialize
    checkAuth();

    // Auth Navigation
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        resetForm.classList.add('hidden');
        authError.textContent = '';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        resetForm.classList.add('hidden');
        authError.textContent = '';
    });

    showForgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        resetForm.classList.remove('hidden');
        authError.textContent = '';
    });

    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        resetForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authError.textContent = '';
    });

    // App Event Listeners
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    priorityToggle.addEventListener('click', () => {
        isPriorityInput = !isPriorityInput;
        priorityToggle.classList.toggle('active', isPriorityInput);
    });

    logoutBtn.addEventListener('click', logout);

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const recoveryPhrase = document.getElementById('register-recovery').value;

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, recoveryPhrase })
            });
            const data = await res.json();

            if (res.ok) {
                alert('Registration successful! Please login.');
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            } else {
                authError.textContent = data.error;
            }
        } catch (err) {
            authError.textContent = 'Failed to register';
        }
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        await login(username, password);
    });

    // Reset Password
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reset-username').value;
        const recoveryPhrase = document.getElementById('reset-recovery').value;
        const newPassword = document.getElementById('reset-password').value;

        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, recoveryPhrase, newPassword })
            });
            const data = await res.json();

            if (res.ok) {
                alert('Password reset successful! Please login with your new password.');
                resetForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            } else {
                authError.textContent = data.error;
            }
        } catch (err) {
            authError.textContent = 'Failed to reset password';
        }
    });

    // Auth Functions
    function checkAuth() {
        if (token && user) {
            showApp();
            fetchTodos();
        } else {
            showAuth();
        }
    }

    function showApp() {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
    }

    function showAuth() {
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    }

    async function login(username, password) {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                token = data.token;
                user = data.user;
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                checkAuth();
            } else {
                authError.textContent = data.error;
            }
        } catch (err) {
            authError.textContent = 'Failed to connect to server';
        }
    }

    function logout() {
        token = null;
        user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        todos = [];

        // Clear forms
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
        document.getElementById('register-recovery').value = '';

        checkAuth();
    }

    // Todo Functions
    async function fetchTodos() {
        try {
            const res = await fetch(`${API_URL}/todos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                todos = await res.json();
                renderTodos();
            } else if (res.status === 401 || res.status === 403) {
                logout();
            }
        } catch (err) {
            console.error('Error fetching todos:', err);
        }
    }

    async function addTodo() {
        const text = todoInput.value.trim();
        if (text === '') return;

        try {
            const res = await fetch(`${API_URL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ text, isPriority: isPriorityInput })
            });

            if (res.ok) {
                const newTodo = await res.json();
                todos.unshift(newTodo);
                // Re-sort locally to show priority at top immediately
                todos.sort((a, b) => {
                    if (a.is_priority === b.is_priority) {
                        return new Date(b.created_at) - new Date(a.created_at);
                    }
                    return b.is_priority - a.is_priority;
                });
                renderTodos();
                todoInput.value = '';
                todoInput.focus();

                // Reset priority toggle
                isPriorityInput = false;
                priorityToggle.classList.remove('active');
            }
        } catch (err) {
            console.error('Error adding todo:', err);
        }
    }

    async function toggleTodo(id, completed) {
        try {
            const res = await fetch(`${API_URL}/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ completed: !completed })
            });

            if (res.ok) {
                todos = todos.map(todo => {
                    if (todo.id === id) {
                        return { ...todo, completed: !completed };
                    }
                    return todo;
                });
                renderTodos();
            }
        } catch (err) {
            console.error('Error toggling todo:', err);
        }
    }

    async function deleteTodo(id) {
        const todoElement = document.querySelector(`[data-id="${id}"]`);
        if (todoElement) {
            todoElement.classList.add('removing');
            todoElement.addEventListener('animationend', async () => {
                try {
                    const res = await fetch(`${API_URL}/todos/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (res.ok) {
                        todos = todos.filter(todo => todo.id !== id);
                        renderTodos();
                    }
                } catch (err) {
                    console.error('Error deleting todo:', err);
                }
            });
        }
    }

    function renderTodos() {
        todoList.innerHTML = '';

        let filteredTodos = todos;
        if (currentFilter === 'active') {
            filteredTodos = todos.filter(todo => !todo.completed);
        } else if (currentFilter === 'completed') {
            filteredTodos = todos.filter(todo => todo.completed);
        }

        if (filteredTodos.length === 0) {
            emptyState.classList.add('visible');
        } else {
            emptyState.classList.remove('visible');

            const today = new Date().setHours(0, 0, 0, 0);

            filteredTodos.forEach(todo => {
                const li = document.createElement('li');
                li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.is_priority ? 'priority' : ''}`;
                li.dataset.id = todo.id;

                const createdDate = new Date(todo.created_at);
                const isCarriedOver = createdDate.setHours(0, 0, 0, 0) < today && !todo.completed;
                const dateString = createdDate.toLocaleString();

                li.innerHTML = `
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    <div class="todo-content">
                        <div class="todo-header">
                            <span class="todo-text">${escapeHtml(todo.text)}</span>
                            ${todo.is_priority ? '<span class="priority-star" title="High Priority">★</span>' : ''}
                            ${isCarriedOver ? '<span class="carried-over-tag">Carried Over</span>' : ''}
                        </div>
                        <span class="todo-meta">Created by ${escapeHtml(user.username)} at ${dateString}</span>
                    </div>
                    <button class="delete-btn" aria-label="Delete task">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                `;

                const checkbox = li.querySelector('.todo-checkbox');
                checkbox.addEventListener('change', () => toggleTodo(todo.id, todo.completed));

                const deleteBtn = li.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

                todoList.appendChild(li);
            });
        }
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
