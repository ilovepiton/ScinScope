const supabaseClient =
  window.supabase && typeof SUPABASE_URL !== "undefined" && typeof SUPABASE_ANON_KEY !== "undefined"
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

let pendingEmail = "";
let pendingPassword = "";
let pendingName = "";
let pendingVerificationMode = "custom";
let resendTimer = null;
let resendSeconds = 0;
let currentUser = null;
let currentProfile = null;

const ACCOUNT_PLAN_STORAGE_KEY = "skinscopeSelectedPlan";
const ACCOUNT_SCAN_HISTORY_KEY = "skinscopeScanHistory";
const ACCOUNT_VERIFIED_EMAILS_KEY = "skinscopeVerifiedEmails";
const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;
const VERIFICATION_CODE_LENGTH = 6;
const PRODUCTION_ACCOUNT_URL = "https://ilovepiton.github.io/ScinScope/pages/account.html";

const ACCOUNT_PLAN_LABELS = {
  free: "Free beta",
  monthly: "Premium Monthly",
  lifetime: "Lifetime"
};

function getDisplayMessage(text, fallback) {
  if (typeof text === "string") {
    return text.trim() || fallback;
  }

  if (text && typeof text.message === "string") {
    return text.message.trim() || fallback;
  }

  return fallback;
}

function showVerificationMessage(text, type = "error") {
  const message = document.getElementById("verification-message");
  if (!message) return;

  const displayText = getDisplayMessage(text, "Something went wrong. Please try again.");

  message.hidden = false;
  message.textContent = displayText;
  message.classList.remove("error", "success");
  message.classList.add(type);
}

function hideVerificationMessage() {
  const message = document.getElementById("verification-message");
  if (!message) return;

  message.hidden = true;
  message.textContent = "";
  message.classList.remove("error", "success");
}

function showPageMessage(text, type = "error") {
  const message = document.getElementById("auth-message");
  const displayText = getDisplayMessage(text, "Something went wrong. Please try again.");

  if (!message) {
    alert(displayText);
    return;
  }

  message.hidden = false;
  message.textContent = displayText;
  message.classList.remove("error", "success", "info");
  message.classList.add(type);
}

function clearPageMessage() {
  const message = document.getElementById("auth-message");
  if (!message) return;

  message.hidden = true;
  message.textContent = "";
  message.classList.remove("error", "success", "info");
}

function setButtonProcessing(buttonId, isProcessing, label, processingLabel) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  button.disabled = isProcessing;
  button.classList.toggle("disabled-button", isProcessing);
  button.textContent = isProcessing ? processingLabel : label;
}

function showDrawerMessage(id, text, type = "error") {
  const message = document.getElementById(id);
  if (!message) return;

  message.hidden = false;
  message.textContent = text;
  message.classList.remove("error", "success");
  message.classList.add(type);
}

function hideDrawerMessage(id) {
  const message = document.getElementById(id);
  if (!message) return;

  message.hidden = true;
  message.textContent = "";
  message.classList.remove("error", "success");
}

function switchToLogin() {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");

  loginTab.classList.add("active-auth-tab");
  registerTab.classList.remove("active-auth-tab");
  loginTab.setAttribute("aria-selected", "true");
  registerTab.setAttribute("aria-selected", "false");

  document.getElementById("login-form").hidden = false;
  document.getElementById("register-form").hidden = true;
  clearPageMessage();
}

function switchToRegister() {
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");

  registerTab.classList.add("active-auth-tab");
  loginTab.classList.remove("active-auth-tab");
  registerTab.setAttribute("aria-selected", "true");
  loginTab.setAttribute("aria-selected", "false");

  document.getElementById("register-form").hidden = false;
  document.getElementById("login-form").hidden = true;
  clearPageMessage();
}

function toggleLoginPassword() {
  const input = document.getElementById("login-password");
  const button = document.getElementById("toggle-login-password");

  if (input.type === "password") {
    input.type = "text";
    button.textContent = "Hide Password";
    button.setAttribute("aria-pressed", "true");
  } else {
    input.type = "password";
    button.textContent = "Show Password";
    button.setAttribute("aria-pressed", "false");
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
    button.setAttribute("aria-pressed", "true");
  } else {
    password.type = "password";
    repeat.type = "password";
    button.textContent = "Show Password";
    button.setAttribute("aria-pressed", "false");
  }
}

function clearCodeInputs() {
  document.querySelectorAll(".code-input").forEach(function (input) {
    input.value = "";
    input.type = "text";
  });
}

function getCodeValue() {
  return Array.from(document.querySelectorAll(".code-input"))
    .map(function (input) {
      return input.value.trim();
    })
    .join("");
}

function getAccountRedirectUrl() {
  if (window.location.hostname === "ilovepiton.github.io") {
    return new URL("/ScinScope/pages/account.html", window.location.origin).href;
  }

  return PRODUCTION_ACCOUNT_URL;
}

function getCustomVerificationEndpoint() {
  if (typeof SKINSCOPE_VERIFY_ENDPOINT !== "string") return "";
  return SKINSCOPE_VERIFY_ENDPOINT.trim().replace(/\/+$/, "");
}

function hasCustomVerificationEndpoint() {
  return getCustomVerificationEndpoint().length > 0;
}

async function callCustomVerification(path, payload) {
  const endpoint = getCustomVerificationEndpoint();

  if (!endpoint) {
    throw new Error("SkinScope verification server is not connected yet.");
  }

  const response = await fetch(endpoint + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "SkinScope verification failed. Please try again.");
  }

  return data;
}

function getCustomVerificationError(error) {
  const message = String(error && error.message ? error.message : error || "");

  if (message.toLowerCase().includes("not connected")) {
    return "SkinScope email verification is not connected yet. Your account was not created or logged in.";
  }

  return message || "SkinScope verification failed. Please try again.";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getSkinScopeVerifiedEmails() {
  try {
    const emails = JSON.parse(localStorage.getItem(ACCOUNT_VERIFIED_EMAILS_KEY)) || [];
    return Array.isArray(emails) ? emails.map(normalizeEmail).filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function isEmailVerifiedBySkinScope(email) {
  return getSkinScopeVerifiedEmails().includes(normalizeEmail(email));
}

function isUserVerifiedBySkinScope(user) {
  return Boolean(
    user &&
    (
      isEmailVerifiedBySkinScope(user.email) ||
      user.user_metadata?.skinscope_verified === true ||
      user.user_metadata?.skinscope_verified === "true"
    )
  );
}

function markEmailVerifiedBySkinScope(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const emails = getSkinScopeVerifiedEmails();
  if (!emails.includes(normalizedEmail)) {
    emails.push(normalizedEmail);
    localStorage.setItem(ACCOUNT_VERIFIED_EMAILS_KEY, JSON.stringify(emails.slice(-20)));
  }
}

async function rejectUnverifiedSession(message) {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  currentUser = null;
  currentProfile = null;
  showLoggedOut();
  switchToRegister();
  showPageMessage(message, "error");
}

async function sendCustomVerificationCode(email, name) {
  return callCustomVerification("/verification/start", {
    email: email,
    name: name
  });
}

async function confirmCustomVerificationCode(email, code) {
  return callCustomVerification("/verification/confirm", {
    email: email,
    code: code
  });
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
  hideVerificationMessage();

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
  hideVerificationMessage();

  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
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
        .slice(0, VERIFICATION_CODE_LENGTH);

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
    showPageMessage("Please choose another name. This name is not allowed.");
    return false;
  }

  if (name.length < 2) {
    showPageMessage("Name is too short.");
    return false;
  }

  if (name.length > 24) {
    showPageMessage("Name is too long. Please use 24 characters or less.");
    return false;
  }

  return true;
}

function validateEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showPageMessage("Please enter a valid email address.");
    return false;
  }

  return true;
}

function validatePassword(password) {
  if (password.length < 8) {
    showPageMessage("Password must be at least 8 letters or numbers.");
    return false;
  }

  return true;
}

function getFriendlyAuthError(errorMessage) {
  const message = String(errorMessage || "").toLowerCase();

  if (message.includes("rate limit") || message.includes("email rate limit")) {
    return "Too many email attempts. Please wait a few minutes before requesting a new code.";
  }

  if (message.includes("security") || message.includes("seconds")) {
    return "Please wait a moment before requesting another code.";
  }

  if (message.includes("token has expired") || message.includes("expired") || message.includes("invalid")) {
    return "This code is expired or invalid. Please request a new code and use the latest email.";
  }

  if (message.includes("already registered") || message.includes("already exists")) {
    return "This email already has an account. Please log in with your password.";
  }

  if (message.includes("email not confirmed") || message.includes("not confirmed")) {
    return "Please confirm your email first. Enter the code from your email.";
  }

  if (message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }

  if (message.includes("duplicate") || message.includes("unique")) {
    return "This name is already taken. Please choose another name.";
  }

  if (message.includes("password")) {
    return "Please check your password. It must be at least 8 characters.";
  }

  return errorMessage || "Something went wrong. Please try again.";
}

function getSafeFileExtension(file) {
  const fileName = file.name || "";
  const rawExt = fileName.split(".").pop().toLowerCase();

  const allowedExts = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

  if (allowedExts.includes(rawExt)) {
    return rawExt;
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";

  return "jpg";
}

function isLikelyImage(file) {
  const fileName = file.name || "";
  const lowerName = fileName.toLowerCase();

  if (file.type && file.type.startsWith("image/")) {
    return true;
  }

  return (
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".gif") ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".heif")
  );
}

function getProfileAvatarUrl(profile) {
  if (profile && profile.avatar_url) {
    return profile.avatar_url;
  }

  return "";
}

function getStoredAccountPlan() {
  const storedPlan = localStorage.getItem(ACCOUNT_PLAN_STORAGE_KEY);
  return ACCOUNT_PLAN_LABELS[storedPlan] ? storedPlan : "free";
}

function getAccountPlanLabel(plan) {
  return ACCOUNT_PLAN_LABELS[plan] || ACCOUNT_PLAN_LABELS.free;
}

function getStoredScanHistory() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_SCAN_HISTORY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function formatScanHistory() {
  const history = getStoredScanHistory();

  if (!history.length) {
    return "No saved scan history yet.";
  }

  return history
    .slice(0, 3)
    .map(function (item) {
      const date = new Date(item.createdAt);
      const dateLabel = Number.isNaN(date.getTime()) ? "recently" : date.toLocaleDateString();
      return item.label + " on " + dateLabel;
    })
    .join("; ");
}

function renderScanHistory() {
  const summary = formatScanHistory();
  const accountHistory = document.getElementById("account-scan-history");
  const drawerHistory = document.getElementById("drawer-scan-history");

  if (accountHistory) accountHistory.textContent = summary;
  if (drawerHistory) drawerHistory.textContent = summary;
}

function setAvatarImages(url) {
  const profileImage = document.getElementById("profile-avatar-image");
  const profileFallback = document.getElementById("profile-avatar-fallback");
  const drawerImage = document.getElementById("drawer-avatar-image");
  const drawerFallback = document.getElementById("drawer-avatar-fallback");
  const headerImage = document.getElementById("header-account-avatar");
  const headerFallback = document.getElementById("header-avatar-fallback");

  if (url) {
    if (profileImage) {
      profileImage.src = url;
      profileImage.hidden = false;
    }

    if (profileFallback) profileFallback.hidden = true;

    if (drawerImage) {
      drawerImage.src = url;
      drawerImage.hidden = false;
    }

    if (drawerFallback) drawerFallback.hidden = true;

    if (headerImage) {
      headerImage.src = url;
      headerImage.hidden = false;
    }

    if (headerFallback) headerFallback.hidden = true;
  } else {
    if (profileImage) {
      profileImage.src = "";
      profileImage.hidden = true;
    }

    if (profileFallback) profileFallback.hidden = false;

    if (drawerImage) {
      drawerImage.src = "";
      drawerImage.hidden = true;
    }

    if (drawerFallback) drawerFallback.hidden = false;

    if (headerImage) {
      headerImage.src = "";
      headerImage.hidden = true;
    }

    if (headerFallback) headerFallback.hidden = false;
  }
}

async function loadProfile(user) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, name, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    currentProfile = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split("@")[0],
      avatar_url: ""
    };

    return currentProfile;
  }

  currentProfile = data;
  return data;
}

function showLoggedOut() {
  document.getElementById("auth-panel").hidden = false;
  document.getElementById("logged-panel").hidden = true;
  document.getElementById("header-account-menu").hidden = true;
  setAvatarImages("");

  const accountNavLink = document.getElementById("account-nav-link");
  if (accountNavLink) accountNavLink.hidden = false;
}

async function showLoggedIn(user) {
  if (!isUserVerifiedBySkinScope(user)) {
    await rejectUnverifiedSession("Finish SkinScope email verification before logging in. You are not signed in yet.");
    return;
  }

  currentUser = user;

  document.getElementById("auth-panel").hidden = true;
  document.getElementById("logged-panel").hidden = false;

  const profile = await loadProfile(user);
  const name = profile.name || user.user_metadata?.name || user.email.split("@")[0];
  const avatarUrl = getProfileAvatarUrl(profile);

  document.getElementById("account-welcome").textContent = "Perfect, you’re signed in!";
  document.getElementById("account-email-text").textContent = "Signed in as " + user.email;

  document.getElementById("header-account-menu").hidden = false;
  document.getElementById("header-account-name").textContent = name;

  const accountNavLink = document.getElementById("account-nav-link");
  if (accountNavLink) accountNavLink.hidden = true;

  document.getElementById("drawer-name").textContent = name;
  document.getElementById("drawer-email").textContent = user.email;

  setAvatarImages(avatarUrl);
  renderScanHistory();

  await loadSubscription(user.id);
}

async function loadSubscription(userId) {
  const statusEl = document.getElementById("account-status");
  const planEl = document.getElementById("account-plan");
  const trialEl = document.getElementById("account-trial");

  const drawerPlan = document.getElementById("drawer-plan");
  const drawerStatus = document.getElementById("drawer-status");
  const drawerTrial = document.getElementById("drawer-trial");

  const { data, error } = await supabaseClient
    .from("subscriptions")
    .select("plan, status, trial_ends_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    const storedPlan = getStoredAccountPlan();
    const planLabel = getAccountPlanLabel(storedPlan);

    statusEl.textContent = "active";
    planEl.textContent = planLabel + " (demo)";
    trialEl.textContent = storedPlan === "free" ? "7 days after registration" : "Demo selection only";

    drawerPlan.textContent = planLabel + " (demo)";
    drawerStatus.textContent = "active";
    drawerTrial.textContent = storedPlan === "free" ? "7 days after registration" : "Demo selection only";
    return;
  }

  statusEl.textContent = data.status;
  planEl.textContent = data.plan;

  drawerPlan.textContent = data.plan;
  drawerStatus.textContent = data.status;

  if (data.trial_ends_at) {
    const date = new Date(data.trial_ends_at);
    const formattedDate = date.toLocaleDateString();

    trialEl.textContent = formattedDate;
    drawerTrial.textContent = formattedDate;
  } else {
    trialEl.textContent = "No trial date";
    drawerTrial.textContent = "No trial date";
  }
}

async function registerUser(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showPageMessage("Authentication is unavailable because Supabase did not load. Check the network connection and Supabase config.");
    return;
  }

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const repeatPassword = document.getElementById("register-repeat-password").value.trim();

  if (!name || !email || !password || !repeatPassword) {
    showPageMessage("Please fill in all fields.");
    return;
  }

  if (!validateName(name)) return;
  if (!validateEmail(email)) return;
  if (!validatePassword(password)) return;

  if (password !== repeatPassword) {
    showPageMessage("Passwords do not match.");
    return;
  }

  pendingEmail = email;
  pendingPassword = password;
  pendingName = name;

  setButtonProcessing("register-submit-button", true, "Create Account", "Creating...");

  try {
    pendingVerificationMode = "custom";

    if (!hasCustomVerificationEndpoint()) {
      showPageMessage(getCustomVerificationError(new Error("SkinScope verification server is not connected yet.")));
      return;
    }

    await sendCustomVerificationCode(email, name);
    showPageMessage("SkinScope sent a verification code to your email.", "success");
    openVerificationModal(email);
  } catch (error) {
    showPageMessage(getCustomVerificationError(error));
  } finally {
    setButtonProcessing("register-submit-button", false, "Create Account", "Creating...");
  }
}

async function createAccountAfterCustomVerification() {
  const { data, error } = await supabaseClient.auth.signUp({
    email: pendingEmail,
    password: pendingPassword,
    options: {
      emailRedirectTo: getAccountRedirectUrl(),
      data: {
        name: pendingName,
        skinscope_verified: true
      }
    }
  });

  if (error) {
    const message = String(error.message || "").toLowerCase();

    if (message.includes("already registered") || message.includes("already exists")) {
      const loginResult = await supabaseClient.auth.signInWithPassword({
        email: pendingEmail,
        password: pendingPassword
      });

      if (loginResult.data && loginResult.data.user) {
        markEmailVerifiedBySkinScope(pendingEmail);
        await supabaseClient.auth.updateUser({
          data: {
            skinscope_verified: true
          }
        });
        await showLoggedIn(loginResult.data.user);
        return;
      }
    }

    throw error;
  }

  if (data.session && data.session.user) {
    markEmailVerifiedBySkinScope(pendingEmail);
    await showLoggedIn(data.session.user);
    return;
  }

  if (data.user && data.user.email_confirmed_at) {
    markEmailVerifiedBySkinScope(pendingEmail);
    await showLoggedIn(data.user);
    return;
  }

  if (pendingEmail && pendingPassword) {
    const loginResult = await supabaseClient.auth.signInWithPassword({
      email: pendingEmail,
      password: pendingPassword
    });

    if (loginResult.data && loginResult.data.user) {
      markEmailVerifiedBySkinScope(pendingEmail);
      await showLoggedIn(loginResult.data.user);
      return;
    }
  }

  throw new Error("Email is verified by SkinScope, but Supabase still requires email confirmation. Turn off Supabase email confirmation after connecting the custom verifier.");
}

async function loginUser(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showPageMessage("Authentication is unavailable because Supabase did not load. Check the network connection and Supabase config.");
    return;
  }

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    showPageMessage("Please fill in all fields.");
    return;
  }

  if (!validateEmail(email)) return;
  if (!validatePassword(password)) return;

  pendingEmail = email;
  pendingPassword = password;

  setButtonProcessing("login-submit-button", true, "Login", "Logging in...");

  try {
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
        pendingVerificationMode = "custom";

        if (!hasCustomVerificationEndpoint()) {
          showPageMessage("This account is not verified by SkinScope yet, and SkinScope email verification is not connected.");
          return;
        }

        pendingName = email.split("@")[0];
        await sendCustomVerificationCode(email, pendingName);
        openVerificationModal(email);
        showVerificationMessage("Enter the SkinScope code to finish account verification.", "success");
        return;
      }

      showPageMessage(getFriendlyAuthError(error.message));
      return;
    }

    if (data.user) {
      await showLoggedIn(data.user);

      if (currentUser) {
        showPageMessage("Logged in successfully.", "success");
      }
    }
  } finally {
    setButtonProcessing("login-submit-button", false, "Login", "Logging in...");
  }
}

async function confirmAccount(event) {
  event.preventDefault();

  if (!supabaseClient) {
    showVerificationMessage("Authentication is unavailable because Supabase did not load.", "error");
    return;
  }

  hideVerificationMessage();

  const code = getCodeValue();

  if (!pendingEmail) {
    showVerificationMessage("Email is missing. Please register or login again.", "error");
    return;
  }

  if (code.length !== VERIFICATION_CODE_LENGTH) {
    showVerificationMessage("Please enter the full " + VERIFICATION_CODE_LENGTH + "-digit code from your email, or click the verification link in the email.", "error");
    return;
  }

  const submitButton = document.querySelector("#verification-form .verification-submit");

  if (submitButton && submitButton.disabled) {
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.add("disabled-button");
    submitButton.textContent = "Confirming...";
  }

  try {
    if (!hasCustomVerificationEndpoint()) {
      showVerificationMessage(getCustomVerificationError(new Error("SkinScope verification server is not connected yet.")), "error");
      return;
    }

    pendingVerificationMode = "custom";
    await confirmCustomVerificationCode(pendingEmail, code);
    closeVerificationModal();
    showPageMessage("Email verified by SkinScope. Creating your account...", "success");
    await createAccountAfterCustomVerification();
  } catch (error) {
    showVerificationMessage(getCustomVerificationError(error), "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove("disabled-button");
      submitButton.textContent = "Confirm Account";
    }
  }
}

async function resendCode() {
  hideVerificationMessage();

  if (!supabaseClient) {
    showVerificationMessage("Authentication is unavailable because Supabase did not load.", "error");
    return;
  }

  if (!pendingEmail) {
    showVerificationMessage("Email is missing. Please register or login again.", "error");
    return;
  }

  const button = document.getElementById("resend-code-button");

  if (button && button.disabled) {
    return;
  }

  if (!hasCustomVerificationEndpoint()) {
    showVerificationMessage(getCustomVerificationError(new Error("SkinScope verification server is not connected yet.")), "error");
    return;
  }

  try {
    pendingVerificationMode = "custom";
    await sendCustomVerificationCode(pendingEmail, pendingName);
    showVerificationMessage("A new SkinScope verification code has been sent.", "success");
    startResendCooldown(30);
  } catch (error) {
    showVerificationMessage(getCustomVerificationError(error), "error");
  }
}

function openAccountDrawer() {
  document.getElementById("account-drawer").hidden = false;
  hideDrawerMessage("avatar-message");
}

function closeAccountDrawer() {
  document.getElementById("account-drawer").hidden = true;
}

function openLogoutConfirm() {
  document.getElementById("logout-confirm-modal").hidden = false;
}

function closeLogoutConfirm() {
  document.getElementById("logout-confirm-modal").hidden = true;
}

async function logoutUser() {
  if (!supabaseClient) {
    showLoggedOut();
    switchToLogin();
    return;
  }

  await supabaseClient.auth.signOut();

  closeLogoutConfirm();
  closeAccountDrawer();

  currentUser = null;
  currentProfile = null;

  showLoggedOut();
  switchToLogin();
}

async function changeProfilePicture(file) {
  if (!currentUser || !file) return;

  hideDrawerMessage("avatar-message");

  if (!supabaseClient) {
    showDrawerMessage("avatar-message", "Profile picture upload is unavailable because Supabase did not load.", "error");
    return;
  }

  if (!isLikelyImage(file)) {
    showDrawerMessage("avatar-message", "Please upload an image file.", "error");
    return;
  }

  if (file.size > AVATAR_MAX_FILE_SIZE) {
    showDrawerMessage("avatar-message", "Profile picture is too large. Please choose an image under 5 MB.", "error");
    return;
  }

  const fileExt = getSafeFileExtension(file);
  const fileName = "avatar-" + Date.now() + "." + fileExt;
  const filePath = currentUser.id + "/" + fileName;

  const uploadResult = await supabaseClient.storage
    .from("avatars")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || "image/jpeg"
    });

  if (uploadResult.error) {
    showDrawerMessage("avatar-message", uploadResult.error.message || "Could not upload profile picture.", "error");
    return;
  }

  const publicUrlResult = supabaseClient.storage
    .from("avatars")
    .getPublicUrl(filePath);

  const avatarUrl = publicUrlResult.data.publicUrl;

  const updateResult = await supabaseClient
    .from("profiles")
    .update({
      avatar_url: avatarUrl
    })
    .eq("id", currentUser.id)
    .select("id, email, name, avatar_url")
    .single();

  if (updateResult.error) {
    showDrawerMessage("avatar-message", updateResult.error.message || "Could not save profile picture.", "error");
    return;
  }

  currentProfile = updateResult.data;
  setAvatarImages(avatarUrl);
  showDrawerMessage("avatar-message", "Profile picture updated.", "success");
}

async function checkSession() {
  if (!supabaseClient) {
    showLoggedOut();
    showPageMessage("Authentication is unavailable because Supabase did not load. Check the network connection and Supabase config.", "error");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();

  if (data.session && data.session.user) {
    await showLoggedIn(data.session.user);
  } else {
    showLoggedOut();
  }
}

function openInitialAuthTab() {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");

  if (requestedTab === "register") {
    switchToRegister();
  } else {
    switchToLogin();
  }
}

function setupDialogEscapeKey() {
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;

    const verificationModal = document.getElementById("verification-modal");
    const drawer = document.getElementById("account-drawer");
    const logoutModal = document.getElementById("logout-confirm-modal");

    if (logoutModal && !logoutModal.hidden) {
      closeLogoutConfirm();
      return;
    }

    if (drawer && !drawer.hidden) {
      closeAccountDrawer();
      return;
    }

    if (verificationModal && !verificationModal.hidden) {
      closeVerificationModal();
    }
  });
}

function setupAccountPage() {
  document.getElementById("login-tab").onclick = switchToLogin;
  document.getElementById("register-tab").onclick = switchToRegister;

  document.getElementById("toggle-login-password").onclick = toggleLoginPassword;
  document.getElementById("toggle-register-password").onclick = toggleRegisterPassword;

  document.getElementById("login-form").onsubmit = loginUser;
  document.getElementById("register-form").onsubmit = registerUser;
  document.getElementById("verification-form").onsubmit = confirmAccount;

  document.getElementById("resend-code-button").onclick = resendCode;
  document.getElementById("close-verification-button").onclick = closeVerificationModal;

  document.getElementById("header-account-button").onclick = openAccountDrawer;
  document.getElementById("open-account-drawer-button").onclick = openAccountDrawer;
  document.getElementById("close-account-drawer-button").onclick = closeAccountDrawer;

  document.getElementById("drawer-logout-button").onclick = openLogoutConfirm;
  document.getElementById("confirm-logout-button").onclick = logoutUser;
  document.getElementById("cancel-logout-button").onclick = closeLogoutConfirm;

  document.getElementById("change-avatar-button").onclick = function () {
    document.getElementById("avatar-file-input").click();
  };

  document.getElementById("avatar-file-input").onchange = function (event) {
    const file = event.target.files[0];
    changeProfilePicture(file);
  };

  setupCodeInputs();
  setupDialogEscapeKey();
  openInitialAuthTab();
}

document.addEventListener("DOMContentLoaded", function () {
  setupAccountPage();
  checkSession();

  if (!supabaseClient) return;

  supabaseClient.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_OUT") {
      showLoggedOut();
      switchToLogin();
      return;
    }

    if (session && session.user) {
      showLoggedIn(session.user);
    }
  });
});
