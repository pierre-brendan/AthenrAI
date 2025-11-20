/*! Paywall-Lite SDK v0.1 */
(function () {
  const script = document.currentScript;
  const SITE = script.dataset.site || "default-site";
  const FREE_VIEWS = parseInt(script.dataset.freeViews || "3", 10);
  const SHOW_REGWALL = script.dataset.showRegwall === "true";
  const BOT_TEXT = script.dataset.botText || "This content is protected.";
  const API = script.dataset.api || "https://api.paywall-lite.com";

  const STORAGE_KEY = `pw_meter_${SITE}`;
  const isBotUA = /bot|crawl|spider|chatgpt|gptbot|perplexity/i.test(navigator.userAgent);

  // ---- 1. Determine Content Target ----
  function findContent() {
    return (
      document.querySelector("[data-paywall]") ||
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.body
    );
  }

  // ---- 2. Server meter check (optional for MVP) ----
  async function serverCheck(path) {
    try {
      const r = await fetch(`${API}/meter/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: SITE, path }),
      });
      return r.ok ? r.json() : { allowed: true };
    } catch {
      return { allowed: true }; // fail-open
    }
  }

  async function serverHit(path) {
    fetch(`${API}/meter/hit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: SITE, path }),
    });
  }

  // ---- 3. Local meter logic ----
  function loadMeter() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "0");
    } catch {
      return 0;
    }
  }
  function saveMeter(v) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  }

  // ---- 4. Bot Mode ----
  function showBotVersion(target) {
    target.innerHTML = `<div style="padding:2rem;font-size:1.2rem;line-height:1.5;">
      ${BOT_TEXT}
    </div>`;
    target.style.filter = "none";
  }

  // ---- 5. Regwall ----
  function showRegwall(target) {
    const overlay = document.createElement("div");
    overlay.style = `
      position:fixed;inset:0;background:rgba(0,0,0,0.6);
      display:flex;align-items:center;justify-content:center;
      z-index:999999;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:8px;
                  max-width:360px;width:90%;font-family:sans-serif">
        <h3>Continue with Email</h3>
        <p>Get 1 free article after confirming.</p>
        <input id="pw_email" type="email" placeholder="Email" 
               style="width:100%;padding:8px;margin:12px 0;">
        <button id="pw_submit" 
                style="width:100%;padding:10px;background:#222;color:#fff;border:none;border-radius:4px;cursor:pointer;">
          Continue
        </button>
        <div style="text-align:center;margin-top:8px;">
          <a id="pw_close" href="#" style="color:#666;font-size:14px;">Cancel</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#pw_submit").onclick = async () => {
      const email = overlay.querySelector("#pw_email").value;
      if (!email) return alert("Email required");

      await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: SITE, email, path: location.pathname }),
      });

      saveMeter(0); // reset
      overlay.remove();
      target.style.filter = "none";
    };

    overlay.querySelector("#pw_close").onclick = (e) => {
      e.preventDefault();
      overlay.remove();
    };
  }

  // ---- 6. Paywall Overlay ----
  function showPaywall(target) {
    const overlay = document.createElement("div");
    overlay.style = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);
      display:flex;align-items:center;justify-content:center;
      z-index:9999999;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;padding:24px;border-radius:8px;
                  max-width:360px;width:90%;font-family:sans-serif;
                  text-align:center;">
        <h3>You've hit your free limit</h3>
        ${
          SHOW_REGWALL
            ? `<button id="pw_reg_btn" style="padding:10px 20px;background:#000;color:#fff;border-radius:4px;cursor:pointer;">
                 Continue with Email
               </button>`
            : `<p>Please subscribe to continue.</p>`
        }
      </div>
    `;
    document.body.appendChild(overlay);

    if (SHOW_REGWALL) {
      overlay.querySelector("#pw_reg_btn").onclick = () => {
        overlay.remove();
        showRegwall(target);
      };
    }
  }

  // ---- 7. Core Logic ----
  async function initPaywall() {
    const target = findContent();
    if (!target) return;

    // Blur immediately to prevent content flash
    target.style.filter = "blur(3px)";

    // --- Bot Mode (UA or No-JS fallback)
    if (isBotUA) {
      showBotVersion(target);
      return;
    }

    const path = location.pathname;

    // Local meter first
    let count = loadMeter();
    if (count < FREE_VIEWS) {
      // Let user read, still blur until server check completes
      const server = await serverCheck(path);

      if (server.allowed) {
        count++;
        saveMeter(count);
        serverHit(path);
        target.style.filter = "none";
        return;
      }
    }

    // User exceeded meter → show paywall
    showPaywall(target);
  }

  // ---- 8. Init on DOM ready ----
  document.addEventListener("DOMContentLoaded", initPaywall);
})();
