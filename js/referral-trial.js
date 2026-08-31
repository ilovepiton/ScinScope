(function () {
  const TRIAL_DAYS = 7;
  const PLAN_STORAGE_KEY = "skinscopeSelectedPlan";
  const REFERRAL_STORAGE_KEY = "skinscopeReferralTrial";
  const PENDING_REFERRAL_KEY = "skinscopePendingReferralCode";
  const POST_LOGIN_ACTION_KEY = "skinscopePostLoginAction";
  const PAID_PLANS = ["monthly", "lifetime"];

  let sessionUser = null;
  let cachedClient = null;

  function getSupabaseClient() {
    if (cachedClient) return cachedClient;
    if (window.globalSupabaseClient) {
      cachedClient = window.globalSupabaseClient;
      return cachedClient;
    }

    if (window.supabase && typeof SUPABASE_URL !== "undefined" && typeof SUPABASE_ANON_KEY !== "undefined") {
      cachedClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return cachedClient;
    }

    return null;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function makeStorageKey(user) {
    const identity = user && (user.id || normalizeEmail(user.email));
    return identity ? REFERRAL_STORAGE_KEY + ":" + identity : REFERRAL_STORAGE_KEY + ":guest";
  }

  function readState(user) {
    try {
      const state = JSON.parse(localStorage.getItem(makeStorageKey(user))) || {};
      return state && typeof state === "object" ? state : {};
    } catch (error) {
      return {};
    }
  }

  function writeState(user, state) {
    localStorage.setItem(makeStorageKey(user), JSON.stringify(state));
  }

  function makeCode(user) {
    const seed = user && user.id ? user.id.slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return "skin-" + seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  }

  function getBasePrefix() {
    return window.location.pathname.includes("/pages/") ? "../" : "";
  }

  function getAbsolutePage(path) {
    return window.location.origin + "/ScinScope/" + path;
  }

  function getAccountUrl(tab) {
    const target = getAbsolutePage("pages/account.html");
    return tab ? target + "?tab=" + encodeURIComponent(tab) : target;
  }

  function getInviteUrl(user) {
    const state = readState(user);
    const code = state.ownCode || makeCode(user);
    return getAbsolutePage("index.html") + "?ref=" + encodeURIComponent(code);
  }

  function getTrialEndsLabel(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "7 days";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function isPaidPlan() {
    return PAID_PLANS.includes(localStorage.getItem(PLAN_STORAGE_KEY));
  }

  function getTrialState(user) {
    const state = readState(user || sessionUser);
    const trialEndsAt = state.trialEndsAt || "";
    const active = Boolean(trialEndsAt && new Date(trialEndsAt).getTime() > Date.now());

    return {
      active,
      trialEndsAt,
      inviteUsed: state.inviteUsed === true,
      inviteLocked: state.inviteLocked === true,
      invitedBy: state.invitedBy || "",
      ownCode: state.ownCode || "",
      paid: isPaidPlan()
    };
  }

  function hasAccess(user) {
    const trial = getTrialState(user);
    return trial.paid || trial.active;
  }

  function grantSevenDayTrial(user, source, extra) {
    const state = readState(user);
    const now = Date.now();
    const currentEndsAt = state.trialEndsAt ? new Date(state.trialEndsAt).getTime() : 0;
    const nextEndsAt = new Date(Math.max(currentEndsAt, now + TRIAL_DAYS * 24 * 60 * 60 * 1000)).toISOString();

    state.trialStartedAt = state.trialStartedAt || new Date(now).toISOString();
    state.trialEndsAt = nextEndsAt;
    state.trialSource = source;

    if (extra && extra.invitedBy) {
      state.invitedBy = extra.invitedBy;
      state.inviteLocked = true;
    }

    writeState(user, state);
    saveTrialBestEffort(user, state, source);
    return state;
  }

  async function saveTrialBestEffort(user, state, source) {
    const client = getSupabaseClient();
    if (!client || !user) return;

    try {
      await client.from("subscriptions").upsert(
        {
          user_id: user.id,
          plan: "trial",
          status: "trialing",
          trial_ends_at: state.trialEndsAt
        },
        { onConflict: "user_id" }
      );
    } catch (error) {}

    try {
      await client.from("referrals").insert({
        user_id: user.id,
        email: user.email,
        referrer_code: state.invitedBy || state.ownCode || "",
        status: source,
        trial_ends_at: state.trialEndsAt
      });
    } catch (error) {}
  }

  function rememberReferralFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref");

    if (referralCode) {
      localStorage.setItem(PENDING_REFERRAL_KEY, referralCode.trim().slice(0, 80));
    }
  }

  async function getCurrentUser() {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const result = await client.auth.getSession();
      sessionUser = result.data && result.data.session ? result.data.session.user : null;
      return sessionUser;
    } catch (error) {
      return null;
    }
  }

  async function applyPendingReferral(user) {
    const pendingCode = localStorage.getItem(PENDING_REFERRAL_KEY);
    if (!user || !pendingCode || isPaidPlan()) return;

    const state = readState(user);
    if (!state.trialEndsAt) {
      grantSevenDayTrial(user, "friend_referral", { invitedBy: pendingCode });
    }

    localStorage.removeItem(PENDING_REFERRAL_KEY);
  }

  function createInviteCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
  }

  function renderHomeInvite() {
    const hero = document.querySelector(".home-glass-card");
    if (!hero || hero.querySelector(".referral-hero-card")) return;

    const card = document.createElement("div");
    card.className = "referral-hero-card";
    card.innerHTML = [
      '<span class="referral-kicker">7-day trial</span>',
      '<h2>Invite one friend. Both unlock SkinScope for 7 days.</h2>',
      '<p>Use Face Scan, Product Scan, and your Skin Score trial after signing in. Each account gets one invite only.</p>',
      '<button type="button" class="primary-button button-reset referral-start-button">Start with an invite</button>'
    ].join("");

    const authBox = hero.querySelector(".auth-box");
    if (authBox) {
      authBox.insertAdjacentElement("afterend", card);
    } else {
      hero.appendChild(card);
    }
  }

  function getGateTitle() {
    return document.body.classList.contains("product-scan-page")
      ? "Product Scan is ready for your trial"
      : "Face Scan is ready for your trial";
  }

  function renderGate(user) {
    const isProtectedPage =
      document.body.classList.contains("scan-page") ||
      document.body.classList.contains("product-scan-page");

    if (!isProtectedPage) return;

    let gate = document.getElementById("trial-gate");

    if (isPaidPlan() || hasAccess(user)) {
      if (gate) gate.hidden = true;
      return;
    }

    if (!gate) {
      gate = document.createElement("section");
      gate.id = "trial-gate";
      gate.className = "trial-gate";
      gate.setAttribute("aria-label", "SkinScope trial required");
      gate.innerHTML = [
        '<div class="trial-gate-panel">',
        '  <button type="button" class="trial-gate-close" aria-label="Close">x</button>',
        '  <span class="referral-kicker">Premium trial</span>',
        '  <h2></h2>',
        '  <p></p>',
        '  <button type="button" class="primary-button button-reset referral-start-button"></button>',
        '  <a class="secondary-button trial-upgrade-link" href="' + getAbsolutePage("pages/plan.html") + '">See plans</a>',
        '</div>'
      ].join("");
      document.body.appendChild(gate);
    }

    gate.hidden = false;
    gate.querySelector(".referral-kicker").textContent = user ? "Seven Days Trial" : "Premium trial";
    gate.querySelector("h2").textContent = user ? "Seven Days Trial" : getGateTitle();
    gate.querySelector("p").textContent = user
      ? "Invite one friend to unlock a 7-day SkinScope trial. After one invite, this offer is locked for the account."
      : "Log in or create an account first, then invite a friend to unlock your 7-day SkinScope trial.";
    gate.querySelector(".referral-start-button").textContent = user
      ? "Invite a friend for 7-day trial"
      : "Log in to unlock trial";

    const close = gate.querySelector(".trial-gate-close");
    if (close) {
      close.onclick = function () {
        gate.hidden = true;
      };
    }
  }

  function renderAccountInvite(user) {
    const loggedPanel = document.getElementById("logged-panel");
    if (!loggedPanel) return;

    let panel = document.getElementById("account-referral-panel");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "account-referral-panel";
      panel.className = "account-referral-panel";
      panel.innerHTML = [
        '<div>',
        '  <span class="referral-kicker">Invite trial</span>',
        '  <h2>Give a friend 7 days of SkinScope</h2>',
        '  <p id="account-referral-text"></p>',
        '</div>',
        '<div class="referral-link-row" hidden>',
        '  <input id="account-referral-link" type="text" readonly aria-label="Your invite link" />',
        '  <button type="button" id="copy-referral-link-button" class="secondary-button button-reset">Copy</button>',
        '</div>',
        '<button type="button" class="primary-button button-reset referral-start-button">Create invite</button>'
      ].join("");

      const buttons = loggedPanel.querySelector(".hero-buttons");
      if (buttons) {
        buttons.insertAdjacentElement("beforebegin", panel);
      } else {
        loggedPanel.appendChild(panel);
      }
    }

    const trial = getTrialState(user);
    const text = panel.querySelector("#account-referral-text");
    const row = panel.querySelector(".referral-link-row");
    const input = panel.querySelector("#account-referral-link");
    const button = panel.querySelector(".referral-start-button");

    if (!user) {
      text.textContent = "Sign in first, then you can create one invite link.";
      row.hidden = true;
      button.textContent = "Log in first";
      return;
    }

    if (trial.paid) {
      text.textContent = "Premium is active, so trial gates stay hidden.";
      row.hidden = true;
      button.textContent = "Premium active";
      button.disabled = true;
      button.classList.add("disabled-button");
      return;
    }

    if (trial.inviteUsed || trial.inviteLocked) {
      text.textContent = trial.active
        ? "Your 7-day trial is active until " + getTrialEndsLabel(trial.trialEndsAt) + ". This invite was already used."
        : "This one-time invite was already used on this account.";
      row.hidden = !trial.ownCode;
      input.value = trial.ownCode ? getInviteUrl(user) : "";
      button.textContent = "Invite used";
      button.disabled = true;
      button.classList.add("disabled-button");
      return;
    }

    text.textContent = "Create one invite link. When your friend signs in from it, they also unlock a 7-day trial.";
    row.hidden = true;
    button.textContent = "Invite a friend for 7-day trial";
    button.disabled = false;
    button.classList.remove("disabled-button");
  }

  function showInviteModal(user) {
    let modal = document.getElementById("referral-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "referral-modal";
      modal.className = "referral-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = [
        '<div class="referral-modal-panel">',
        '  <button type="button" class="referral-modal-close" aria-label="Close">x</button>',
        '  <span class="referral-kicker">7-day trial</span>',
        '  <h2></h2>',
        '  <p></p>',
        '  <div class="referral-link-row" hidden>',
        '    <input id="referral-modal-link" type="text" readonly aria-label="Invite link" />',
        '    <button type="button" id="referral-modal-copy" class="secondary-button button-reset">Copy</button>',
        '  </div>',
        '  <div class="referral-modal-actions">',
        '    <button type="button" class="primary-button button-reset" id="referral-modal-primary"></button>',
        '    <a class="secondary-button" href="' + getAbsolutePage("pages/plan.html") + '">See plans</a>',
        '  </div>',
        '</div>'
      ].join("");
      document.body.appendChild(modal);
    }

    const title = modal.querySelector("h2");
    const text = modal.querySelector("p");
    const primary = modal.querySelector("#referral-modal-primary");
    const row = modal.querySelector(".referral-link-row");
    const input = modal.querySelector("#referral-modal-link");
    const close = modal.querySelector(".referral-modal-close");
    const copy = modal.querySelector("#referral-modal-copy");

    modal.hidden = false;

    if (!user) {
      title.textContent = "Sign in to start your invite trial";
      text.textContent = "SkinScope keeps this offer one time per account, so log in or register first.";
      row.hidden = true;
      primary.textContent = "Log in or register";
      primary.disabled = false;
      primary.classList.remove("disabled-button");
      primary.onclick = function () {
        localStorage.setItem(POST_LOGIN_ACTION_KEY, "invite_trial");
        window.location.href = getAccountUrl("login");
      };
    } else {
      const state = readState(user);
      const trial = getTrialState(user);

      if (trial.inviteUsed || trial.inviteLocked) {
        title.textContent = "Your one-time invite is already used";
        text.textContent = trial.active
          ? "Your SkinScope trial is active until " + getTrialEndsLabel(trial.trialEndsAt) + "."
          : "This account cannot create another trial invite.";
        row.hidden = !trial.ownCode;
        input.value = trial.ownCode ? getInviteUrl(user) : "";
        primary.textContent = "Done";
        primary.onclick = function () {
          modal.hidden = true;
        };
      } else {
        state.ownCode = state.ownCode || makeCode(user);
        state.inviteUsed = true;
        state.inviteLocked = true;
        writeState(user, state);
        const nextState = grantSevenDayTrial(user, "inviter_trial");
        const link = getInviteUrl(user);

        title.textContent = "Your invite trial is active";
        text.textContent = "Copy this link for one friend. Your trial runs until " + getTrialEndsLabel(nextState.trialEndsAt) + ".";
        row.hidden = false;
        input.value = link;
        createInviteCopy(link);
        primary.textContent = "Copy invite link";
        primary.onclick = function () {
          createInviteCopy(link);
          primary.textContent = "Copied";
        };
      }
    }

    if (close) {
      close.onclick = function () {
        modal.hidden = true;
      };
    }

    if (copy) {
      copy.onclick = function () {
        createInviteCopy(input.value);
        copy.textContent = "Copied";
      };
    }
  }

  function bindReferralButtons() {
    document.addEventListener("click", async function (event) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest(".referral-start-button");
      if (!button) return;

      event.preventDefault();
      const user = sessionUser || await getCurrentUser();
      showInviteModal(user);
      renderGate(user);
      renderAccountInvite(user);
      updateAccountTrialText(user);
    });
  }

  function updateAccountTrialText(user) {
    const trial = getTrialState(user);
    const statusEl = document.getElementById("account-status");
    const planEl = document.getElementById("account-plan");
    const trialEl = document.getElementById("account-trial");
    const drawerPlan = document.getElementById("drawer-plan");
    const drawerStatus = document.getElementById("drawer-status");
    const drawerTrial = document.getElementById("drawer-trial");

    if (!trial.active || trial.paid) return;

    if (statusEl) statusEl.textContent = "trialing";
    if (planEl) planEl.textContent = "7-day referral trial";
    if (trialEl) trialEl.textContent = getTrialEndsLabel(trial.trialEndsAt);
    if (drawerPlan) drawerPlan.textContent = "7-day referral trial";
    if (drawerStatus) drawerStatus.textContent = "trialing";
    if (drawerTrial) drawerTrial.textContent = getTrialEndsLabel(trial.trialEndsAt);
  }

  async function bootReferralTrial() {
    rememberReferralFromUrl();
    renderHomeInvite();
    bindReferralButtons();

    const user = await getCurrentUser();
    await applyPendingReferral(user);
    renderGate(user);
    renderAccountInvite(user);
    updateAccountTrialText(user);

    if (user && localStorage.getItem(POST_LOGIN_ACTION_KEY) === "invite_trial" && !hasAccess(user)) {
      localStorage.removeItem(POST_LOGIN_ACTION_KEY);
      window.setTimeout(function () {
        showInviteModal(user);
      }, 350);
    }

    const client = getSupabaseClient();
    if (client) {
      client.auth.onAuthStateChange(function (_event, session) {
        sessionUser = session && session.user ? session.user : null;
        applyPendingReferral(sessionUser).then(function () {
          renderGate(sessionUser);
          renderAccountInvite(sessionUser);
          updateAccountTrialText(sessionUser);

          if (sessionUser && localStorage.getItem(POST_LOGIN_ACTION_KEY) === "invite_trial" && !hasAccess(sessionUser)) {
            localStorage.removeItem(POST_LOGIN_ACTION_KEY);
            showInviteModal(sessionUser);
          }
        });
      });
    }
  }

  window.SkinScopeTrial = {
    getTrialState,
    hasAccess,
    showInviteModal,
    updateAccountTrialText
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootReferralTrial);
  } else {
    bootReferralTrial();
  }
})();
