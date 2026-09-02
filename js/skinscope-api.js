(function () {
  const TOKEN_KEY = "skinscopeSessionToken";
  const API_URL = String(window.SKINSCOPE_API_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }

    window.dispatchEvent(new CustomEvent("skinscope-auth-changed"));
  }

  async function request(path, options = {}) {
    if (window.SKINSCOPE_API_NEEDS_PUBLIC_URL) {
      const error = new Error("SkinScope live site needs a public HTTPS API. Open the local SkinScope site on this Mac, or set skinscopeApiUrl to your deployed server URL.");
      error.code = "api_needs_public_https";
      throw error;
    }

    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    const token = getToken();

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    let response;

    try {
      response = await fetch(API_URL + path, {
        method: options.method || "GET",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (fetchError) {
      const error = new Error("SkinScope server could not be reached. Make sure the SkinScope server is running, then use the local site link.");
      error.code = "api_connection_failed";
      error.cause = fetchError;
      throw error;
    }

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || "SkinScope server request failed.");
      error.code = data.code || "";
      error.status = response.status;
      throw error;
    }

    if (data.token) {
      setToken(data.token);
    }

    return data;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Could not read this image."));
      };
      reader.readAsDataURL(file);
    });
  }

  window.SkinScopeApi = {
    apiUrl: API_URL,
    getToken,
    setToken,

    async register(name, email, password) {
      return request("/api/register", {
        method: "POST",
        body: { name, email, password }
      });
    },

    async verify(email, code) {
      return request("/api/verify", {
        method: "POST",
        body: { email, code }
      });
    },

    async resendVerification(email) {
      return request("/api/resend-code", {
        method: "POST",
        body: { email }
      });
    },

    async login(email, password) {
      return request("/api/login", {
        method: "POST",
        body: { email, password }
      });
    },

    async logout() {
      try {
        await request("/api/logout", { method: "POST" });
      } finally {
        setToken("");
      }
    },

    async getSession() {
      if (!getToken()) return { session: null };

      try {
        const data = await request("/api/me");
        return {
          session: {
            user: data.user,
            profile: data.profile
          }
        };
      } catch (error) {
        setToken("");
        return { session: null };
      }
    },

    async getProfile() {
      const data = await request("/api/me");
      return data.profile;
    },

    async getSubscription() {
      const data = await request("/api/subscription");
      return data.subscription;
    },

    async updateAvatar(file) {
      const avatar = await fileToDataUrl(file);
      const data = await request("/api/profile/avatar", {
        method: "POST",
        body: { avatar }
      });
      return data.profile;
    },

    async saveTrial(state, source) {
      return request("/api/trial", {
        method: "POST",
        body: {
          status: source || state.trialSource || "trialing",
          trial_ends_at: state.trialEndsAt,
          referrer_code: state.invitedBy || state.ownCode || ""
        }
      });
    }
  };
})();
