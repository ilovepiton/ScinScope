const globalSupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const { data, error } = await globalSupabaseClient
    .from("profiles")
    .select("id, email, name, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split("@")[0],
      avatar_url: ""
    };
  }

  return data;
}

function showGlobalLoggedOutHeader() {
  const accountLink = document.getElementById("account-nav-link");
  const accountMenu = document.getElementById("header-account-menu");

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
  const { data } = await globalSupabaseClient.auth.getSession();

  if (data.session && data.session.user) {
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
