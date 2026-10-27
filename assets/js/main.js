// Progressive enhancement only: the page is fully readable with JS disabled.
(function () {
  "use strict";

  // ---- Footer year -------------------------------------------------------
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // ---- Copy email --------------------------------------------------------
  const btn = document.getElementById("copy-email");
  const status = document.getElementById("copy-status");

  function setStatus(message, isError) {
    if (!status) return;
    status.textContent = message; // textContent, never innerHTML
    status.classList.toggle("is-error", Boolean(isError));
  }

  // Fallback for browsers without the async Clipboard API (or non-secure contexts).
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "visually-offscreen";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  if (btn) {
    const label = btn.querySelector(".btn-label");
    let resetTimer;

    btn.addEventListener("click", async function () {
      const email = btn.dataset.user + "@" + btn.dataset.domain;
      let copied = false;

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(email);
          copied = true;
        } catch (_) {
          copied = legacyCopy(email);
        }
      } else {
        copied = legacyCopy(email);
      }

      if (copied) {
        setStatus("Copied " + email + " to clipboard.", false);
        if (label) label.textContent = "Copied!";
      } else {
        // Last resort: show the address so the visitor can copy it by hand.
        setStatus("Couldn't access the clipboard. Email: " + email, true);
      }

      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        if (label) label.textContent = "Copy email";
      }, 2000);
    });
  }

  // ---- Highlight current section in nav ---------------------------------
  const links = Array.from(document.querySelectorAll(".nav-links a"));
  const sections = links
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            if (a.getAttribute("href") === "#" + entry.target.id) {
              a.setAttribute("aria-current", "true");
            } else {
              a.removeAttribute("aria-current");
            }
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach(function (s) { observer.observe(s); });
  }
})();
