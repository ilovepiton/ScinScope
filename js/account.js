const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pendingEmail = "";
let pendingPassword = "";
let resendTimer = null;
let resendSeconds = 0;

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

function toggleCodeVisibility() {
  const inputs = document.querySelectorAll(".code-input");
  const button = document.getElementById("toggle-code-button");

  if (!inputs.length) return;

  const hidden = inputs[0].type === "password";

  inputs.forEach(function (input) {
    input.type = hidden ? "text" : "password";
  });

  button.textContent = hidden ? "Hide Code" : "Show Code";
}

function clearCodeInputs() {
  document.querySelectorAll(".code-input").forEach(function (input) {
    input.value = "";
    input.type = "password";
  });

  const button = document.getElementById("toggle-code-button");
  if (button) button.textContent = "Show Code";
}

function getCodeValue() {
  return Array.from(document.querySelectorAll(".code-input"))
    .map(function (input) {
      return input.value.trim();
    })
    .join("");
}

function startResendCooldown(seconds) {
  const button = document.getElementById("resend-code-button");

  if (!button) return;

  resendSeconds = seconds;
  button.disabled = true;
  button.classList.add("disabled-button");
  button.textContent = "Resend Code " + resendSeconds + "s";

  if (resendTimer) {
    clearInterval(resendTimer);
  }

  resendTimer = setInterval(function () {
    resendSeconds -= 1;

    if (resendSeconds <= 0) {
      clearInterval(resendTimer);
      resendTimer = null;

      button.disabled = false;
      button.classList.remove("disabled-button");
      button.textContent = "Resend Code";
      return;
    }

    button.textContent = "Resend Code " + resendSeconds + "s";
  }, 1000);
}

function openVerificationModal(email) {
  pendingEmail = email;

  const modal = document.getElementById("verification-modal");
  const emailText = document.getElementById("verification-email-text");

  clearCodeInputs();

  if (emailText) {
    emailText.textContent = email;
  }

  modal.hidden = false;
  startResendCooldown(60);

  setTimeout(function () {
    const firstInput = document.querySelector(".code-input");
    if (firstInput) firstInput.focus();
  }, 50);
}

function closeVerificationModal() {
  document.getElementById("verification-modal").hidden = true;
}

function setupCodeInputs() {
  const inputs = Array.from(document.querySelectorAll(".code-input"));

  inputs.forEach(function (input, index) {
    input.addEventListener("input", function () {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);

      if (input.value && inputs[index + 1]) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener("paste", function (event) {
      event.preventDefault();

      const pasted = event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 8);

      pasted.split("").forEach(function (number, pastedIndex) {
        if (inputs[pastedIndex]) {
          inputs[pastedIndex].value = number;
        }
      });

      const next = inputs[Math.min(pasted.length, inputs.length - 1)];
      if (next) next.focus();
    });
  });
}

function validateName(name) {
  const blockedNames = [
    "admin",
    "administrator",
    "support",
    "skinscope",
    "moderator",
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "nazi",
    "hitler",
    "porn",
    "sex"
  ];

  const lowerName = name.toLowerCase();

  const hasBlockedWord = blockedNames.some(function (word) {
    return lowerName.includes(word);
  });

  if (hasBlockedWord) {
    alert("Please choose another name. This name is not allowed.");
    return false;
  }

  if (name.length < 2) {
    alert("Name is too short.");
    return false;
  }

  if (name.length > 24) {
    alert("Name is too long. Please use 24 characters or less.");
    return false;
  }

  return true;
}

function validatePassword(password) {
  if (password.length < 8) {
    alert("Password must be at least 8 letters or numbers.");
    return false;
  }

  return true;
}

function showLoggedOut() {
  document.getElementById("auth-panel").hidden = false;
  document.getElementById("logged-panel").hidden = true;
  document.getElementById("header-account-menu").hidden = true;
}

async function showLoggedIn(user) {
  document.getElementById("auth-panel").hidden = true;
  document.getElementById("logged-panel").hidden = false;

  const name = user.user_metadata?.name || user.email.split("@")[0];

  document.getElementById("account-welcome").textContent = "Perfect, you’re signed in!";
  document.getElementById("account-email-text").textContent = "Signed in as " + user.email;

  document.getElementById("header-account-menu").hidden = false;
  document.getElementById("header-account-button").textContent = name + " ▼";
  document.getElementById("dropdown-name").textContent = name;
  document.getElementById("dropdown-email").textContent = user.email;

  await loadSubscription(user.id);
}

async function loadSubscription(userId) {
  const statusEl = document.getElementById("account-status");
  const planEl = document.getElementById("account-plan");
  const trialEl = document.getElementById("account-trial");

  const dropdownPlan = document.getElementById("dropdown-plan");
  const dropdownStatus = document.getElementById("dropdown-status");

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("plan, status, trial_ends_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    statusEl.textContent = "active";
    planEl.textContent = "trial";
    trialEl.textContent = "7 days after registration";

    dropdownPlan.textContent = "trial";
    dropdownStatus.textContent = "active";
    return;
  }

  statusEl.textContent = data.status;
  planEl.textContent = data.plan;

  dropdownPlan.textContent = data.plan;
  dropdownStatus.textContent = data.status;

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

  if (!validateName(name)) return;
  if (!validatePassword(password)) return;

  if (password !== repeatPassword) {
    alert("Passwords do not match.");
    return;
  }

  pendingEmail = email;
  pendingPassword = password;

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

  openVerificationModal(email);
}

async function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    alert("Please fill in all fields.");
    return;
  }

  if (!validatePassword(password)) return;

  pendingEmail = email;
  pendingPassword = password;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("email not confirmed") ||
      message.includes("not confirmed") ||
      message.includes("confirm")
    ) {
      openVerificationModal(email);
      return;
    }

    alert(error.message);
    return;
  }

  if (data.user) {
    await showLoggedIn(data.user);
  }
}

async function confirmAccount(event) {
  event.preventDefault();

  const code = getCodeValue();

  if (!pendingEmail) {
    alert("Email is missing. Please register or login again.");
    closeVerificationModal();
    return;
  }

  if (code.length !== 8) {
    alert("Please enter the verification code from your email.");
    return;
  }

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: pendingEmail,
    token: code,
    type: "signup"
  });

  if (error) {
    alert(error.message);
    return;
  }

  closeVerificationModal();

  if (data.user) {
    await showLoggedIn(data.user);
    return;
  }

  if (pendingEmail && pendingPassword) {
    const loginResult = await supabaseClient.auth.signInWithPassword({
      email: pendingEmail,
      password: pendingPassword
    });

    if (loginResult.data && loginResult.data.user) {
      await showLoggedIn(loginResult.data.user);
      return;
    }
  }

  alert("Account confirmed. Please login.");
  switchToLogin();
}

async function resendCode() {
  if (!pendingEmail) {
    alert("Email is missing. Please register or login again.");
    return;
  }

  const button = document.getElementById("resend-code-button");

  if (button && button.disabled) {
    return;
  }

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email: pendingEmail
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("security") || message.includes("seconds")) {
      startResendCooldown(60);
      return;
    }

    alert(error.message);
    return;
  }

  alert("A new confirmation code has been sent.");
  startResendCooldown(60);
}

async function logoutUser() {
  await supabaseClient.auth.signOut();

  document.getElementById("header-account-dropdown").hidden = true;

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

function setupAccountDropdown() {
  const button = document.getElementById("header-account-button");
  const dropdown = document.getElementById("header-account-dropdown");

  button.onclick = function () {
    dropdown.hidden = !dropdown.hidden;
  };
}

function setupAccountPage() {
  document.getElementById("login-tab").onclick = switchToLogin;
  document.getElementById("register-tab").onclick = switchToRegister;

  document.getElementById("toggle-login-password").onclick = toggleLoginPassword;
  document.getElementById("toggle-register-password").onclick = toggleRegisterPassword;
  document.getElementById("toggle-code-button").onclick = toggleCodeVisibility;

  document.getElementById("login-form").onsubmit = loginUser;
  document.getElementById("register-form").onsubmit = registerUser;
  document.getElementById("verification-form").onsubmit = confirmAccount;

  document.getElementById("resend-code-button").onclick = resendCode;
  document.getElementById("close-verification-button").onclick = closeVerificationModal;

  document.getElementById("logout-button").onclick = logoutUser;
  document.getElementById("dropdown-logout-button").onclick = logoutUser;

  setupCodeInputs();
  setupAccountDropdown();
}

document.addEventListener("DOMContentLoaded", function () {
  setupAccountPage();
  checkSession();
});
