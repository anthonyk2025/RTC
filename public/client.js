document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTION ---
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const createRoomBtn = document.getElementById('create-room-btn');
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');
    
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');
    
    const formContainer = document.querySelector('.form-container');
    const postLoginWrapper = document.querySelector('.post-login-wrapper');

    // If user is already logged in, show the create room section immediately
    if (localStorage.getItem('authToken')) {
        if(formContainer) formContainer.style.display = 'none';
        if(postLoginWrapper) postLoginWrapper.style.display = 'block';
    }

    // --- FORM TOGGLING LOGIC ---
    if (showRegisterLink && showLoginLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.style.display = 'none';
            registerCard.style.display = 'block';
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerCard.style.display = 'none';
            loginCard.style.display = 'block';
        });
    }

    const showMessage = (element, text, type) => {
        if(element) {
            element.textContent = text;
            element.className = `message ${type}`;
        }
    };

    // --- THIS IS THE MISSING PART ---
    // Helper function to generate a random room ID
    function generateRoomId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < 9; i++) {
            if (i > 0 && i % 3 === 0) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Event listener for the "Create a New Room" button
    if(createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            const roomId = generateRoomId();
            console.log(`Creating and redirecting to room: ${roomId}`);
            window.location.href = `/app.html?room=${roomId}`;
        });
    }
    // --- END OF MISSING PART ---

    // --- REGISTER FORM SUBMISSION ---
    if(registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            
            showMessage(registerMessage, 'Registering...', '');
            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    showMessage(registerMessage, 'Success! Please log in.', 'success');
                    setTimeout(() => {
                        registerCard.style.display = 'none';
                        loginCard.style.display = 'block';
                    }, 1500);
                } else {
                    showMessage(registerMessage, result.error, 'error');
                }
            } catch (error) {
                showMessage(registerMessage, 'Connection error.', 'error');
            }
        });
    }

    // --- LOGIN FORM SUBMISSION ---
    if(loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            
            showMessage(loginMessage, 'Logging in...', '');
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('authToken', result.token);
                    showMessage(loginMessage, 'Login successful!', 'success');
                    if(formContainer) formContainer.style.display = 'none';
                    if(postLoginWrapper) postLoginWrapper.style.display = 'block';
                } else {
                    showMessage(loginMessage, result.error, 'error');
                }
            } catch (error) {
                showMessage(loginMessage, 'Connection error.', 'error');
            }
        });
    }
});