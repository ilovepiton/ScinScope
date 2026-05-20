const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  const { data, error } = await supabaseClient.auth.signUp({
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

  if (data.user) {
    alert("Account created. If email confirmation is enabled, check your email.");
    await checkSession();
  }
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
  }
}

function setupAccountPage() {
  document.getElementById("login-tab").onclick = switchToLogin;
  document.getElementById("register-tab").onclick = switchToRegister;

  document.getElementById("toggle-login-password").onclick = toggleLoginPassword;
  document.getElementById("toggle-register-password").onclick = toggleRegisterPassword;

  document.getElementById("login-form").onsubmit = loginUser;
  document.getElementById("register-form").onsubmit = registerUser;

  document.getElementById("logout-button").onclick = logoutUser;
}

document.addEventListener("DOMContentLoaded", function () {
  setupAccountPage();
  checkSession();
});
