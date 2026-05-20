const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pendingRegisterEmail = "";
let pendingRegisterPassword = "";

function showOnlyForm(formName) {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const confirmForm = document.getElementById("confirm-code-form");

  loginForm.hidden = formName !== "login";
  registerForm.hidden = formName !== "register";
  confirmForm.hidden = formName !== "confirm";
}

function switchToLogin() {
  document.getElementById("login-tab").classList.add("active-auth-tab");
  document.getElementById("register-tab").classList.remove("active-auth-tab");
  showOnlyForm("login");
}

function switchToRegister() {
  document.getElementById("register-tab").classList.add("active-auth-tab");
  document.getElementById("login-tab").classList.remove("active-auth-tab");
  showOnlyForm("register");
}

function switchToConfirmCode() {
  document.getElementById("register-tab").classList.add("active-auth-tab");
  document.getElementById("login-tab").classList.remove("active-auth-tab");
  showOnlyForm("confirm");
}

function toggleLoginPassword() {
  const input = document.getElementById("login-password");
  const button = document.getElementById("toggle-login-password");

  if (input.type === "password") {
    input.type = "text";
    button.textContent = "Hide Password";
  } else {
    input.type = "password";
    button.textContent = "Show Password";
  }
}

function toggleRegisterPassword() {
  const password = document.getElementById("register-password");
  const repeat = document.getElementById("register-repeat-password");
  const button = document.getElementById("toggle-register-password");

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

function showLoggedOut() {
  document.getElementById("auth-panel").hidden = false;
  document.getElementById("logged-panel").hidden = true;
}

async function showLoggedIn(user) {
  document.getElementById("auth-panel").hidden = true;
  document.getElementById("logged-panel").hidden = false;

  const name = user.user_metadata?.name || user.email.split("@")[0];

  document.getElementById("account-welcome").textContent = "Welcome, " + name;
  document.getElementById("account-email-text").textContent = user.email;

  await loadSubscription(user.id);
}

async function loadSubscription(userId) {
  const statusEl = document.getElementById("account-status");
  const planEl = document.getElementById("account-plan");
  const trialEl = document.getElementById("account-trial");

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("plan, status, trial_ends_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    statusEl.textContent = "Trial";
    planEl.textContent = "Trial";
    trialEl.textContent = "7 days after registration";
    return;
  }

  statusEl.textContent = data.status;
  planEl.textContent = data.plan;

  if (data.trial_ends_at) {
    const date = new Date(data.trial_ends_at);
    trialEl.textContent = date.toLocaleDateString();
  } else {
    trialEl.textContent = "No trial date";
  }
}

async function registerUser(event) {
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

  pendingRegisterEmail = email;
  pendingRegisterPassword = password;

  const { error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        name: name
      }
    }
  });

  if (error) {
    alert(error.message);
    return;
  }

  switchToConfirmCode();
}

async function confirmAccount(event) {
  event.preventDefault();

  const code = document.getElementById("confirm-code-input").value.trim();

  if (!pendingRegisterEmail) {
    alert("Email is missing. Please register again.");
    switchToRegister();
    return;
  }

  if (!code || code.length !== 6) {
    alert("Please enter the 6-digit code.");
    return;
  }

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: pendingRegisterEmail,
    token: code,
    type: "signup"
  });

  if (error) {
    alert(error.message);
    return;
  }

  if (data.user) {
    await showLoggedIn(data.user);
    return;
  }

  if (pendingRegisterEmail && pendingRegisterPassword) {
    const loginResult = await supabaseClient.auth.signInWithPassword({
      email: pendingRegisterEmail,
      password: pendingRegisterPassword
    });

    if (loginResult.error) {
      alert("Account confirmed. Please login.");
      switchToLogin();
      return;
    }

    if (loginResult.data.user) {
      await showLoggedIn(loginResult.data.user);
    }
  }
}

async function resendCode() {
  if (!pendingRegisterEmail) {
    alert("Email is missing. Please register again.");
    switchToRegister();
    return;
  }

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email: pendingRegisterEmail
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("A new confirmation code has been sent.");
}

async function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    alert("Please fill in all fields.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert(error.message);
    return;
  }

  if (data.user) {
    await showLoggedIn(data.user);
  }
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  showLoggedOut();
  switchToLogin();
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session && data.session.user) {
    await showLoggedIn(data.session.user);
  } else {
    showLoggedOut();
    switchToLogin();
  }
}

function setupAccountPage() {
  document.getElementById("login-tab").onclick = switchToLogin;
  document.getElementById("register-tab").onclick = switchToRegister;

  document.getElementById("toggle-login-password").onclick = toggleLoginPassword;
  document.getElementById("toggle-register-password").onclick = toggleRegisterPassword;

  document.getElementById("login-form").onsubmit = loginUser;
  document.getElementById("register-form").onsubmit = registerUser;
  document.getElementById("confirm-code-form").onsubmit = confirmAccount;

  document.getElementById("resend-code-button").onclick = resendCode;

  document.getElementById("back-to-register-button").onclick = function () {
    switchToRegister();
  };

  document.getElementById("logout-button").onclick = logoutUser;
}

document.addEventListener("DOMContentLoaded", function () {
  setupAccountPage();
  checkSession();
});
