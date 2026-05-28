const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let pendingEmail = "";
let pendingPassword = "";
let resendTimer = null;
let resendSeconds = 0;
let currentUser = null;
let currentProfile = null;

function showVerificationMessage(text, type = "error") {
  const message = document.getElementById("verification-message");
  if (!message) return;

  message.hidden = false;
  message.textContent = text;
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

function showPageMessage(text) {
  alert(text);
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

  const accountNavLink = document.getElementById("account-nav-link");
  if (accountNavLink) accountNavLink.hidden = false;
}

async function showLoggedIn(user) {
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
    statusEl.textContent = "active";
    planEl.textContent = "trial";
    trialEl.textContent = "7 days after registration";

    drawerPlan.textContent = "trial";
    drawerStatus.textContent = "active";
    drawerTrial.textContent = "7 days after registration";
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

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const repeatPassword = document.getElementById("register-repeat-password").value.trim();

  if (!name || !email || !password || !repeatPassword) {
    showPageMessage("Please fill in all fields.");
    return;
  }

  if (!validateName(name)) return;
  if (!validatePassword(password)) return;

  if (password !== repeatPassword) {
    showPageMessage("Passwords do not match.");
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
    showPageMessage(getFriendlyAuthError(error.message));
    return;
  }

  openVerificationModal(email);
}

async function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!email || !password) {
    showPageMessage("Please fill in all fields.");
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
      showVerificationMessage("Please enter the code from your email to confirm your account.", "error");
      return;
    }

    showPageMessage(getFriendlyAuthError(error.message));
    return;
  }

  if (data.user) {
    await showLoggedIn(data.user);
  }
}

async function confirmAccount(event) {
  event.preventDefault();

  hideVerificationMessage();

  const code = getCodeValue();

  if (!pendingEmail) {
    showVerificationMessage("Email is missing. Please register or login again.", "error");
    return;
  }

  if (code.length !== 8) {
    showVerificationMessage("Please enter the full verification code from your email.", "error");
    return;
  }

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: pendingEmail,
    token: code,
    type: "email"
  });

  if (error) {
    showVerificationMessage(getFriendlyAuthError(error.message), "error");
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

  showPageMessage("Account confirmed. Please login.");
  switchToLogin();
}

async function resendCode() {
  hideVerificationMessage();

  if (!pendingEmail) {
    showVerificationMessage("Email is missing. Please register or login again.", "error");
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
    showVerificationMessage(getFriendlyAuthError(error.message), "error");

    if (
      error.message.toLowerCase().includes("rate limit") ||
      error.message.toLowerCase().includes("security") ||
      error.message.toLowerCase().includes("seconds")
    ) {
      startResendCooldown(60);
    }

    return;
  }

  showVerificationMessage("A new verification code has been sent.", "success");
  startResendCooldown(60);
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

  if (!isLikelyImage(file)) {
    showDrawerMessage("avatar-message", "Please upload an image file.", "error");
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
  document.getElementById("toggle-code-button").onclick = toggleCodeVisibility;

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
}

document.addEventListener("DOMContentLoaded", function () {
  setupAccountPage();
  checkSession();
});
