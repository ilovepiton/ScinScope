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
  document.getElementById("login-tab").classList.add("active-auth-tab");
  document.getElementById("register-tab").classList.remove("active-auth-tab");

  document.getElementById("login-form").hidden = false;
  document.getElementById("register-form").hidden = true;
}

function switchToRegister() {
  document.getElementById("register-tab").classList.add("active-auth-tab");
  document.getElementById("login-tab").classList.remove("active-auth-tab");

  document.getElementById("register-form").hidden = false;
  document.getElementById("login-form").hidden = true;
}

function toggleSinglePassword(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);

  if (!input || !button) return;

  if (input.type === "password") {
    input.type = "text";
    button.textContent = "Hide Password";
  } else {
    input.type = "password";
    button.textContent = "Show Password";
  }
}

function toggleRegisterPasswords() {
  const password = document.getElementById("register-password");
  const repeat = document.getElementById("register-repeat-password");
  const button = document.getElementById("toggle-register-password");

  if (!password || !repeat || !button) return;

  if (password.type === "password") {
    password.type = "text";
    repeat.type = "text";
    button.textContent = "Hide Password";
  } else {
    password.type = "password";
    repeat.type = "password";
    button.textContent = "Show Password";
  }
}

function setupAuthTabs() {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");

  if (loginTab) loginTab.onclick = switchToLogin;
  if (registerTab) registerTab.onclick = switchToRegister;
}

function setupPasswordToggles() {
  const loginButton = document.getElementById("toggle-login-password");
  const registerButton = document.getElementById("toggle-register-password");

  if (loginButton) {
    loginButton.onclick = function () {
      toggleSinglePassword("login-password", "toggle-login-password");
    };
  }

  if (registerButton) {
    registerButton.onclick = toggleRegisterPasswords;
  }
}

function setupRegisterForm() {
  const form = document.getElementById("register-form");

  if (!form) return;

  form.onsubmit = function (event) {
    event.preventDefault();

    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();
    const repeatPassword = document.getElementById("register-repeat-password").value.trim();

    if (!name || !email || !password || !repeatPassword) {
      alert("Please fill in all fields.");
      return;
    }

    if (password !== repeatPassword) {
      alert("Passwords do not match.");
      return;
    }

    const user = {
      name: name,
      email: email,
      createdAt: new Date().toISOString()
    };

    saveDemoUser(user);
    showLoggedIn(user);
  };
}

function setupLoginForm() {
  const form = document.getElementById("login-form");

  if (!form) return;

  form.onsubmit = function (event) {
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
  };
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
  setupPasswordToggles();
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
