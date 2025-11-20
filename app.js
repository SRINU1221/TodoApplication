document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('logout-btn');

    const todoInput = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const todoList = document.getElementById('todo-list');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const dateDisplay = document.getElementById('date-display');
    const emptyState = document.getElementById('empty-state');

    // State
    let todos = [];
    let currentFilter = 'all';
    let token = localStorage.getItem('token');
    let user = JSON.parse(localStorage.getItem('user'));

    // API URL
    const API_URL = 'http://localhost:3000/api';

    // Initialize
    setDate();
    checkAuth();

    // Auth Event Listeners
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authError.textContent = '';
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authError.textContent = '';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        await login(username, password);
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        await register(username, password);
    });

    logoutBtn.addEventListener('click', logout);

    // App Event Listeners
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
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

    async function register(username, password) {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                // Auto login after register
                await login(username, password);
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
                body: JSON.stringify({ text })
            });

            if (res.ok) {
                const newTodo = await res.json();
                todos.unshift(newTodo);
                renderTodos();
                todoInput.value = '';
                todoInput.focus();
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

    function setDate() {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);
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

            filteredTodos.forEach(todo => {
                const li = document.createElement('li');
                li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
                li.dataset.id = todo.id;

                const createdDate = new Date(todo.created_at).toLocaleString();

                li.innerHTML = `
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    <div class="todo-content">
                        <span class="todo-text">${escapeHtml(todo.text)}</span>
                        <span class="todo-meta">Created by ${escapeHtml(user.username)} at ${createdDate}</span>
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
