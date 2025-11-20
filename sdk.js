/*! Paywall-Lite SDK v0.2 - MVP Safe Version */
(function () {
  const script = document.currentScript;
  const SITE = script.dataset.site || "default-site";
  const FREE_VIEWS = parseInt(script.dataset.freeViews || "3", 10);
  const SHOW_REGWALL = script.dataset.showRegwall === "true";
  const BOT_TEXT = script.dataset.botText || "This content is protected.";
  const API = script.dataset.api || ""; // fail-open default

  const STORAGE_KEY = `pw_meter_${SITE}`;
  const isBotUA = /bot|crawl|spider|chatgpt|gptbot|perplexity/i.test(
    navigator.userAgent
  );

  // ---------------------------
  // 1. CONTENT TARGET
  // ---------------------------
  function findContent() {
    return (
      document.querySelector("[data-paywall]") ||
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.body
    );
  }

  // ---------------------------
  // 2. SERVER METER (NO-OP FOR MVP)
  // ---------------------------
  async function serverCheck() {
    // MVP: Always allow, no backend needed
    return { allowed: true };
  }

  async function serverHit() {
    // MVP: No-op
  }

  // ---------------------------
  // 3. LOCAL METER
  // ---------------------------
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

  // ---------------------------
  // 4. BOT VERSION
  // ---------------------------
  function showBotVersion(target) {
    target.innerHTML = `<div style="padding:2rem;font-size:1.2rem;line-height:1.5;">
      ${BOT_TEXT}
    </div>`;
    target.style.filter = "none";
  }

  // ---------------------------
  // 5. REGWALL (FIXED)
  // ---------------------------
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

    // ---- SUBMIT HANDLER (NOW FAIL-OPEN) ----
    overlay.querySelector("#pw_submit").onclick = async () => {
      const email = overlay.querySelector("#pw_email").value;
      if (!email) return alert("Email required");

      // Attempt to call backend, but ALWAYS continue
      try {
        if (API) {
          await fetch(`${API}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              site: SITE,
              email,
              path: location.pathname,
            }),
          });
        }
      } catch (e) {
        console.warn("Backend not reachable — continuing anyway.");
      }

      // Unlock content
      saveMeter(0);
      overlay.remove();
      target.style.filter = "none";
    };

    // ---- CLOSE ----
    overlay.querySelector("#pw_close").onclick = (e) => {
      e.preventDefault();
      overlay.remove();
      target.style.filter = "none"; // fail-open
    };
  }

  // ---------------------------
  // 6. PAYWALL OVERLAY
  // ---------------------------
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

  // ---------------------------
  // 7. CORE LOGIC
  // ---------------------------
  async function initPaywall() {
    const target = findContent();
    if (!target) return;

    // Blur immediately
    target.style.filter = "blur(3px)";

    // ---- Bot mode ----
    if (isBotUA) {
      showBotVersion(target);
      return;
    }

    const path = location.pathname;
    let count = loadMeter();

    // Allow content if meter not exceeded
    if (count < FREE_VIEWS) {
      const server = await serverCheck(path);

      if (server.allowed) {
        count++;
        saveMeter(count);
        serverHit(path);
        target.style.filter = "none";
        return;
      }
    }

    // Limit exceeded
    showPaywall(target);
  }

  // ---------------------------
  // 8. START
  // ---------------------------
  document.addEventListener("DOMContentLoaded", initPaywall);
})();
