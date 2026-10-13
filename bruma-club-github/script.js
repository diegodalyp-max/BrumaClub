function safeSessionGet(key) { try { return window.sessionStorage.getItem(key); } catch { return null; } }
function safeSessionSet(key, value) { try { window.sessionStorage.setItem(key, value); } catch {} }
function safeLocalGet(key) { try { return window.localStorage.getItem(key); } catch { return null; } }
function safeLocalSet(key, value) { try { window.localStorage.setItem(key, value); } catch {} }

/* ==========================================================================
   BRUMA CLUB — site logic
   ==========================================================================
   EDIT EVERYTHING YOU NEED RIGHT HERE ↓
   ========================================================================== */

const CONFIG = {
  // Drop launch — countdown target & automatic pre-sale → launch switch.
  // Lima time (UTC-5). Format: YYYY-MM-DDTHH:mm:ss-05:00
  DROP_DATE: "2027-05-18T19:00:00-05:00",

  // Force a mode for testing: "auto" | "presale" | "launch"
  MODE: "auto",

  // ---- PRICE -------------------------------------------------------------
  // PRICE drives everything. Leave it "" (or null) to HIDE the price entirely
  // — nothing shows "0". CURRENCY is the symbol shown beside the soles amount.
  PRICE: 350,           // base amount in soles · "" hides the price everywhere
  CURRENCY: "S/",       // symbol for the base price
  PRICE_USD: 95,        // optional USD equivalent for the toggle · "" hides USD

  // ---- EARLY ACCESS ------------------------------------------------------
  // List members buy this many minutes before the public reveal. Share a
  // link with ?early=CODE (or the code itself) so they unlock the window.
  // The public presale → launch switch still follows DROP_DATE only.
  EARLY_ACCESS_MINUTES: 120,
  EARLY_ACCESS_CODE: "BRUMA-EARLY",

  // ---- RETURNS -----------------------------------------------------------
  // What happens to a returned numbered piece. true → the number returns to
  // stock and is flagged "Last available". false → it is retired forever.
  RETURNS_BACK_TO_STOCK: true,

  // Shipping copy (edit freely — shown in drop section, checkout & FAQ)
  SHIPPING_NOTE: "Ships from Lima · Peru nationwide — international waitlist",

  // ---- EMAIL CAPTURE -----------------------------------------------------
  // Point this at your provider and the waitlist forms go live:
  //  · Formspree:  "https://formspree.io/f/XXXXXXXX"
  //  · Mailchimp:  your embedded-form POST url
  //  · Klaviyo:    your list endpoint (or a tiny serverless proxy)
  // Empty string = simulate locally (no network call).
  FORM_ENDPOINT: "",

  // ---- CONTACT -----------------------------------------------------------
  WHATSAPP: "51999999999", // country code + number, no "+" (EDIT ME)
  WHATSAPP_TEXT: "Hi BRUMA CLUB — I have a question about Drop 001.",

  // ---- ANALYTICS (leave empty to disable) ---------------------------------
  GA4_ID: "",        // e.g. "G-XXXXXXXXXX"
  META_PIXEL_ID: "", // e.g. "123456789012345"

  // ---- PAYMENT -----------------------------------------------------------
  // provider: "simulate" | "culqi" | "izipay" | "mercadopago" | "stripe"
  // Fill the matching key and implement the marked block in processPayment().
  PAYMENT: {
    provider: "simulate",
    culqiPublicKey: "",      // pk_test_… from https://culqi.com
    izipayMerchantId: "",    // from https://izipay.pe
    mercadoPagoKey: "",      // public key from https://mercadopago.com.pe
    stripePublicKey: "",     // pk_… from https://stripe.com
  },

  // ---- AMBASSADOR / INVITATION CODES --------------------------------------
  // code → label shown to the buyer. Orders carry the code for tracking.
  AMBASSADOR_CODES: {
    "GARUA01": "a Founding Ambassador",
    "LIMA25": "a Friend of the Club",
  },

  // Stock per color. remaining = pieces left; 0 = SOLD OUT.
  // image = real product photo, shown automatically in LAUNCH mode.
  COLORS: [
    { id: "camel",  name: "Camel",       swatch: "#B18F6A", pantone: "Pantone 16-1320", total: 25, remaining: 23, image: "assets/crewneck-camel.webp" },
    { id: "birch",  name: "Birch Cream", swatch: "#E3DAC5", pantone: "Pantone 13-0905", total: 25, remaining: 25, image: "assets/crewneck-birch.webp" },
    { id: "navy",   name: "Navy",        swatch: "#262E42", pantone: "Pantone 19-3933", total: 25, remaining: 17, image: "assets/crewneck-navy.webp" },
    { id: "carbon", name: "Carbon",      swatch: "#2A2C31", pantone: "Pantone 19-4007", total: 25, remaining: 9,  image: "assets/crewneck-carbon.webp" },
  ],

  // A color is flagged "low" (camel-highlighted counter) at or below this.
  LOW_STOCK_AT: 10,
};

/* ========================================================================== */

const dropTime = new Date(CONFIG.DROP_DATE).getTime();

// "Revealed 07.18" label derived from DROP_DATE
const [revealYear, revealMonth, revealDay] = CONFIG.DROP_DATE.slice(0,10).split("-").map(Number);
const REVEAL_SHORT = `${String(revealMonth).padStart(2,"0")}.${String(revealDay).padStart(2,"0")}`;
const REVEAL_LONG = new Date(Date.UTC(revealYear,revealMonth-1,revealDay,12)).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone:"UTC" });

// Public launch — follows DROP_DATE (or a forced MODE) only.
function isPublicLaunched() {
  if (CONFIG.MODE === "presale") return false;
  if (CONFIG.MODE === "launch") return true;
  return Date.now() >= dropTime; // "auto": flips by itself when the countdown hits 0
}

// Early access — granted by ?early=CODE (or the bare code), stored per browser.
// Lets list members into the LAUNCH experience EARLY_ACCESS_MINUTES sooner.
(function grantEarlyAccess() {
  const p = new URLSearchParams(location.search);
  const code = (p.get("early") || p.get("access") || "").trim();
  if (code && code.toUpperCase() === CONFIG.EARLY_ACCESS_CODE.toUpperCase()) {
    try { localStorage.setItem("bruma_early", "1"); } catch {}
  }
})();
function hasEarlyAccess() {
  try { return localStorage.getItem("bruma_early") === "1"; } catch { return false; }
}
function earlyWindowOpen() {
  return Date.now() >= dropTime - CONFIG.EARLY_ACCESS_MINUTES * 60000;
}
// Effective launch for THIS visitor: the public, or an early member in the window.
function isLaunched() {
  return isPublicLaunched() || (hasEarlyAccess() && earlyWindowOpen());
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad = (n) => String(n).padStart(2, "0");

// Respect users who ask for less motion — all flourishes switch off.
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE_POINTER = window.matchMedia("(pointer: fine)").matches;

// Currency token used internally: "PEN" | "USD".
let currency = "PEN";
const hasPrice = () => CONFIG.PRICE !== "" && CONFIG.PRICE != null;
const hasUSD = () => CONFIG.PRICE_USD !== "" && CONFIG.PRICE_USD != null;
function priceAmount(cur = currency) {
  return cur === "USD" ? CONFIG.PRICE_USD : CONFIG.PRICE;
}
// Elegant label, or "" when no price is set (never shows "0").
function priceLabel(cur = currency) {
  if (cur === "USD") return hasUSD() ? `$ ${CONFIG.PRICE_USD} USD` : "";
  return hasPrice() ? `${CONFIG.CURRENCY} ${CONFIG.PRICE}` : "";
}

/* ============ ANALYTICS — GA4 + Meta Pixel (enabled by CONFIG ids) ============ */
(function analytics() {
  if (CONFIG.GA4_ID) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.GA4_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", CONFIG.GA4_ID);
  }
  if (CONFIG.META_PIXEL_ID) {
    !(function (f, b, e, v, n, t, sc) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      sc = b.getElementsByTagName(e)[0]; sc.parentNode.insertBefore(t, sc);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", CONFIG.META_PIXEL_ID);
    fbq("track", "PageView");
  }
})();

// One funnel, two trackers. GA4 event name in, Meta standard event mapped.
const META_EVENTS = {
  join_list: "Lead",
  view_product: "ViewContent",
  reserve: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
};
function track(name, params = {}) {
  if (window.gtag) gtag("event", name, params);
  if (window.fbq) fbq("track", META_EVENTS[name] || name, params);
}

/* ============ ENTRY GATE ============ */
// Black screen → logo fades in → tagline → site reveals. ~2s total.
(function gate() {
  const gate = $("#gate");
  setTimeout(() => {
    if (!gate) return;
    gate.classList.add("leaving");
    document.body.classList.remove("gated");
    // deep links (#drop, #membership…) couldn't anchor while the gate
    // locked the scroll — honor them now
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView();
    }
  }, 1700);
  setTimeout(() => gate?.remove(), 2500);
})();

/* ==========================================================================
   SCROLL ENGINE — nav, progress hairline, parallax, manifesto fade-outs,
   material zoom and the Unboxing sequence. One cached-measure rAF loop;
   everything animates via transform/opacity only.
   ========================================================================== */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
// progress of p through the window [a, b], eased 0→1
const seg = (p, a, b) => easeIO(clamp01((p - a) / (b - a)));

function pageTop(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

const parallaxEls = $$("[data-parallax]").map((el) => ({
  el, speed: parseFloat(el.dataset.parallax), top: 0, h: 0,
}));
const beats = $$(".beat").map((el) => ({
  el, statement: $(".statement", el), top: 0, h: 0,
}));
const SCROLL = { max: 1, ubTop: 0, ubRange: 1, matTop: 0, matH: 1 };

function measureScroll() {
  const vh = window.innerHeight;
  parallaxEls.forEach((p) => { p.top = pageTop(p.el); p.h = p.el.offsetHeight; });
  beats.forEach((b) => { b.top = pageTop(b.el); b.h = b.el.offsetHeight; });
  const runway = $(".ub-runway");
  if (runway) {
    SCROLL.ubTop = pageTop(runway);
    SCROLL.ubRange = Math.max(1, runway.offsetHeight - vh);
  }
  const mat = $("#material");
  SCROLL.matTop = pageTop(mat);
  SCROLL.matH = mat.offsetHeight;
  SCROLL.max = document.documentElement.scrollHeight - vh;
}
measureScroll();
window.addEventListener("resize", () => { measureScroll(); onScroll(); });
window.addEventListener("load", () => { measureScroll(); onScroll(); });

let scrollTicking = false;
function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;

    $("#nav").classList.toggle("scrolled", y > 40);
    $("#progress").style.transform = `scaleX(${SCROLL.max > 0 ? y / SCROLL.max : 0})`;
    document.body.classList.toggle("cta-on", y > vh * 0.7); // mobile sticky CTA

    if (REDUCED) return;

    // layered parallax
    parallaxEls.forEach((p) => {
      const off = (p.top + p.h / 2 - y - vh / 2) * -p.speed;
      p.el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });

    // manifesto: each pinned phrase breathes out as its runway ends
    beats.forEach((b) => {
      const end = b.top + b.h;
      const t = clamp01((y - (end - vh * 1.18)) / (vh * 0.33));
      b.statement.style.opacity = (1 - t).toFixed(3);
      b.statement.style.transform = `translate3d(0, ${(-26 * t).toFixed(1)}px, 0)`;
    });

    // material: slow zoom into the texture as the section passes
    const mp = clamp01((y + vh - SCROLL.matTop) / (SCROLL.matH + vh));
    $$("#material .material-images .material-image").forEach((ph) => {
      ph.style.transform = `scale(${(1 + 0.1 * mp).toFixed(4)})`;
    });

    // the unboxing — only while its runway is on stage
    if (y > SCROLL.ubTop - vh && y < SCROLL.ubTop + SCROLL.ubRange + vh) {
      ubUpdate(clamp01((y - SCROLL.ubTop) / SCROLL.ubRange));
    }
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ============ THE UNBOXING — scroll-driven sequence ============ */
// p 0→1 across the 380vh runway. Each layer gets its own window:
//   0.00–0.14  the closed box emerges from the mist
//   0.14–0.30  the lid lifts (sheen sweeps), tissue appears
//   0.32–0.50  the numbered leather comes into focus
//   0.52–0.68  the passport slides in from the left
//   0.70–0.84  the edition card rises — MEMBER 001
//   0.86–1.00  everything settles; the CTA breathes in
const UB = {
  boxClosed: $(".ub-box-closed"),
  boxOpen: $(".ub-box-open"),
  tissue: $(".ub-tissue"),
  leather: $(".ub-leather"),
  passport: $(".ub-passport"),
  card: $(".ub-card"),
  sheen: $(".ub-sheen"),
  eyebrow: $(".ub-eyebrow"),
  caps: $$(".ub-cap"),
  cta: $("#ub-cta"),
};

// caption visibility window [in-start, out-end]
const UB_CAP_WINDOWS = [
  [0.03, 0.17],
  [0.33, 0.50],
  [0.53, 0.68],
  [0.71, 0.85],
];

function capOpacity(p, [a, b]) {
  return seg(p, a, a + 0.04) * (1 - seg(p, b - 0.04, b));
}

function ubUpdate(p) {
  if (!UB.boxClosed || REDUCED) return;

  UB.eyebrow.style.opacity = seg(p, 0.02, 0.08) * (1 - seg(p, 0.9, 0.97));

  // closed box: emerges, then tilts back and gives way to the open box
  const bcIn = seg(p, 0.0, 0.1);
  const bcOut = seg(p, 0.16, 0.28);
  UB.boxClosed.style.opacity = (bcIn * (1 - bcOut)).toFixed(3);
  UB.boxClosed.style.transform =
    `perspective(900px) scale(${(0.94 + 0.06 * bcIn).toFixed(4)}) rotateX(${(-14 * bcOut).toFixed(2)}deg)`;

  // sheen sweeps across while the lid lifts
  const shWin = seg(p, 0.13, 0.19) * (1 - seg(p, 0.25, 0.31));
  UB.sheen.style.opacity = shWin.toFixed(3);
  UB.sheen.style.transform = `translate3d(${(-55 + 110 * seg(p, 0.13, 0.31)).toFixed(1)}%, 0, 0)`;

  // open box: takes over, recedes slightly in the final composition
  const boIn = seg(p, 0.18, 0.28);
  const settle = seg(p, 0.86, 0.97);
  UB.boxOpen.style.opacity = boIn.toFixed(3);
  UB.boxOpen.style.transform =
    `scale(${(0.98 + 0.02 * boIn - 0.05 * settle).toFixed(4)}) translate3d(0, ${(2.5 * settle).toFixed(2)}%, 0)`;

  // tissue peeks out, then steps back when the leather takes focus
  const tIn = seg(p, 0.22, 0.31);
  UB.tissue.style.opacity = (tIn * (1 - 0.65 * seg(p, 0.46, 0.56)) * (1 - settle)).toFixed(3);
  UB.tissue.style.transform = `translate3d(0, ${(14 - 14 * tIn).toFixed(1)}px, 0)`;

  // the numbered leather: blur-to-focus close-up
  const lIn = seg(p, 0.32, 0.44);
  const lOut = seg(p, 0.78, 0.88);
  UB.leather.style.opacity = (lIn * (1 - lOut)).toFixed(3);
  UB.leather.style.transform = `scale(${(1.16 - 0.16 * lIn).toFixed(4)})`;
  UB.leather.style.filter = `blur(${(5 * (1 - lIn)).toFixed(2)}px)`;

  // the passport slides in from the left and stays for the finale
  const pIn = seg(p, 0.52, 0.64);
  UB.passport.style.opacity = pIn.toFixed(3);
  UB.passport.style.transform =
    `translate3d(${(-34 + 34 * pIn + 4 * settle).toFixed(1)}%, ${(6 - 6 * pIn).toFixed(1)}%, 0) rotate(${(-7 + 4 * pIn).toFixed(2)}deg)`;

  // the edition card rises to the front — member number reveals
  const cIn = seg(p, 0.7, 0.8);
  UB.card.style.opacity = cIn.toFixed(3);
  UB.card.style.transform =
    `translate3d(${(-4 * settle).toFixed(1)}%, ${(22 - 22 * cIn).toFixed(1)}%, 0) scale(${(0.92 + 0.1 * cIn - 0.04 * settle).toFixed(4)})`;
  UB.card.classList.toggle("show", p > 0.74);

  UB.caps.forEach((cap, i) => {
    cap.style.opacity = capOpacity(p, UB_CAP_WINDOWS[i]).toFixed(3);
  });

  const ctaIn = seg(p, 0.88, 0.96);
  UB.cta.style.opacity = ctaIn.toFixed(3);
  UB.cta.classList.toggle("live", p > 0.9);
}
// prime the sequence so the stage isn't empty before the first scroll
if (!REDUCED) ubUpdate(0);

// CTA copy follows the drop mode
if (UB.cta) UB.cta.textContent = isLaunched() ? "Become a member" : "Reserve your piece";

/* ============ COUNTDOWN ============ */
// Digits get a soft micro-flip whenever they change.
function setNum(sel, val) {
  const el = $(sel);
  if (el.textContent === val) return;
  el.textContent = val;
  if (!REDUCED) {
    el.classList.remove("tick");
    void el.offsetWidth; // restart the animation
    el.classList.add("tick");
  }
}

function tickCountdown() {
  const diff = dropTime - Date.now();
  const cd = $("#countdown");

  if (diff <= 0 || isLaunched()) {
    // LAUNCH mode — countdown becomes a live banner
    setNum("#cd-days", "00");
    setNum("#cd-hours", "00");
    setNum("#cd-mins", "00");
    setNum("#cd-secs", "00");
    cd.classList.add("live");
    $("#cd-caption").textContent = "Drop 001 — now live.";
    return;
  }

  setNum("#cd-days", pad(Math.floor(diff / 86400000)));
  setNum("#cd-hours", pad(Math.floor((diff % 86400000) / 3600000)));
  setNum("#cd-mins", pad(Math.floor((diff % 3600000) / 60000)));
  setNum("#cd-secs", pad(Math.floor((diff % 60000) / 1000)));
  $("#cd-caption").textContent = `The reveal drops ${REVEAL_LONG}.`;
}
tickCountdown();
setInterval(() => {
  tickCountdown();
  // When the countdown reaches zero in "auto" mode, re-render the drop
  // section so covered cards flip to product photos + "Buy now".
  if (isLaunched() && !document.body.dataset.launched) {
    document.body.dataset.launched = "1";
    renderDrop();
  }
}, 1000);

/* ============ DROP 001 CARDS ============ */
// PRE-SALE: covered card (veiled silhouette + "Revealed 07.18", blind reserve).
// LAUNCH:  real photo from /assets + "Buy now". Switches automatically by date.
function renderDrop() {
  const launched = isLaunched();
  const grid = $("#drop-grid");
  grid.innerHTML = "";

  setTitle("#drop-title", launched ? "Now revealed." : "Reserved before it's seen.");
  $("#drop-intro").innerHTML = launched
    ? `<span class="count" data-target="100">100</span> pieces. Each one numbered.<br />What's left is all there is.`
    : `<span class="count" data-target="100">100</span> pieces. Each one numbered.<br />The reveal drops ${REVEAL_LONG}.`;

  // Sober price line — hidden entirely when PRICE is empty.
  const priceEl = $("#drop-price");
  if (priceEl) {
    const lbl = priceLabel("PEN");
    priceEl.innerHTML = lbl ? `${lbl} <span>· the edition price</span>` : "";
    priceEl.hidden = !lbl;
  }

  CONFIG.COLORS.forEach((c) => {
    const sold = c.remaining <= 0;
    const low = !sold && c.remaining <= CONFIG.LOW_STOCK_AT;
    const last = c.remaining === 1; // the very last numbered piece

    const card = document.createElement("article");
    card.className = "drop-card reveal" + (sold ? " soldout" : "");

    const visual = launched
      ? // LAUNCH — real photo; if missing, an elegant placeholder shows instead
        `<div class="card-visual">
           <img src="${c.image}" alt="Drop 001 crewneck — ${c.name}" loading="lazy" decoding="async" width="1122" height="1402" />
         </div>`
      : // PRE-SALE — veiled
        `<div class="card-visual">
           <div class="card-silhouette" style="background:${c.swatch}"></div>
           <span class="card-veil">${sold ? "Sold out" : `Revealed ${REVEAL_SHORT}`}</span>
         </div>`;

    card.innerHTML = `
      ${visual}
      <h3 class="card-name"><span class="card-swatch" style="background:${c.swatch}"></span>${c.name}</h3>
      <p class="card-edition">Edition of ${c.total}</p>
      <p class="card-meta">${c.pantone} · Peruvian pima</p>
      <p class="card-stock${low ? " low" : ""}">${
        sold
          ? "SOLD OUT"
          : last
          ? `<strong>Last available</strong> · Nº ${pad(c.total)} / ${c.total}`
          : `<strong class="count" data-target="${c.remaining}">${c.remaining}</strong> / ${c.total} remaining`
      }</p>
      <button class="btn ${sold ? "btn-ghost" : "btn-solid"}" ${sold ? "disabled" : ""} data-color="${c.id}">
        ${sold ? "Sold out" : launched ? "Buy now" : "Reserve your piece"}
      </button>
    `;

    if (!sold) {
      $("button", card).addEventListener("click", () => openCheckout(c.id));
    }
    grid.appendChild(card);
    requestAnimationFrame(() => observeReveal(card));
  });

  initCountUps($("#drop"));
  initMagnetic();
  measureScroll(); // card grid changes the page height — re-cache positions
}

/* ============ SCROLL REVEAL (IntersectionObserver) ============ */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
);
function observeReveal(el) { io.observe(el); }
$$(".reveal").forEach(observeReveal);

// staggered groups: children cascade in one after another
$$("[data-stagger]").forEach((group) => {
  group.classList.remove("reveal"); // the group itself stays put
  [...group.children].forEach((child, i) => {
    child.classList.add("reveal");
    child.style.transitionDelay = `${i * 130}ms`;
    observeReveal(child);
  });
});

/* ============ TITLE MASK REVEAL ============ */
// Big serif titles rise out of a clipped line (CSS .title.tr). The inner
// span is what carries text, so updates must go through setTitle().
$$(".title").forEach((t) => {
  const inner = document.createElement("span");
  inner.className = "tr-inner";
  while (t.firstChild) inner.appendChild(t.firstChild);
  t.appendChild(inner);
  t.classList.add("tr");
});
function setTitle(sel, text) {
  const el = $(sel);
  ($(".tr-inner", el) || el).textContent = text;
}

/* ============ MANIFESTO — word-by-word rise on each pinned beat ============ */
function wrapWords(el) {
  [...el.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) {
          frag.appendChild(document.createTextNode(" "));
        } else {
          const s = document.createElement("span");
          s.className = "w";
          s.textContent = tok;
          frag.appendChild(s);
        }
      });
      el.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== "BR") {
      wrapWords(node); // keep <em> styling, wrap the words inside it
    }
  });
}

$$(".statement").forEach((st) => {
  wrapWords(st);
  $$(".w", st).forEach((w, i) => { w.style.transitionDelay = `${i * 90}ms`; });
});

const ioBeat = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        $(".statement", e.target).classList.add("in");
        ioBeat.unobserve(e.target);
      }
    });
  },
  { threshold: 0.55 }
);
$$(".beat-inner").forEach((b) => ioBeat.observe(b));

/* ============ COUNT-UP NUMBERS ============ */
const ioCount = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        ioCount.unobserve(e.target);
        runCount(e.target);
      }
    });
  },
  { threshold: 0.6 }
);

function initCountUps(root = document) {
  $$(".count", root).forEach((el) => {
    if (REDUCED) { el.textContent = el.dataset.target; return; }
    el.textContent = "0";
    ioCount.observe(el);
  });
}

function runCount(el) {
  const target = +el.dataset.target;
  const dur = 1100;
  const t0 = performance.now();
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); // ease-out
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ============ FOG — Lima's garúa over the dark sections ============ */
// Injects three drifting haze layers behind the content of every dark
// section (hero, how-it-works, material, membership, footer). The drift
// itself is pure CSS; here we only add a whisper of mouse parallax.
(function initFog() {
  $$("#hero, section.dark, footer.dark, #unboxing .ub-stage").forEach((sec) => {
    const fog = document.createElement("div");
    fog.className = "fog";
    fog.setAttribute("aria-hidden", "true");
    fog.innerHTML = '<i class="f0"></i><i class="f1"></i><i class="f2"></i><i class="f3"></i>';
    sec.prepend(fog);
  });

  // Subtle parallax toward the mouse — desktop only, lerped, GPU transforms
  if (REDUCED || !FINE_POINTER) return;
  const layers = $$(".fog i");
  const depth = { f0: 4, f1: 6, f2: 12, f3: 20 }; // px of max drift per layer
  let tx = 0, ty = 0, x = 0, y = 0;
  document.addEventListener("mousemove", (e) => {
    tx = e.clientX / innerWidth - 0.5;
    ty = e.clientY / innerHeight - 0.5;
  }, { passive: true });
  (function loop() {
    x += (tx - x) * 0.04;
    y += (ty - y) * 0.04;
    layers.forEach((l) => {
      const d = depth[l.className] || 8;
      l.style.transform = `translate3d(${(-x * d).toFixed(2)}px, ${(-y * d * 0.6).toFixed(2)}px, 0)`;
    });
    requestAnimationFrame(loop);
  })();
})();

/* ============ MAGNETIC BUTTONS (desktop only, very subtle) ============ */
function initMagnetic() {
  if (REDUCED || !FINE_POINTER) return;
  $$(".btn, .nav-cta").forEach((btn) => {
    if (btn.dataset.mag) return;
    btn.dataset.mag = "1";
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
      const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
      btn.style.transform = `translate(${(x * 4).toFixed(1)}px, ${(y * 3).toFixed(1)}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
}
initMagnetic();

/* ============ CURSOR RING (desktop only) ============ */
(function cursorRing() {
  if (REDUCED || !FINE_POINTER) return;
  const c = $("#cursor");
  document.body.classList.add("has-cursor");
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty;
  document.addEventListener("mousemove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
    c.classList.add("visible");
  });
  document.addEventListener("mouseover", (e) => {
    c.classList.toggle("on", !!e.target.closest("a, button"));
  });
  (function loop() {
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    const half = c.offsetWidth / 2;
    c.style.transform = `translate3d(${x - half}px, ${y - half}px, 0)`;
    requestAnimationFrame(loop);
  })();
})();

/* ============ CHECKOUT — guest, no account ============ */
const checkout = $("#checkout");
let ckColor = null;
let ckSize = "M";

function nextNumber(c) { return c.total - c.remaining + 1; } // next piece number assigned

function openCheckout(colorId) {
  const launched = isLaunched();
  ckColor = CONFIG.COLORS.find((c) => c.id === colorId && c.remaining > 0)
         || CONFIG.COLORS.find((c) => c.remaining > 0);
  if (!ckColor) return; // everything sold out

  $("#ck-eyebrow").textContent = launched ? "Drop 001 · Live" : "Drop 001 · Pre-sale";
  $("#ck-title").textContent = launched ? "Claim your piece." : "Reserve your piece.";
  $("#ck-sub").textContent = launched
    ? "Numbered, boxed, yours."
    : `You're buying blind. The reveal drops ${REVEAL_LONG}.`;
  $("#ck-pay").textContent = launched ? "Buy now" : "Proceed to payment";

  renderCkColors();
  updateCkSummary();
  $("#ck-step-select").hidden = false;
  $("#ck-step-done").hidden = true;
  checkout.hidden = false;
  document.body.classList.add("checkout-open");
  track("reserve", {
    currency,
    value: priceAmount(),
    item: "drop-001-crewneck",
    color: ckColor.id,
    mode: launched ? "launch" : "presale",
  });
}

function closeCheckout() {
  checkout.hidden = true;
  document.body.classList.remove("checkout-open");
}

function renderCkColors() {
  const wrap = $("#ck-colors");
  wrap.innerHTML = "";
  CONFIG.COLORS.forEach((c) => {
    const sold = c.remaining <= 0;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ck-color" + (c === ckColor ? " active" : "");
    b.disabled = sold;
    b.innerHTML = `<span class="sw" style="background:${c.swatch}"></span><span class="nm">${c.name}</span>`;
    if (!sold) {
      b.addEventListener("click", () => {
        ckColor = c;
        renderCkColors();
        updateCkSummary();
      });
    }
    wrap.appendChild(b);
  });
}

function updateCkSummary() {
  $("#ck-number").textContent = `Nº ${pad(nextNumber(ckColor))} / ${ckColor.total} · ${ckColor.name} · ${ckSize}`;
  const label = priceLabel();
  $("#ck-price").textContent = label;
  $("#ck-price").hidden = !label;
  // Hide the currency toggle unless there's a real price (and a USD option).
  $("#ck-currency").hidden = !hasPrice() || !hasUSD();
}

$$("#ck-sizes button").forEach((b) => {
  b.addEventListener("click", () => {
    $$("#ck-sizes button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ckSize = b.dataset.size;
    updateCkSummary();
  });
});

// currency toggle — soles by default, dollars one tap away
$$(".ck-currency button").forEach((b) => {
  b.addEventListener("click", () => {
    currency = b.dataset.cur;
    $$(".ck-currency button").forEach((x) => x.classList.toggle("active", x === b));
    updateCkSummary();
    updateStickyCta();
  });
});

// receipt toggle — Factura reveals the RUC + business-name fields
$$("#ck-receipt button").forEach((b) => {
  b.addEventListener("click", () => {
    $$("#ck-receipt button").forEach((x) => x.classList.toggle("active", x === b));
    $("#ck-factura").hidden = b.dataset.receipt !== "factura";
  });
});

// invitation / ambassador code — optional, validated quietly as you type
$("#ck-code").addEventListener("input", () => {
  const code = $("#ck-code").value.trim().toUpperCase();
  const msg = $("#ck-code-msg");
  if (!code) { msg.hidden = true; return; }
  const label = CONFIG.AMBASSADOR_CODES[code];
  msg.hidden = false;
  msg.classList.toggle("bad", !label);
  msg.textContent = label
    ? `Welcomed by ${label} — your reservation carries their mark.`
    : "Code not recognized — you can still continue.";
});

/* ---- PAYMENT ----------------------------------------------------------
   processPayment() is the single plug point. Pick a provider in
   CONFIG.PAYMENT, drop in your key, and implement the marked block —
   everything you need (amount, buyer, color, size, number, ambassador
   code) is already in `order`. Until then it simulates locally.
------------------------------------------------------------------------- */
$("#ck-pay").addEventListener("click", () => {
  const name = $("#ck-name").value.trim();
  const email = $("#ck-email").value.trim();
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  $("#ck-name").style.borderBottomColor = name ? "" : "#b15f5f";
  $("#ck-email").style.borderBottomColor = emailOk ? "" : "#b15f5f";
  if (!name || !emailOk) return;

  // Receipt: Boleta (default) or Factura — Factura needs RUC + razón social.
  const receipt = $("#ck-receipt .active")?.dataset.receipt || "boleta";
  let ruc = "", company = "";
  if (receipt === "factura") {
    ruc = $("#ck-ruc").value.trim();
    company = $("#ck-company").value.trim();
    const rucOk = /^\d{11}$/.test(ruc);
    $("#ck-ruc").style.borderBottomColor = rucOk ? "" : "#b15f5f";
    $("#ck-company").style.borderBottomColor = company ? "" : "#b15f5f";
    if (!rucOk || !company) return;
  }

  const code = $("#ck-code").value.trim().toUpperCase();
  const order = {
    drop: "001",
    item: "drop-001-crewneck",
    color: ckColor.id,
    size: ckSize,
    number: nextNumber(ckColor),
    edition: ckColor.total,
    // global member number: pieces already taken across all colors + 1
    memberNo: CONFIG.COLORS.reduce((s, c) => s + (c.total - c.remaining), 0) + 1,
    amount: priceAmount(),
    currency,
    name,
    email,
    receipt,                                  // "boleta" | "factura"
    ruc: ruc || null,
    company: company || null,
    ambassador: CONFIG.AMBASSADOR_CODES[code] ? code : null,
    mode: isLaunched() ? "launch" : "presale",
  };

  track("begin_checkout", {
    currency: order.currency,
    value: order.amount,
    item: order.item,
    color: order.color,
    receipt: order.receipt,
  });
  processPayment(order);
});

function processPayment(order) {
  switch (CONFIG.PAYMENT.provider) {
    case "culqi":
      // 1. <script src="https://checkout.culqi.com/js/v4"></script> in index.html
      // 2. Culqi.publicKey = CONFIG.PAYMENT.culqiPublicKey;
      //    Culqi.settings({ title: "BRUMA CLUB", currency: order.currency,
      //                     amount: order.amount * 100, order: ... });
      //    Culqi.open();  → on token, POST { token, order } to your backend
      //    to create the charge, then call completeOrder(order).
      return alert("Culqi is not connected. No payment was processed.");

    case "izipay":
      // Embed the Izipay form (https://developers.izipay.pe) with
      // CONFIG.PAYMENT.izipayMerchantId; call completeOrder(order) on success.
      return alert("Izipay is not connected. No payment was processed.");

    case "mercadopago":
      // POST `order` to your backend → create a Preference with the
      // mercadopago SDK → window.location = preference.init_point;
      // confirm via webhook, then completeOrder(order) on the return URL.
      return alert("Mercado Pago is not connected. No payment was processed.");

    case "stripe":
      // POST `order` to your backend → stripe.checkout.sessions.create
      // ({ mode:"payment", currency, line_items:[…], metadata: order })
      // → window.location = session.url; completeOrder(order) on success page.
      return alert("Stripe is not connected. No payment was processed.");

    default:
      return simulatePayment(order);
  }
}

function simulatePayment(order) {
  const btn = $("#ck-pay");
  btn.classList.add("processing");
  btn.textContent = "Processing…";
  setTimeout(() => {
    btn.classList.remove("processing");
    btn.textContent = isLaunched() ? "Buy now" : "Proceed to payment";
    completeOrder(order);
  }, 1300);
}

// The "welcome to the club" moment — call this once payment is confirmed.
function completeOrder(order) {
  // Demo only: decrement in-memory stock. In production the backend owns
  // stock and assigns numbers atomically at payment confirmation.
  ckColor.remaining -= 1;

  $("#ck-done-number").textContent = `Nº ${pad(order.number)} / ${order.edition}`;
  $("#ck-done-detail").textContent =
    `${ckColor.name} · ${order.size}` + (order.ambassador ? ` · via ${order.ambassador}` : "");
  $("#ck-done-member").textContent = `MEMBER Nº ${String(order.memberNo).padStart(3, "0")} · DROP 001`;
  $("#ck-done-note").textContent = CONFIG.PAYMENT.provider === "simulate"
    ? "Demo only: no payment was charged, no stock was reserved, and no email or receipt was sent."
    : (order.receipt === "factura" ? "Factura requested." : "Receipt requested.");
  $("#ck-next-reveal").hidden = order.mode === "launch";
  $("#ck-done-title").textContent = CONFIG.PAYMENT.provider === "simulate"
    ? "Preview complete." : "Welcome to the club.";
  $("#ck-step-select").hidden = true;
  $("#ck-step-done").hidden = false;

  track("purchase", {
    currency: order.currency,
    value: order.amount,
    item: order.item,
    color: order.color,
    size: order.size,
    number: order.number,
    ambassador: order.ambassador || undefined,
  });

  renderDrop(); // refresh counters / sold-out states
  updateStickyCta();
}

// Openers (hero + nav CTAs) and closers
$$("[data-open-checkout]").forEach((el) =>
  el.addEventListener("click", (e) => {
    e.preventDefault();
    $("#drop").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => openCheckout(), 450);
  })
);
$$("[data-close-checkout]").forEach((el) => el.addEventListener("click", closeCheckout));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !checkout.hidden) closeCheckout();
});

/* ============ JOIN-THE-LIST FORM (optional) ============ */
// Populate "color of interest" from CONFIG
$("#jf-color").innerHTML = CONFIG.COLORS
  .map((c) => `<option value="${c.id}">${c.name}</option>`)
  .join("");

// Sends to CONFIG.FORM_ENDPOINT when set (Formspree/Mailchimp/Klaviyo);
// simulates locally while it's empty.
async function submitLead(fields) {
  if (!CONFIG.FORM_ENDPOINT) return true; // visual preview only; data is not sent
  try {
    const body = new FormData();
    Object.entries(fields).forEach(([k, v]) => body.append(k, v));
    const res = await fetch(CONFIG.FORM_ENDPOINT, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

$("#join-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  if (!$(`#jf-name`).value.trim() || !/^\S+@\S+\.\S+$/.test($(`#jf-email`).value)) {
    form.reportValidity();
    return;
  }
  const btn = $("button[type=submit]", form);
  btn.textContent = "Joining…";
  const ok = await submitLead({
    name: $(`#jf-name`).value.trim(),
    email: $(`#jf-email`).value.trim(),
    size: $(`#jf-size`).value,
    color: $(`#jf-color`).value,
    source: "waitlist",
  });
  btn.textContent = "Join the list";
  if (!ok) { alert("Something went wrong — please try again."); return; }
  if (CONFIG.FORM_ENDPOINT) track("join_list", { source: "waitlist" });
  $("#join-confirm-copy").textContent = CONFIG.FORM_ENDPOINT
    ? "We'll notify you when your drop opens."
    : "Preview only: your details were not sent or saved. Connect the mailing list to receive signups.";
  $("#join-confirm .confirm-title").textContent = CONFIG.FORM_ENDPOINT ? "You're on the list." : "Preview complete.";
  form.hidden = true;
  const confirm = $("#join-confirm");
  confirm.hidden = false;
  confirm.classList.add("reveal");
  requestAnimationFrame(() => confirm.classList.add("in"));
});

/* ============ QUIET CAPTURE BANNER — exit intent / timed ============ */
(function captureBanner() {
  const banner = $("#capture-banner");
  if (!banner || safeSessionGet("bruma_cb")) return;
  let shown = false;

  function show() {
    if (shown || !checkout.hidden) return;
    shown = true;
    banner.hidden = false;
  }
  function dismiss() {
    banner.hidden = true;
    safeSessionSet("bruma_cb", "1");
  }

  // desktop: when the cursor leaves toward the top bar
  document.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget && e.clientY <= 0) show();
  });
  // everyone: a patient fallback
  setTimeout(show, 50000);

  $(".cb-close", banner).addEventListener("click", dismiss);
  $("#cb-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#cb-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    const ok = await submitLead({ email, source: "exit-banner" });
    if (!ok) { alert("Unable to submit — please try again."); return; }
    if (CONFIG.FORM_ENDPOINT) track("join_list", { source: "exit-banner" });
    $(".cb-done", banner).textContent = CONFIG.FORM_ENDPOINT
      ? "You're on the list."
      : "Preview only — no email was sent.";
    $("#cb-form").hidden = true;
    $(".cb-text", banner).hidden = true;
    $(".cb-done", banner).hidden = false;
    safeSessionSet("bruma_cb", "1");
    setTimeout(() => { banner.hidden = true; }, 2600);
  });
})();

/* ============ STICKY MOBILE CTA ============ */
function updateStickyCta() {
  const cta = $("#sticky-cta");
  if (!cta) return;
  const anyLeft = CONFIG.COLORS.some((c) => c.remaining > 0);
  cta.textContent = !anyLeft
    ? "Drop 001 — sold out"
    : `${isLaunched() ? "Buy now" : "Reserve your piece"} — ${priceLabel()}`;
}
updateStickyCta();

/* ============ MODALS — size guide & legal pages ============ */
function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add("checkout-open");
  const close = $(".checkout-close", modal);
  if (close) close.focus();
}
function closeModal(modal) {
  modal.hidden = true;
  if (checkout.hidden) document.body.classList.remove("checkout-open");
}
$$("[data-open-sizeguide]").forEach((b) =>
  b.addEventListener("click", (e) => { e.preventDefault(); openModal($("#sizeguide")); })
);
$$("[data-close-modal]").forEach((b) =>
  b.addEventListener("click", () => closeModal(b.closest(".modal")))
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".modal:not([hidden])").forEach(closeModal);
});

// ---- LEGAL COPY — placeholders, edit freely -------------------------------
const LEGAL_PAGES = {
  privacy: {
    title: "Privacy Policy.",
    html: `
      <p><em>Placeholder — replace with your reviewed policy before launch.</em></p>
      <h4>What we collect</h4>
      <p>Your name, email and shipping details when you reserve a piece or join the list. Anonymous analytics to understand our visitors.</p>
      <h4>What we do with it</h4>
      <p>Fulfil your order, assign your number, and write to you about drops. Never sold, never shared beyond payment and shipping partners.</p>
      <h4>Your rights</h4>
      <p>Ask us anytime to see, correct or delete your data: write to @brumaclub.pe or via WhatsApp.</p>`,
  },
  terms: {
    title: "Terms of Service.",
    html: `
      <p><em>Placeholder — replace with your reviewed terms before launch.</em></p>
      <h4>The drop</h4>
      <p>Editions are limited and numbered. Numbers are assigned in order of confirmed payment and are never reissued. Pre-sale purchases are made before the design reveal.</p>
      <h4>Payments</h4>
      <p>Prices in Peruvian soles (S/), USD offered as reference. Payment is processed by our gateway; we never store card details.</p>
      <h4>Membership</h4>
      <p>Owning a piece grants lifetime membership and priority access to future drops. Membership is personal and non-transferable.</p>`,
  },
  shipping: {
    title: "Shipping & Returns.",
    html: `
      <p><em>Placeholder — adjust carriers, times and costs before launch.</em></p>
      <h4>Shipping</h4>
      <ul>
        <li>Ships from Lima within 5–7 days after the July 18 reveal.</li>
        <li>Lima: 1–2 days · rest of Peru: 2–5 days. Cost shown at checkout.</li>
        <li>International: join the list — we'll open routes with Drop 002.</li>
      </ul>
      <h4>Exchanges & returns</h4>
      <ul>
        <li>Size exchange within 7 days of delivery — unworn, box and passport intact.</li>
        <li>Numbered editions are not refundable; your number belongs to you alone.</li>
        <li>${CONFIG.RETURNS_BACK_TO_STOCK
          ? "If a piece is ever returned, its number re-enters stock once — flagged \"Last available\" — for the next member."
          : "If a piece is ever returned, its number is retired and never re-sold."}</li>
        <li>Defects are replaced or fully refunded, no questions.</li>
      </ul>`,
  },
};
$$("[data-legal]").forEach((b) =>
  b.addEventListener("click", () => {
    const page = LEGAL_PAGES[b.dataset.legal];
    if (!page) return;
    $("#legal-title").textContent = page.title;
    $("#legal-body").innerHTML = page.html;
    openModal($("#legal"));
  })
);

/* ============ COOKIE NOTICE ============ */
(function cookies() {
  const el = $("#cookies");
  if (!el || (!CONFIG.GA4_ID && !CONFIG.META_PIXEL_ID) || safeLocalGet("bruma_cookies")) return;
  setTimeout(() => { el.hidden = false; }, 2600);
  $("#cookies-ok").addEventListener("click", () => {
    el.hidden = true;
    safeLocalSet("bruma_cookies", "1");
  });
})();

/* ============ WHATSAPP LINKS ============ */
const waHref = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(CONFIG.WHATSAPP_TEXT)}`;
$$(".wa-link").forEach((a) => {
  a.href = waHref;
  if (!a.textContent.trim()) a.textContent = "WhatsApp";
});

/* ============ FUNNEL: product seen ============ */
const ioDrop = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) {
    track("view_product", { item: "drop-001-crewneck" });
    ioDrop.disconnect();
  }
}, { threshold: 0.25 });
ioDrop.observe($("#drop"));

/* ============ EARLY ACCESS — quiet note for list members ============ */
function updateEarlyNote() {
  const el = $("#early-note");
  if (!el) return;
  // Only meaningful before the public launch and only for granted members.
  if (isPublicLaunched() || !hasEarlyAccess()) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = earlyWindowOpen()
    ? "Early access is open — the club is yours before the public."
    : `Early access granted. You enter ${CONFIG.EARLY_ACCESS_MINUTES} minutes before the public.`;
}
updateEarlyNote();
setInterval(updateEarlyNote, 30000);

/* ============ INIT ============ */
renderDrop();

// Fully initialized, make normal scroll-reveal mode active.
document.documentElement.classList.add("bruma-js");
