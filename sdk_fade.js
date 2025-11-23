/*! Paywall-Lite SDK v0.3 – Bottom Half Fade Edition */
(function () {
  const script = document.currentScript;
  const SITE = script.dataset.site || "default-site";
  const FREE_VIEWS = parseInt(script.dataset.freeViews || "3", 10);
  const SHOW_REGWALL = script.dataset.showRegwall === "true";
  const BOT_TEXT = script.dataset.botText || "This content is protected.";
  const API = script.dataset.api || "";

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
  // 2. SERVER METER (MVP: always allow)
  // ---------------------------
  async function serverCheck() {
    return { allowed: true };
  }

  async function serverHit() {}

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
  // 4. BOT MODE
  // ---------------------------
  function showBotVersion(target) {
    target.innerHTML = `<div style="padding:2rem;font-size:1.2rem;line-height:1.5;">
      ${BOT_TEXT}
    </div>`;
    removeFadeOverlay();
  }

  // ---------------------------
  // 5. REGWALL
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

    overlay.querySelector("#pw_submit").onclick = async () => {
      const email = overlay.querySelector("#pw_email").value;
      if (!email) return alert("Email required");

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
        console.warn("Backend unreachable — continuing fail-open.");
      }

      saveMeter(0);
      overlay.remove();
      removeFadeOverlay();
    };

    overlay.querySelector("#pw_close").onclick = (e) => {
      e.preventDefault();
      overlay.remove();
      removeFadeOverlay();
    };
  }

  // ---------------------------
  // 6. PAYWALL
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
                  max-width:360px;width:90%;font-family:sans-serif;text-align:center;">
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
  // 7. FADE-OUT OVERLAY (BOTTOM HALF) – Adweek Style
  // ---------------------------
  function createFadeOverlay(target) {
    removeFadeOverlay(); // safety

    const fadeDiv = document.createElement("div");
    fadeDiv.id = "pw_fade_overlay";

    fadeDiv.style = `
      position:absolute;
      left:0;
      bottom:0;
      width:100%;
      height:50%;
      pointer-events:none;
      z-index:9999;

      /* Adweek-style: transparent → white fade */
      background: linear-gradient(
        to bottom,
        rgba(255,255,255,0) 0%,
        rgba(255,255,255,0.85) 40%,
        rgba(255,255,255,1) 100%
      );

      transition: opacity 0.6s ease-in-out;
      opacity: 1;
    `;

    if (window.getComputedStyle(target).position === "static") {
      target.style.position = "relative";
    }

    target.appendChild(fadeDiv);
  }

  function removeFadeOverlay() {
    const fade = document.getElementById("pw_fade_overlay");
    if (fade) {
      fade.style.opacity = "0"; // smooth dissolve out
      setTimeout(() => fade.remove(), 600);
    }
  }

  // ---------------------------
  // 8. CORE LOGIC
  // ---------------------------
  async function initPaywall() {
    const target = findContent();
    if (!target) return;

    // Bot mode: show stripped text, no fade
    if (isBotUA) {
      showBotVersion(target);
      return;
    }

    let count = loadMeter();

    // Free views remaining: allow reading
    if (count < FREE_VIEWS) {
      const server = await serverCheck();
      if (server.allowed) {
        count++;
        saveMeter(count);
        removeFadeOverlay();
        return;
      }
    }

    // Free limit exceeded → show fade + paywall
    createFadeOverlay(target);
    showPaywall(target);
  }

  document.addEventListener("DOMContentLoaded", initPaywall);
})();
