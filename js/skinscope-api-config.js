(function () {
  const savedApiUrl = localStorage.getItem("skinscopeApiUrl") || "";
  const defaultLocalApiUrl = "http://127.0.0.1:8787";

  window.SKINSCOPE_API_URL =
    window.SKINSCOPE_API_URL ||
    savedApiUrl ||
    defaultLocalApiUrl;

  window.SKINSCOPE_API_NEEDS_PUBLIC_URL =
    window.location.protocol === "https:" &&
    /^http:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(window.SKINSCOPE_API_URL);
})();
