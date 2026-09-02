const globalSkinScopeApi = window.SkinScopeApi || null;

window.SkinScopeAuthReady = true;

function normalizeGlobalEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isGlobalUserVerifiedBySkinScope(user) {
  return Boolean(
    user &&
    (
      Boolean(user.email_confirmed_at) ||
      Boolean(user.confirmed_at) ||
      user.user_metadata?.skinscope_verified === true ||
      user.user_metadata?.skinscope_verified === "true"
    )
  );
}

function getBasePath() {
  const path = window.location.pathname;

  if (path.includes("/pages/")) {
    return "";
  }

  return "pages/";
}

function getAccountUrl() {
  return getBasePath() + "account.html";
}

function setProtectedNavigationVisibility(isLoggedIn) {
  document.body.classList.toggle("is-logged-in", Boolean(isLoggedIn));

  document.querySelectorAll("a").forEach(function (link) {
    const href = link.getAttribute("href") || "";
    const isProtectedLink =
      href.includes("scan.html") ||
      href.includes("product-scan.html");

    if (isProtectedLink) {
      link.hidden = !isLoggedIn;
    }
  });

  document.querySelectorAll(".nav-skin-score-button, .skin-score-panel").forEach(function (element) {
    element.hidden = !isLoggedIn;
  });
}

window.setSkinScopeProtectedNavigation = setProtectedNavigationVisibility;

function setGlobalHeaderAvatar(url) {
  const img = document.getElementById("header-account-avatar");
  const fallback = document.getElementById("header-avatar-fallback");

  if (!img || !fallback) return;

  if (url) {
    img.src = url;
    img.hidden = false;
    fallback.hidden = true;
  } else {
    img.src = "";
    img.hidden = true;
    fallback.hidden = false;
  }
}

async function loadGlobalProfile(user) {
  if (!globalSkinScopeApi) {
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split("@")[0],
      avatar_url: ""
    };
  }

  try {
    return await globalSkinScopeApi.getProfile();
  } catch (error) {
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split("@")[0],
      avatar_url: ""
    };
  }
}

function showGlobalLoggedOutHeader() {
  const accountLink = document.getElementById("account-nav-link");
  const accountMenu = document.getElementById("header-account-menu");

  setProtectedNavigationVisibility(false);

  if (accountLink) {
    accountLink.hidden = false;
    accountLink.href = getAccountUrl();
  }

  if (accountMenu) {
    accountMenu.hidden = true;
  }
}

async function showGlobalLoggedInHeader(user) {
  const accountLink = document.getElementById("account-nav-link");
  const accountMenu = document.getElementById("header-account-menu");
  const accountName = document.getElementById("header-account-name");

  setProtectedNavigationVisibility(true);

  if (!accountMenu || !accountName) return;

  const profile = await loadGlobalProfile(user);
  const name = profile.name || user.user_metadata?.name || user.email.split("@")[0];

  if (accountLink) {
    accountLink.hidden = true;
  }

  accountMenu.hidden = false;
  accountName.textContent = name;

  setGlobalHeaderAvatar(profile.avatar_url || "");
}

async function checkGlobalAuthHeader() {
  if (!globalSkinScopeApi) {
    showGlobalLoggedOutHeader();
    return;
  }

  const data = await globalSkinScopeApi.getSession();

  if (data.session && data.session.user) {
    if (!isGlobalUserVerifiedBySkinScope(data.session.user)) {
      await globalSkinScopeApi.logout();
      showGlobalLoggedOutHeader();
      return;
    }

    await showGlobalLoggedInHeader(data.session.user);
  } else {
    showGlobalLoggedOutHeader();
  }
}

function setupGlobalAccountButton() {
  const button = document.getElementById("header-account-button");

  if (!button) return;

  button.addEventListener("click", function () {
    window.location.href = getAccountUrl();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  setupGlobalAccountButton();
  checkGlobalAuthHeader();
});
