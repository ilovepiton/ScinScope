function getDemoUser() {
  const savedUser = localStorage.getItem("skinscopeDemoUser");

  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch (error) {
    return null;
  }
}

function saveDemoUser(user) {
  localStorage.setItem("skinscopeDemoUser", JSON.stringify(user));
}

function showLoggedIn(user) {
  const authPanel = document.getElementById("auth-panel");
  const loggedPanel = document.getElementById("logged-panel");
  const welcome = document.getElementById("account-welcome");

  if (authPanel) authPanel.hidden = true;
  if (loggedPanel) loggedPanel.hidden = false;

  if (welcome) {
    welcome.textContent = "Welcome, " + user.name;
  }
}

function showLoggedOut() {
  const authPanel = document.getElementById("auth-panel");
  const loggedPanel = document.getElementById("logged-panel");

  if (authPanel) authPanel.hidden = false;
  if (loggedPanel) loggedPanel.hidden = true;
}

function switchToLogin() {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  loginTab.classList.add("active-auth-tab");
  registerTab.classList.remove("active-auth-tab");

  loginForm.hidden = false;
  registerForm.hidden = true;
}

function switchToRegister() {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  registerTab.classList.add("active-auth-tab");
  loginTab.classList.remove("active-auth-tab");

  registerForm.hidden = false;
  loginForm.hidden = true;
}

function setupAuthTabs() {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");

  if (loginTab) loginTab.onclick = switchToLogin;
  if (registerTab) registerTab.onclick = switchToRegister;
}

function setupRegisterForm() {
  const form = document.getElementById("register-form");

  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();

    if (!name || !email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    const user = {
      name: name,
      email: email,
      createdAt: new Date().toISOString()
    };

    saveDemoUser(user);
    showLoggedIn(user);
  });
}

function setupLoginForm() {
  const form = document.getElementById("login-form");

  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    const savedUser = getDemoUser();

    if (savedUser) {
      showLoggedIn(savedUser);
      return;
    }

    const demoUser = {
      name: email.split("@")[0],
      email: email,
      createdAt: new Date().toISOString()
    };

    saveDemoUser(demoUser);
    showLoggedIn(demoUser);
  });
}

function setupLogout() {
  const logoutButton = document.getElementById("logout-button");

  if (!logoutButton) return;

  logoutButton.onclick = function () {
    localStorage.removeItem("skinscopeDemoUser");
    showLoggedOut();
    switchToLogin();
  };
}

document.addEventListener("DOMContentLoaded", function () {
  setupAuthTabs();
  setupRegisterForm();
  setupLoginForm();
  setupLogout();

  const savedUser = getDemoUser();

  if (savedUser) {
    showLoggedIn(savedUser);
  } else {
    showLoggedOut();
  }
});
