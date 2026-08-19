const loginForm = document.getElementById('login-form');
const loggedInView = document.getElementById('logged-in');
const statusEl = document.getElementById('status');

function showLoggedIn(email) {
  loginForm.style.display = 'none';
  loggedInView.style.display = 'block';
  document.getElementById('user-email').textContent = email;
}

function showLoginForm() {
  loginForm.style.display = 'block';
  loggedInView.style.display = 'none';
}

chrome.runtime.sendMessage({ type: 'AUTH_STATE' }, (res) => {
  if (res?.ok && res.loggedIn) showLoggedIn(res.email);
  else showLoginForm();
});

document.getElementById('login-btn').addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) {
    statusEl.textContent = 'נא למלא אימייל וסיסמה';
    statusEl.className = 'error';
    return;
  }
  statusEl.textContent = 'מתחבר...';
  statusEl.className = '';
  chrome.runtime.sendMessage({ type: 'LOGIN', email, password }, (res) => {
    if (res?.ok) {
      showLoggedIn(res.email);
    } else {
      statusEl.textContent = res?.error || 'שגיאה בהתחברות';
      statusEl.className = 'error';
    }
  });
});

document.getElementById('logout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
    showLoginForm();
  });
});
