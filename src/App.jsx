import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Mic, Square, Paperclip, AlertTriangle, Wifi, WifiOff, RefreshCw,
  FileDown, Printer, ShieldCheck, ShieldAlert, Info, Check, Film, X,
} from "lucide-react";

/* =========================================================================
   KaushalPramaan: RPL assessment console (frontend prototype)
   Everything runs in the browser. See README for what is simulated.
   ========================================================================= */

/* ---------- Config ---------- */

// Set to your FastAPI base URL to post records for real.
// When null, a local stub acknowledges sync requests.
const API_BASE = null;

// Minimum per-NOS score to pass. Varies by SSC assessment criteria.
const PASS_PCT = 70;

const GENESIS = "0".repeat(64);

/* ---------- Text normalisation (Hindi / Hinglish to English terms) ---------- */

const GLOSSARY = [
  ["वायरिंग", "wiring"], ["वायर", "wire cable"], ["तार", "cable wire"],
  ["घरों", "house"], ["घर", "house"], ["मकान", "house building"], ["बिल्डिंग", "building"],
  ["स्विच बोर्ड", "switchboard switch board"], ["स्विचबोर्ड", "switchboard switch board"],
  ["स्विच", "switch"], ["बोर्ड", "board"], ["सॉकेट", "socket"], ["प्लग", "plug"],
  ["पंखे", "fan"], ["पंखा", "fan"], ["ट्यूबलाइट", "light"], ["लाइट", "light"], ["बल्ब", "light"],
  ["फिटिंग", "fitting"], ["रेगुलेटर", "regulator"],
  ["एमसीबी", "mcb"], ["आरसीसीबी", "rccb"], ["डीबी", "db distribution board"],
  ["अर्थिंग", "earthing"], ["मल्टीमीटर", "multimeter"], ["क्लैंप मीटर", "clamp meter"],
  ["मीटर", "meter"], ["टेस्टर", "tester"], ["मेगर", "megger"],
  ["कंटिन्युटी", "continuity"], ["इंसुलेशन", "insulation"], ["पोलैरिटी", "polarity"],
  ["कंड्यूट", "conduit"], ["कंडुइट", "conduit"], ["पाइप", "conduit"],
  ["केसिंग", "casing"], ["कैपिंग", "capping"], ["साइज़", "size"], ["साइज", "size"],
  ["फॉल्ट", "fault"], ["खराबी", "fault"], ["शॉर्ट", "short circuit"], ["ट्रिप", "tripping"],
  ["मरम्मत", "repair"], ["रिपेयर", "repair"], ["ठीक करना", "repair"], ["बदलना", "replace"],
  ["मोटर", "motor"], ["वाइंडिंग", "rewinding"], ["इन्वर्टर", "inverter"], ["इनवर्टर", "inverter"],
  ["सोलर", "solar"], ["पैनल", "panel"],
  ["गीज़र", "geyser appliance"], ["गीजर", "geyser appliance"], ["इस्त्री", "iron appliance"],
  ["मिक्सी", "mixer appliance"], ["वॉशिंग मशीन", "washing machine appliance"], ["फ्रिज", "refrigerator appliance"],
  ["दस्ताने", "gloves ppe"], ["सुरक्षा", "safety"], ["करंट", "shock"],
  ["ट्रांसफार्मर", "transformer"], ["ट्रांसफॉर्मर", "transformer"], ["जनरेटर", "generator"],
  ["पवन चक्की", "wind turbine"], ["खदान", "mine"], ["लोड", "load"], ["नक्शा", "layout"], ["लेआउट", "layout"],
  ["ड्रिल", "drill"], ["प्लायर", "plier"], ["पेचकस", "screwdriver"],
  ["wairing", "wiring"], ["pankha", "fan"], ["ghar", "house"], ["makaan", "house"],
].sort((a, b) => b[0].length - a[0].length);

const STOP = new Set(
  "a an the and or of to in for with on at by is are was were be i my me we our this that it as from have has had do does did can will also all these those its per into each their them before after using use uses given stated marked correct correctly work worked working year years experience".split(" ")
);

function stem(w) {
  if (w.length > 4 && /(ches|shes|xes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function tokens(text) {
  let t = " " + String(text || "").toLowerCase() + " ";
  for (const [from, to] of GLOSSARY) t = t.split(from).join(" " + to + " ");
  return t
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/* ---------- Reference data ----------------------------------------------
   QP codes, titles, NSQF levels, SSCs and the NOS codes shown are taken from
   NQR / SSC qualification files. Unit and performance-criteria text is
   condensed for the prototype; replace it with the full NOS export from
   nqr.gov.in before field use. Units without a verified NOS code have
   code: null and are shown by position.                                     */

const RAW_QPS = [
  {
    code: "ELE/Q5804", title: "Electrician", level: 4,
    ssc: "Electronics Sector Skills Council of India",
    summary: "Plans, installs and tests electrical wiring, distribution boards and sub-systems in residential and commercial buildings.",
    units: [
      {
        code: "ELE/N1002", title: "Apply health and safety practices at the workplace", critical: true,
        kw: "safety ppe gloves isolation shock first aid fire extinguisher hazard",
        pcs: [
          ["Isolates supply at the main switch or MCB and proves the circuit dead with a tester before work", "काम शुरू करने से पहले मेन स्विच बंद करें और टेस्टर से जाँच कर दिखाएँ"],
          ["Selects and uses PPE suited to the task, including insulated gloves and footwear", "काम के हिसाब से दस्ताने और जूते पहनकर दिखाएँ"],
          ["Explains first response to an electric shock and the extinguisher type for electrical fires", "करंट लगने पर पहला कदम और बिजली की आग के लिए सही अग्निशामक बताएँ"],
        ],
      },
      {
        code: "ELE/N5806", title: "Planning, design and installation of electrical and electronics sub-systems",
        kw: "house building wiring layout conduit casing distribution board db mcb rccb earthing load cable size switch socket light fan install testing multimeter megger continuity insulation polarity",
        pcs: [
          ["Reads a wiring layout and marks circuit routes for lighting and power points", "नक्शा देखकर लाइट और पावर पॉइंट की लाइन बताएँ"],
          ["Selects cable size and MCB rating for a stated load", "दिए गए लोड के लिए तार का साइज़ और MCB की रेटिंग चुनें"],
          ["Wires a distribution board with MCB and RCCB, terminating phase, neutral and earth correctly", "DB में MCB और RCCB लगाकर फेज़, न्यूट्रल और अर्थ सही जोड़ें"],
          ["Installs earthing and measures earth continuity", "अर्थिंग लगाएँ और अर्थ कंटिन्युटी नापें"],
          ["Tests continuity, polarity and insulation resistance before energising the circuit", "लाइन चालू करने से पहले कंटिन्युटी, पोलैरिटी और इंसुलेशन जाँचें"],
        ],
      },
    ],
  },
  {
    code: "PSS/Q6001", title: "Electrician Domestic Solutions", level: 3,
    ssc: "Power Sector Skill Council",
    summary: "Carries out household wiring, troubleshoots and repairs faults in existing wiring, and maintains common domestic electrical equipment.",
    units: [
      {
        code: null, title: "Install domestic wiring and accessories",
        kw: "house home domestic wiring conduit casing capping switchboard switch socket fan light fitting regulator",
        pcs: [
          ["Runs conduit or casing-capping wiring along a marked layout", "निशान लगी लाइन पर कंड्यूट या केसिंग-कैपिंग वायरिंग करें"],
          ["Mounts and connects a switchboard with sockets and light points", "स्विच बोर्ड लगाकर सॉकेट और लाइट पॉइंट जोड़ें"],
          ["Installs a ceiling fan with regulator and checks rotation", "रेगुलेटर के साथ छत का पंखा लगाकर चलाकर दिखाएँ"],
        ],
      },
      {
        code: null, title: "Troubleshoot and repair faults in domestic wiring",
        kw: "fault short circuit tripping loose connection repair replace tester multimeter",
        pcs: [
          ["Locates a fault in a test circuit using a tester or multimeter", "टेस्टर या मल्टीमीटर से सर्किट की खराबी ढूँढें"],
          ["Replaces a damaged switch, socket or MCB", "खराब स्विच, सॉकेट या MCB बदलें"],
          ["Explains likely causes of repeated MCB tripping", "MCB बार-बार ट्रिप होने के कारण बताएँ"],
        ],
      },
      {
        code: null, title: "Work safely on domestic installations", critical: true,
        kw: "safety isolation insulated tools ppe gloves shock",
        pcs: [
          ["Switches off and proves supply dead before touching conductors", "तार छूने से पहले सप्लाई बंद करके जाँचें"],
          ["Uses insulated tools and keeps the work area safe for occupants", "इंसुलेटेड औज़ार इस्तेमाल करें और जगह सुरक्षित रखें"],
        ],
      },
    ],
  },
  {
    code: "ELE/Q3111", title: "Service Technician – Home Appliances", level: 4,
    ssc: "Electronics Sector Skills Council of India",
    summary: "Installs, diagnoses and repairs household electrical appliances at customer premises and service centres.",
    units: [
      {
        code: null, title: "Diagnose and repair home appliances",
        kw: "appliance repair geyser iron mixer washing machine refrigerator motor heating element thermostat customer",
        pcs: [
          ["Records the customer's complaint and observed symptoms", "ग्राहक की शिकायत और दिखी खराबी लिखें"],
          ["Diagnoses a faulty heating element or thermostat with a multimeter", "मल्टीमीटर से हीटिंग एलिमेंट या थर्मोस्टेट की खराबी पहचानें"],
          ["Replaces the faulty part and runs a functional test", "खराब पुर्ज़ा बदलकर उपकरण चलाकर दिखाएँ"],
        ],
      },
      {
        code: null, title: "Work safely and handle the customer", critical: true,
        kw: "safety unplug discharge capacitor customer warranty",
        pcs: [
          ["Unplugs the appliance and discharges capacitors before opening it", "खोलने से पहले प्लग निकालें और कैपेसिटर डिस्चार्ज करें"],
          ["Explains the repair done and care instructions to the customer", "ग्राहक को किया गया काम और देखभाल समझाएँ"],
        ],
      },
    ],
  },
  {
    code: "SGJ/Q1503", title: "O&M Electrical and Instrumentation Technician – Wind Power Plant", level: 4,
    ssc: "Skill Council for Green Jobs",
    summary: "Operates and maintains the electrical and instrumentation systems of wind turbines and plant sub-stations.",
    units: [
      {
        code: null, title: "Maintain electrical and instrumentation systems of wind turbines",
        kw: "wind turbine generator transformer panel instrumentation sensor plc preventive maintenance high voltage",
        pcs: [
          ["Carries out preventive checks on the generator and control panel", "जनरेटर और कंट्रोल पैनल की नियमित जाँच करें"],
          ["Reads sensor and instrument values and records deviations", "सेंसर की रीडिंग लेकर गड़बड़ी दर्ज करें"],
        ],
      },
      {
        code: null, title: "Work safely at height and on HV equipment", critical: true,
        kw: "height harness lockout tagout permit high voltage safety",
        pcs: [
          ["Uses a full-body harness and anchorage when working at height", "ऊँचाई पर काम करते समय हार्नेस बाँधकर दिखाएँ"],
          ["Applies lockout-tagout under a permit-to-work before HV maintenance", "HV काम से पहले परमिट लेकर लॉकआउट-टैगआउट करें"],
        ],
      },
    ],
  },
  {
    code: "MIN/Q3101", title: "Mine Electrician", level: 4,
    ssc: "Skill Council for Mining Sector",
    summary: "Installs, operates and maintains electrical systems, sub-stations and machinery in mines.",
    units: [
      {
        code: "MIN/N3102", title: "Install the electrical systems/sub-stations and equipment",
        kw: "mine substation transformer switchgear cable motor installation underground",
        pcs: [
          ["Installs and terminates armoured cable to switchgear", "आर्मर्ड केबल को स्विचगियर से जोड़ें"],
          ["Connects and tests a three-phase motor with starter", "स्टार्टर के साथ थ्री-फेज़ मोटर जोड़कर चलाएँ"],
        ],
      },
      {
        code: null, title: "Follow mine electrical safety rules", critical: true,
        kw: "safety flameproof earthing isolation permit gas",
        pcs: [
          ["Checks flameproof enclosure integrity before energising", "चालू करने से पहले फ्लेमप्रूफ बॉक्स की जाँच करें"],
          ["Isolates and earths equipment before maintenance", "मरम्मत से पहले उपकरण बंद करके अर्थ करें"],
        ],
      },
    ],
  },
];

const QPS = RAW_QPS.map((qp) => ({
  ...qp,
  units: qp.units.map((u, ui) => {
    const pcs = u.pcs.map(([en, hi], pi) => ({
      id: `${qp.code}#${ui + 1}.${pi + 1}`,
      ref: `${ui + 1}.${pi + 1}`,
      en, hi,
      critical: !!u.critical,
      tokens: [...new Set(tokens(en))],
    }));
    return {
      ...u,
      critical: !!u.critical,
      label: u.code || `Unit ${ui + 1}`,
      pcs,
      tokenSet: new Set(tokens([u.title, u.kw, ...pcs.map((p) => p.en)].join(" "))),
    };
  }),
}));

/* ---------- TF-IDF index over Qualification Packs ---------- */

function termFreq(toks) {
  const m = new Map();
  toks.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
  return m;
}
function weigh(tf, idf) {
  const v = new Map();
  tf.forEach((c, t) => v.set(t, (1 + Math.log(c)) * idf(t)));
  return v;
}
function vnorm(v) {
  let s = 0;
  v.forEach((x) => (s += x * x));
  return Math.sqrt(s);
}

const INDEX = (() => {
  const docs = QPS.map((qp) => ({
    qp,
    tf: termFreq(tokens([qp.title, qp.summary, ...qp.units.map((u) => [u.title, u.kw, ...u.pcs.map((p) => p.en)].join(" "))].join(" "))),
  }));
  const df = new Map();
  docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const idf = (t) => Math.log((docs.length + 1) / ((df.get(t) || 0) + 1)) + 1;
  docs.forEach((d) => {
    d.vec = weigh(d.tf, idf);
    d.norm = vnorm(d.vec);
  });
  return { docs, idf, vocab: new Set(df.keys()) };
})();

function rankQps(terms) {
  const known = terms.filter((t) => INDEX.vocab.has(t));
  if (!known.length) return [];
  const qv = weigh(termFreq(known), INDEX.idf);
  const qn = vnorm(qv);
  const uniq = [...new Set(known)];
  return INDEX.docs
    .map((d) => {
      let dot = 0;
      qv.forEach((w, t) => {
        const x = d.vec.get(t);
        if (x) dot += w * x;
      });
      return {
        qp: d.qp,
        score: dot / (qn * d.norm),
        units: d.qp.units.map((u) => ({ unit: u, terms: uniq.filter((t) => u.tokenSet.has(t)) })),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* ---------- Declaration parsing ---------- */

const NUM_WORDS = {
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10,
  ग्यारह: 11, बारह: 12, तेरह: 13, चौदह: 14, पंद्रह: 15, सोलह: 16, सत्रह: 17, अठारह: 18, उन्नीस: 19, बीस: 20,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

const TASKS = [
  { label: "House wiring", any: ["wiring", "conduit", "casing"] },
  { label: "Switchboards and fittings", any: ["switchboard", "socket", "fan", "fitting"] },
  { label: "DB, MCB and RCCB", any: ["db", "mcb", "rccb", "distribution"] },
  { label: "Earthing", any: ["earthing"] },
  { label: "Circuit testing", any: ["continuity", "insulation", "polarity", "megger"] },
  { label: "Fault finding", any: ["fault", "tripping", "short"] },
  { label: "Appliance repair", any: ["appliance", "geyser", "refrigerator", "washing"] },
  { label: "Motor work", any: ["motor", "rewinding"] },
  { label: "Solar and inverter", any: ["solar", "inverter"] },
];

const TOOLS = [
  { key: "multimeter", label: "Multimeter" }, { key: "tester", label: "Line tester" },
  { key: "megger", label: "Insulation tester" }, { key: "clamp", label: "Clamp meter" },
  { key: "drill", label: "Drill" }, { key: "plier", label: "Pliers" }, { key: "screwdriver", label: "Screwdriver" },
];

const NAME_RE = /(?:मेरा नाम|my name is|mera naam)\s+([\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+){0,2}?)\s*(?:है|hai|,|।|\.|$)/iu;
const YEAR_RE = /([0-9]{1,2}|[\u0900-\u097F]+|[a-z]+)\s*(?:साल|वर्ष|years?|yrs?|saal)(?![a-z])/gi;
const NO_CERT_RE = /(कोई|no)\s*(सर्टिफिकेट|certificate)|(सर्टिफिकेट|प्रमाण\s?पत्र|certificate)[^।.]{0,20}(नहीं|nahi|nahin)/i;

function parseDeclaration(raw) {
  const text = raw || "";
  const terms = tokens(text);
  const set = new Set(terms);

  let years = null;
  for (const m of text.matchAll(YEAR_RE)) {
    const w = m[1].toLowerCase();
    const n = /^\d+$/.test(w) ? Number(w) : NUM_WORDS[w];
    if (n && n < 60) years = Math.max(years || 0, n);
  }

  let setting = null;
  if (/ठेकेदार|contractor|thekedar/i.test(text)) setting = "Works with a contractor";
  else if (/अपना काम|खुद का|self[- ]employed/i.test(text)) setting = "Self-employed";
  else if (/हेल्पर|helper/i.test(text)) setting = "Worked as a helper";

  return {
    name: (text.match(NAME_RE) || [])[1] || null,
    years,
    tasks: TASKS.filter((t) => t.any.some((k) => set.has(k))).map((t) => t.label),
    tools: TOOLS.filter((t) => set.has(t.key)).map((t) => t.label),
    setting,
    certificate: NO_CERT_RE.test(text) ? "No formal certificate" : null,
    terms,
  };
}

const SAMPLE_DECLARATION =
  "मेरा नाम रमेश यादव है। मैं पिछले नौ साल से घरों और नई बिल्डिंग में वायरिंग का काम करता हूँ। नक्शा देखकर कंड्यूट पाइप डालता हूँ, स्विच बोर्ड, पंखे और लाइट की फिटिंग करता हूँ। लोड के हिसाब से तार का साइज़ और एमसीबी चुनता हूँ, डीबी में एमसीबी और आरसीसीबी लगाता हूँ, अर्थिंग भी करता हूँ। लाइन चालू करने से पहले मल्टीमीटर से कंटिन्युटी चेक करता हूँ और टेस्टर से फॉल्ट ढूँढ लेता हूँ। ठेकेदार के साथ काम करता हूँ, मेरे पास कोई सर्टिफिकेट नहीं है।";

/* ---------- Hashing and evidence ledger ---------- */

async function sha256Hex(data) {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

const HASHED_FIELDS = ["seq", "pcId", "fileName", "mime", "size", "fileHash", "capturedAt", "geo", "prevHash"];
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k] ?? null]));

async function verifyChain(records) {
  let prev = GENESIS;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.prevHash !== prev) return { ok: false, at: i, reason: "link to the previous record is broken" };
    const h = await sha256Hex(canonical(pick(r, HASHED_FIELDS)));
    if (h !== r.recordHash) return { ok: false, at: i, reason: "record contents changed after capture" };
    prev = r.recordHash;
  }
  return { ok: true, count: records.length, head: prev };
}

let geoCache = { at: 0, value: undefined };
async function getPosition() {
  if (geoCache.value !== undefined && Date.now() - geoCache.at < 120000) return geoCache.value;
  const value = await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 120000, enableHighAccuracy: false }
    );
  });
  geoCache = { at: Date.now(), value };
  return value;
}

/* ---------- Scoring, checks and agreement ---------- */

const RUBRIC = [
  { v: 0, label: "Not shown" },
  { v: 1, label: "Partly" },
  { v: 2, label: "Competent" },
  { v: 3, label: "Proficient" },
];

function unitResults(qp, scores) {
  return qp.units.map((u) => {
    const scored = u.pcs.map((p) => scores[p.id]).filter((v) => v != null);
    const pct = scored.length ? Math.round((100 * scored.reduce((a, b) => a + b, 0)) / (3 * u.pcs.length)) : 0;
    const complete = scored.length === u.pcs.length;
    const criticalFail = u.critical && scored.some((v) => v < 2);
    return { unit: u, pct, complete, criticalFail, pass: complete && pct >= PASS_PCT && !criticalFail };
  });
}

function scoringChecks(qp, scores, evidenceByPc, declSet) {
  const out = [];
  qp.units.forEach((u) =>
    u.pcs.forEach((p) => {
      const s = scores[p.id];
      if (s == null) return;
      if (u.critical && s < 2)
        out.push({ kind: "bad", pc: p, msg: "Safety-critical criterion scored below Competent. The qualification cannot be awarded until it is re-assessed." });
      if (s >= 2 && !(evidenceByPc[p.id] || []).length)
        out.push({ kind: "warn", pc: p, msg: "Scored Competent or above with no evidence attached." });
      const overlap = p.tokens.filter((t) => declSet.has(t));
      if (s <= 1 && overlap.length >= 2)
        out.push({ kind: "info", pc: p, msg: `Candidate declared related work (${overlap.slice(0, 3).join(", ")}). Consider a second attempt or a probing question.` });
    })
  );
  return out;
}

function fnv(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Simulated moderation panel. Deterministic per criterion and independent of
// the current assessor, so agreement reflects how the assessor actually scored.
function coAssessorScores(pcId) {
  const h = fnv(pcId);
  const ref = h % 4 === 0 ? 3 : h % 9 === 0 ? 1 : 2;
  const b = h % 5 === 0 ? Math.max(0, ref - 1) : h % 7 === 0 ? Math.min(3, ref + 1) : ref;
  return [ref, b];
}

function fleissKappa(ratings, k) {
  const N = ratings.length;
  const n = ratings[0].length;
  const counts = ratings.map((r) => {
    const c = new Array(k).fill(0);
    r.forEach((v) => c[v]++);
    return c;
  });
  const Pbar = counts.reduce((a, c) => a + (c.reduce((s, x) => s + x * x, 0) - n) / (n * (n - 1)), 0) / N;
  const Pe = Array.from({ length: k }, (_, j) => counts.reduce((a, c) => a + c[j], 0) / (N * n)).reduce((a, p) => a + p * p, 0);
  if (Pe >= 1) return null;
  return (Pbar - Pe) / (1 - Pe);
}

function kappaBand(k) {
  if (k < 0) return "poor agreement";
  if (k <= 0.2) return "slight agreement";
  if (k <= 0.4) return "fair agreement";
  if (k <= 0.6) return "moderate agreement";
  if (k <= 0.8) return "substantial agreement";
  return "almost perfect agreement";
}

function stdev(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

function calibration(qp, scores) {
  const rows = qp.units
    .flatMap((u) => u.pcs)
    .filter((p) => scores[p.id] != null)
    .map((p) => {
      const s = [scores[p.id], ...coAssessorScores(p.id)];
      return { pc: p, s, spread: Math.max(...s) - Math.min(...s) };
    });
  const kappa = rows.length >= 2 ? fleissKappa(rows.map((r) => r.s), 4) : null;
  const totals = [0, 1, 2].map((k) => (rows.length ? (100 * rows.reduce((a, r) => a + r.s[k], 0)) / (3 * rows.length) : 0));
  return {
    rows, kappa,
    sd: rows.length ? stdev(totals) : null,
    disagreements: rows.filter((r) => r.spread >= 2).length,
  };
}

/* ---------- Sync ---------- */

const api = {
  async push(records, isOnline) {
    if (API_BASE) {
      const res = await fetch(`${API_BASE}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      if (!res.ok) throw new Error(`Sync failed with status ${res.status}`);
      return res.json();
    }
    await new Promise((r) => setTimeout(r, 700 + records.length * 120));
    if (!isOnline()) throw new Error("offline");
    return { accepted: records.length };
  },
};

/* ---------- Helpers ---------- */

const fmt = (iso) =>
  new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const fmtTime = (iso) => new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-4)}` : "");
const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const countWords = (s) => s.trim().split(/\s+/).filter(Boolean).length;

function makeSessionId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return `RPL-${ymd}-${rnd}`;
}

function downloadJson(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const LANGS = [
  { code: "hi-IN", label: "Hindi" }, { code: "en-IN", label: "English (India)" },
  { code: "mr-IN", label: "Marathi" }, { code: "bn-IN", label: "Bengali" },
  { code: "ta-IN", label: "Tamil" }, { code: "te-IN", label: "Telugu" },
];

const STEPS = [
  { en: "Declaration", hi: "स्व-घोषणा" },
  { en: "Qualification match", hi: "योग्यता मिलान" },
  { en: "Practical assessment", hi: "व्यावहारिक मूल्यांकन" },
  { en: "Review and sign-off", hi: "समीक्षा और हस्ताक्षर" },
  { en: "Competency profile", hi: "कौशल प्रोफ़ाइल" },
];

/* ---------- Speech ---------- */

function useSpeech(lang, onFinal) {
  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);
  const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  const start = useCallback(() => {
    if (!SR) return;
    setError(null);
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let fin = "", tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      if (fin.trim()) onFinalRef.current(fin.trim());
      setInterim(tmp);
    };
    rec.onerror = (e) =>
      setError(
        e.error === "not-allowed"
          ? "Microphone access is blocked. Allow it in the browser's site settings, or type the declaration."
          : e.error === "no-speech"
          ? "No speech was detected. Move closer to the microphone and try again."
          : `Speech recognition stopped (${e.error}).`
      );
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Speech recognition could not start. Reload the page and try again.");
    }
  }, [SR, lang]);

  const stop = useCallback(() => recRef.current && recRef.current.stop(), []);
  useEffect(() => () => recRef.current && recRef.current.abort(), []);

  return { supported: !!SR, listening, interim, error, start, stop };
}

/* =========================================================================
   App
   ========================================================================= */

export default function App() {
  const [sessionId, setSessionId] = useState(makeSessionId);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState(null);

  const [netOnline, setNetOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [forcedOffline, setForcedOffline] = useState(false);
  const online = netOnline && !forcedOffline;
  const onlineRef = useRef(online);
  onlineRef.current = online;

  const [candidate, setCandidate] = useState({ name: "", district: "" });
  const [lang, setLang] = useState("hi-IN");
  const [declaration, setDeclaration] = useState("");
  const [matches, setMatches] = useState(null);
  const [matchRun, setMatchRun] = useState(0);
  const [qpCode, setQpCode] = useState(null);
  const [scores, setScores] = useState({});
  const [notes, setNotes] = useState({});
  const [ledger, setLedger] = useState([]);
  const [signoff, setSignoff] = useState({ name: "", id: "", agreed: false });
  const [signing, setSigning] = useState(false);
  const [profile, setProfile] = useState(null);

  const [outbox, setOutbox] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const ledgerRef = useRef([]);
  const appendQueue = useRef(Promise.resolve());
  const inFlight = useRef(false);

  const locked = !!profile;
  const qp = useMemo(() => QPS.find((q) => q.code === qpCode) || null, [qpCode]);
  const parsed = useMemo(() => parseDeclaration(declaration), [declaration]);
  const declSet = useMemo(() => new Set(parsed.terms), [parsed]);
  const evidenceByPc = useMemo(() => {
    const m = {};
    ledger.forEach((r) => {
      if (!m[r.pcId]) m[r.pcId] = [];
      m[r.pcId].push(r);
    });
    return m;
  }, [ledger]);
  const syncedIds = useMemo(() => new Set(outbox.filter((r) => r.syncedAt).map((r) => r.id)), [outbox]);
  const pending = outbox.filter((r) => !r.syncedAt).length;

  const allPcs = qp ? qp.units.flatMap((u) => u.pcs) : [];
  const scoredCount = allPcs.filter((p) => scores[p.id] != null).length;
  const allScored = !!qp && scoredCount === allPcs.length;

  const reach = profile ? 4 : qp ? 3 : matches ? 1 : 0;
  const done = [!!matches, !!qp, allScored, !!profile, false];

  useEffect(() => {
    const up = () => setNetOnline(true);
    const down = () => setNetOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Background sync of the outbox whenever the device is online.
  useEffect(() => {
    const batch = outbox.filter((r) => !r.syncedAt);
    if (!online || inFlight.current || !batch.length) return;
    inFlight.current = true;
    setSyncing(true);
    api
      .push(batch.map(({ id, kind, payload }) => ({ id, kind, payload })), () => onlineRef.current)
      .then(() => {
        const ids = new Set(batch.map((r) => r.id));
        const t = new Date().toISOString();
        setOutbox((o) => o.map((r) => (ids.has(r.id) ? { ...r, syncedAt: t } : r)));
        setLastSync(t);
      })
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
        setSyncing(false);
      });
  }, [online, outbox]);

  const enqueue = (kind, id, payload) =>
    setOutbox((o) => [...o, { id, kind, payload, createdAt: new Date().toISOString(), syncedAt: null }]);

  function runMatch() {
    const res = rankQps(parsed.terms);
    setMatches(res);
    setMatchRun((n) => n + 1);
    if (!candidate.name.trim() && parsed.name) setCandidate((c) => ({ ...c, name: parsed.name }));
    setStep(1);
  }

  function startAssessment(code) {
    setQpCode(code);
    setStep(2);
  }

  function addEvidence(pcId, file) {
    if (file.size > 50 * 1048576) {
      setNotice({ kind: "warn", text: `${file.name} is larger than 50 MB. Record a shorter clip.` });
      return;
    }
    appendQueue.current = appendQueue.current
      .then(async () => {
        const fileHash = await sha256Hex(await file.arrayBuffer());
        const geo = await getPosition();
        const prev = ledgerRef.current[ledgerRef.current.length - 1];
        const body = {
          seq: ledgerRef.current.length + 1,
          pcId,
          fileName: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          fileHash,
          capturedAt: new Date().toISOString(),
          geo,
          prevHash: prev ? prev.recordHash : GENESIS,
        };
        const recordHash = await sha256Hex(canonical(body));
        const rec = {
          ...body,
          id: `EV-${String(body.seq).padStart(4, "0")}`,
          recordHash,
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        };
        ledgerRef.current = [...ledgerRef.current, rec];
        setLedger(ledgerRef.current);
        const { preview, ...payload } = rec;
        enqueue("evidence", rec.id, payload);
      })
      .catch(() => setNotice({ kind: "bad", text: `Could not record ${file.name}. Check that the page is served over HTTPS.` }));
  }

  async function signAndIssue() {
    setSigning(true);
    try {
      const chain = await verifyChain(ledgerRef.current);
      if (!chain.ok) {
        setNotice({ kind: "bad", text: `Evidence ledger failed verification at record ${chain.at + 1}. Profile not issued.` });
        return;
      }
      const results = unitResults(qp, scores);
      const pass = results.every((r) => r.pass);
      const body = {
        profileId: `KP-${sessionId.slice(4)}`,
        sessionId,
        candidate: { name: candidate.name.trim(), district: candidate.district.trim() },
        declaration: { text: declaration, language: lang, years: parsed.years, tasks: parsed.tasks, tools: parsed.tools },
        qp: { code: qp.code, title: qp.title, level: qp.level, ssc: qp.ssc },
        units: results.map((r) => ({
          code: r.unit.code, label: r.unit.label, title: r.unit.title,
          scorePct: r.pct, result: r.pass ? "Pass" : "Not yet competent",
        })),
        criteria: allPcs.map((p) => ({
          ref: p.ref, criterion: p.en, score: scores[p.id],
          note: notes[p.id] || "", evidence: (evidenceByPc[p.id] || []).map((e) => e.id),
        })),
        result: pass ? "Competent" : "Not yet competent",
        evidence: {
          count: ledgerRef.current.length,
          ledgerHead: chain.head,
          records: ledgerRef.current.map(({ preview, ...r }) => r),
        },
        assessor: { name: signoff.name.trim(), id: signoff.id.trim() },
        signedAt: new Date().toISOString(),
      };
      const hash = await sha256Hex(canonical(body));
      const prof = { ...body, hash };
      setProfile(prof);
      enqueue("profile", prof.profileId, prof);
      setStep(4);
    } finally {
      setSigning(false);
    }
  }

  function resetSession() {
    ledgerRef.current.forEach((r) => r.preview && URL.revokeObjectURL(r.preview));
    ledgerRef.current = [];
    setLedger([]);
    setCandidate({ name: "", district: "" });
    setDeclaration("");
    setMatches(null);
    setQpCode(null);
    setScores({});
    setNotes({});
    setSignoff({ name: "", id: "", agreed: false });
    setProfile(null);
    setNotice(null);
    setSessionId(makeSessionId());
    setStep(0);
  }

  return (
    <div className="kp">
      <style>{CSS}</style>
      <TopBar
        sessionId={sessionId} online={online} forcedOffline={forcedOffline}
        setForcedOffline={setForcedOffline} pending={pending} syncing={syncing} lastSync={lastSync}
      />
      <div className="kp-shell">
        <Rail step={step} reach={reach} done={done} onGo={setStep} />
        <main className="stack" style={{ minWidth: 0 }}>
          {notice && <Notice kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Notice>}

          {step === 0 && (
            <DeclarationStep
              candidate={candidate} setCandidate={setCandidate} lang={lang} setLang={setLang}
              declaration={declaration} setDeclaration={setDeclaration} parsed={parsed}
              onMatch={runMatch} locked={locked}
            />
          )}

          {step === 1 && matches && (
            <MatchStep key={matchRun} matches={matches} parsed={parsed} current={qpCode} onStart={startAssessment} locked={locked} />
          )}

          {step === 2 && qp && (
            <>
              <AssessmentStep
                qp={qp} candidate={candidate} scores={scores}
                setScore={(id, v) => !locked && setScores((s) => ({ ...s, [id]: v }))}
                notes={notes} setNote={(id, v) => !locked && setNotes((n) => ({ ...n, [id]: v }))}
                evidenceByPc={evidenceByPc} onEvidence={addEvidence} syncedIds={syncedIds}
                locked={locked} scoredCount={scoredCount} total={allPcs.length} onNext={() => setStep(3)}
              />
              <LedgerPanel ledger={ledger} syncedIds={syncedIds} />
            </>
          )}

          {step === 3 && qp && (
            <ReviewStep
              qp={qp} scores={scores} evidenceByPc={evidenceByPc} declSet={declSet}
              allScored={allScored} scoredCount={scoredCount} total={allPcs.length}
              signoff={signoff} setSignoff={setSignoff} onSign={signAndIssue}
              signing={signing} profile={profile}
            />
          )}

          {step === 4 && profile && (
            <ProfileStep profile={profile} synced={syncedIds.has(profile.profileId)} onReset={resetSession} />
          )}
        </main>
      </div>
    </div>
  );
}

/* =========================================================================
   Components
   ========================================================================= */

function Seal({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="#23477A" strokeWidth="2" />
      <circle cx="16" cy="16" r="10.5" fill="#23477A" />
      <path d="M11.5 16.4l3.1 3.1 6-6.3" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Notice({ kind = "info", children, onClose }) {
  const Icon = kind === "ok" ? ShieldCheck : kind === "info" ? Info : AlertTriangle;
  return (
    <div className={`notice ${kind}`} role={kind === "bad" ? "alert" : undefined}>
      <Icon size={16} />
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button className="btn btn-link" onClick={onClose} aria-label="Dismiss">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

const Missing = () => <span className="muted">Not mentioned</span>;

function TopBar({ sessionId, online, forcedOffline, setForcedOffline, pending, syncing, lastSync }) {
  const recs = (n) => `${n} ${n === 1 ? "record" : "records"}`;
  let status;
  if (syncing) status = `Syncing ${recs(pending)}`;
  else if (pending && !online) status = `${recs(pending)} saved on this device`;
  else if (pending) status = `${recs(pending)} waiting to sync`;
  else status = lastSync ? `All records synced at ${fmtTime(lastSync)}` : "Nothing to sync yet";

  return (
    <header className="kp-top">
      <div className="kp-top-in">
        <div className="brand">
          <Seal size={28} />
          <div>
            <b>KaushalPramaan</b> <span className="hi muted">कौशल प्रमाण</span>
            <div className="small muted">RPL assessment console</div>
          </div>
        </div>
        <div className="small muted">
          Session <span className="mono">{sessionId}</span>
        </div>
        <div className="net small" aria-live="polite">
          {syncing ? <RefreshCw size={15} className="spin" /> : online ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{online ? "Online" : "Offline"}</span>
          <span className="muted">{status}</span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={forcedOffline} onChange={(e) => setForcedOffline(e.target.checked)} />
          <span className="switch-track" />
          Work offline
        </label>
      </div>
    </header>
  );
}

function Rail({ step, reach, done, onGo }) {
  return (
    <ol className="kp-rail" aria-label="Assessment steps">
      {STEPS.map((s, i) => {
        const cls = [i === step && "current", done[i] && "done", i > reach && "locked"].filter(Boolean).join(" ");
        return (
          <li key={s.en} className={`rail-item ${cls}`}>
            <button className="rail-btn" disabled={i > reach} onClick={() => onGo(i)} aria-current={i === step ? "step" : undefined}>
              <span className="rail-num">{done[i] && i !== step ? <Check size={14} /> : i + 1}</span>
              <span className="rail-en">{s.en}</span>
              <span className="rail-hi hi">{s.hi}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Step 1: Declaration ---------- */

function DeclarationStep({ candidate, setCandidate, lang, setLang, declaration, setDeclaration, parsed, onMatch, locked }) {
  const speech = useSpeech(lang, (text) => setDeclaration((d) => (d.trim() ? d.trim() + " " : "") + text));
  const otherLang = !["hi-IN", "en-IN"].includes(lang);

  return (
    <div className="stack">
      <div>
        <h1>Candidate declaration</h1>
        <p className="muted lede">The candidate describes their work in their own words. Record it or type it in Hindi or English.</p>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-h"><h2>Candidate</h2></div>
          <div className="panel-pad stack">
            <div className="grid-3">
              <div>
                <label className="label" htmlFor="c-name">Full name</label>
                <input id="c-name" className="field hi" value={candidate.name} disabled={locked}
                  onChange={(e) => setCandidate((c) => ({ ...c, name: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="c-district">District</label>
                <input id="c-district" className="field" value={candidate.district} disabled={locked}
                  onChange={(e) => setCandidate((c) => ({ ...c, district: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="c-lang">Language</label>
                <select id="c-lang" className="field" value={lang} onChange={(e) => setLang(e.target.value)} disabled={locked || speech.listening}>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
            </div>
            {otherLang && (
              <p className="small muted">Speech will be transcribed in this language. Qualification matching reads Hindi and English, so translate the transcript before matching.</p>
            )}

            <div className="mic">
              <button
                className={`mic-btn ${speech.listening ? "on" : ""}`}
                onClick={speech.listening ? speech.stop : speech.start}
                disabled={!speech.supported || locked}
                aria-label={speech.listening ? "Stop recording" : "Start recording"}
              >
                {speech.listening ? <Square size={18} /> : <Mic size={22} />}
              </button>
              <div style={{ minWidth: 0 }}>
                <b>{speech.listening ? <span className="row"><span className="rec-dot" />Listening</span> : "Record declaration"}</b>
                <p className="small muted hi">
                  {!speech.supported
                    ? "Voice input needs Chrome or Edge. Type the declaration below instead."
                    : speech.listening
                    ? speech.interim || "Speak naturally. The transcript appears below."
                    : "Tap the microphone and ask the candidate to describe their work."}
                </p>
              </div>
            </div>
            {speech.error && <Notice kind="warn">{speech.error}</Notice>}

            <div>
              <div className="row between" style={{ marginBottom: 5 }}>
                <label className="label" htmlFor="c-decl" style={{ margin: 0 }}>Transcript</label>
                <span className="row">
                  <button className="btn btn-link small" onClick={() => setDeclaration(SAMPLE_DECLARATION)} disabled={locked}>Load sample</button>
                  {declaration && <button className="btn btn-link small" onClick={() => setDeclaration("")} disabled={locked}>Clear</button>}
                </span>
              </div>
              <textarea id="c-decl" className="field hi" value={declaration} disabled={locked}
                onChange={(e) => setDeclaration(e.target.value)}
                placeholder="उदाहरण: मैं आठ साल से घरों में वायरिंग का काम करता हूँ…" />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <h2>Extracted details</h2>
            <span className="small muted">Updates as you type</span>
          </div>
          <div className="panel-pad stack">
            <dl className="kv">
              <dt>Name</dt><dd className="hi">{parsed.name || <Missing />}</dd>
              <dt>Experience</dt><dd>{parsed.years ? `${parsed.years} years` : <Missing />}</dd>
              <dt>Work done</dt>
              <dd>{parsed.tasks.length ? parsed.tasks.map((t) => <span key={t} className="chip">{t}</span>) : <Missing />}</dd>
              <dt>Tools</dt>
              <dd>{parsed.tools.length ? parsed.tools.map((t) => <span key={t} className="chip">{t}</span>) : <Missing />}</dd>
              <dt>Work setting</dt><dd>{parsed.setting || <Missing />}</dd>
              <dt>Certificate</dt><dd>{parsed.certificate || <Missing />}</dd>
            </dl>
            <Notice kind="info">Parsed on this device. Confirm each field with the candidate before matching.</Notice>
          </div>
        </section>
      </div>

      <div className="row between">
        <span className="small muted">{declaration.trim() ? `${countWords(declaration)} words` : "No declaration yet"}</span>
        <button className="btn btn-primary" onClick={onMatch} disabled={!declaration.trim()}>Find matching qualifications</button>
      </div>
    </div>
  );
}

/* ---------- Step 2: Match ---------- */

function MatchStep({ matches, parsed, current, onStart, locked }) {
  const [pickCode, setPickCode] = useState(
    current && matches.some((m) => m.qp.code === current) ? current : matches[0] ? matches[0].qp.code : null
  );
  const read = [...new Set(parsed.terms.filter((t) => INDEX.vocab.has(t)))];

  return (
    <div className="stack">
      <div>
        <h1>Qualification match</h1>
        <p className="muted lede">Closest NSQF Qualification Packs for this declaration. Confirm one with the candidate before assessing.</p>
      </div>

      {matches.length === 0 ? (
        <Notice kind="warn">No trade terms in the declaration matched a Qualification Pack. Ask the candidate about specific tasks, tools and sites, then match again.</Notice>
      ) : (
        <div className="stack" role="radiogroup" aria-label="Matched qualification packs">
          {matches.map((m, i) => {
            const sel = pickCode === m.qp.code;
            return (
              <label key={m.qp.code} className={`match panel ${sel ? "sel" : ""}`}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div className="row" style={{ alignItems: "flex-start", gap: 12, flexWrap: "nowrap" }}>
                    <input type="radio" name="qp" checked={sel} onChange={() => setPickCode(m.qp.code)} disabled={locked} style={{ marginTop: 5 }} />
                    <div>
                      <h2>{m.qp.title}</h2>
                      <p className="small muted"><span className="mono">{m.qp.code}</span>, NSQF level {m.qp.level}, {m.qp.ssc}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }} title="Cosine similarity between TF-IDF vectors of the declaration and the Qualification Pack">
                    <div className="small muted">{i === 0 ? "Closest match" : `Alternative ${i}`}</div>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <span className="bar"><i style={{ width: `${Math.min(100, Math.round(m.score * 100))}%` }} /></span>
                      <span className="mono">{m.score.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="match-body">
                  <p>{m.qp.summary}</p>
                  {m.units.map((u) => (
                    <div key={u.unit.label} className="unit-line">
                      <p className="small"><span className={u.unit.code ? "mono" : ""} style={{ fontWeight: 600 }}>{u.unit.label}</span>{" "}{u.unit.title}</p>
                      <div style={{ marginTop: 4 }}>
                        {u.terms.length
                          ? u.terms.slice(0, 8).map((t) => <span key={t} className="chip chip-term">{t}</span>)
                          : <span className="small muted">No declared terms in this unit</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </label>
            );
          })}
        </div>
      )}

      <section className="panel panel-pad">
        <h3>Terms read from the declaration</h3>
        <div style={{ marginTop: 8 }}>
          {read.length ? read.map((t) => <span key={t} className="chip">{t}</span>) : <span className="muted">None</span>}
        </div>
      </section>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" disabled={!pickCode || locked} onClick={() => onStart(pickCode)}>
          Start assessment for {pickCode || "selected pack"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Assessment ---------- */

function AssessmentStep({ qp, candidate, scores, setScore, notes, setNote, evidenceByPc, onEvidence, syncedIds, locked, scoredCount, total, onNext }) {
  return (
    <div className="stack">
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <h1>Practical assessment</h1>
          <p className="muted lede">
            <span className="mono">{qp.code}</span> {qp.title}, NSQF level {qp.level}
            {candidate.name && <> for <span className="hi">{candidate.name}</span></>}
          </p>
        </div>
        <span className="small muted">{scoredCount} of {total} criteria scored</span>
      </div>

      {locked && <Notice kind="info">The competency profile has been issued. Scores and evidence are locked.</Notice>}

      <section className="panel">
        <div className="panel-h">
          <h2>Performance criteria</h2>
          <span className="small muted">Score each criterion after observing the task</span>
        </div>
        {qp.units.map((u) => (
          <div key={u.label}>
            <div className="unit-h">
              <span className={u.code ? "mono" : ""} style={{ fontWeight: 600 }}>{u.label}</span>
              <span>{u.title}</span>
              {u.critical && <span className="tag tag-crit">Safety critical</span>}
            </div>
            {u.pcs.map((p) => (
              <PcRow
                key={p.id} pc={p} score={scores[p.id]} onScore={(v) => setScore(p.id, v)}
                note={notes[p.id]} onNote={(v) => setNote(p.id, v)}
                evidence={evidenceByPc[p.id] || []} onEvidence={(f) => onEvidence(p.id, f)}
                syncedIds={syncedIds} locked={locked}
              />
            ))}
          </div>
        ))}
      </section>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={onNext}>Continue to review</button>
      </div>
    </div>
  );
}

function PcRow({ pc, score, onScore, note, onNote, evidence, onEvidence, syncedIds, locked }) {
  const fileRef = useRef(null);
  return (
    <div className="pc">
      <span className="pc-ref">{pc.ref}</span>
      <div>
        <p>{pc.en}</p>
        <p className="hi muted small" style={{ marginTop: 2 }}>{pc.hi}</p>
      </div>
      <div className="pc-side">
        <div className="scale" role="group" aria-label={`Score for criterion ${pc.ref}`}>
          {RUBRIC.map((r) => (
            <button key={r.v} type="button" aria-pressed={score === r.v} className={r.v < 2 ? "low" : ""}
              onClick={() => onScore(score === r.v ? null : r.v)} disabled={locked}>
              <b>{r.v}</b>{r.label}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" capture="environment" multiple hidden
          onChange={(e) => {
            [...e.target.files].forEach(onEvidence);
            e.target.value = "";
          }} />
        <button className="btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={locked}>
          <Paperclip size={15} />Add evidence
        </button>
        {evidence.map((r) => <EvidenceChip key={r.id} rec={r} synced={syncedIds.has(r.id)} />)}
        <input className="field note" placeholder="Assessor note (optional)" value={note || ""}
          onChange={(e) => onNote(e.target.value)} disabled={locked} aria-label={`Note for criterion ${pc.ref}`} />
      </div>
    </div>
  );
}

function EvidenceChip({ rec, synced }) {
  return (
    <span className="ev" title={`${rec.fileName}\nSHA-256 ${rec.fileHash}`}>
      {rec.preview ? <img src={rec.preview} alt="" /> : <span className="ev-ph"><Film size={14} /></span>}
      <span>
        <span className="mono">{rec.id}</span>
        <br />
        <span className="muted">{synced ? "Synced" : "On device"}</span>
      </span>
    </span>
  );
}

function LedgerPanel({ ledger, syncedIds }) {
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setCheck(null), [ledger.length]);

  async function run(tamper) {
    setBusy(true);
    let recs = ledger;
    let tamperedSeq = null;
    if (tamper) {
      const i = Math.floor(ledger.length / 2);
      tamperedSeq = ledger[i].seq;
      recs = ledger.map((r, j) => (j === i ? { ...r, capturedAt: new Date(Date.parse(r.capturedAt) - 3600e3).toISOString() } : r));
    }
    const res = await verifyChain(recs);
    setCheck({ ...res, tamper, tamperedSeq, failedSeq: res.ok ? null : recs[res.at].seq });
    setBusy(false);
  }

  return (
    <section className="panel">
      <div className="panel-h">
        <div>
          <h2>Evidence ledger</h2>
          <p className="small muted">Each record stores the file's SHA-256, capture time, location and the hash of the record before it.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => run(false)} disabled={!ledger.length || busy}><ShieldCheck size={15} />Verify chain</button>
          <button className="btn" onClick={() => run(true)} disabled={!ledger.length || busy}><ShieldAlert size={15} />Run tamper test</button>
        </div>
      </div>

      {check && (
        <div className="panel-pad" style={{ paddingBottom: 0 }}>
          {check.ok ? (
            <Notice kind="ok">Chain intact. {check.count} {check.count === 1 ? "record" : "records"} verified, head <span className="mono">{short(check.head)}</span>.</Notice>
          ) : (
            <Notice kind={check.tamper ? "warn" : "bad"}>
              {check.tamper && <>Tamper test: the capture time of record {check.tamperedSeq} was moved back one hour in a copy of the ledger. </>}
              Verification failed at record {check.failedSeq}: {check.reason}.
            </Notice>
          )}
        </div>
      )}

      {ledger.length === 0 ? (
        <div className="panel-pad muted">No evidence yet. Use Add evidence on a criterion to attach a photo or video.</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Criterion</th><th>File</th><th>Captured</th><th>Location</th><th>Record hash</th><th>Status</th></tr>
            </thead>
            <tbody>
              {ledger.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.seq}</td>
                  <td>{r.pcId.split("#")[1]}</td>
                  <td className="clip" title={r.fileName}>{r.fileName}<div className="small muted">{fmtBytes(r.size)}</div></td>
                  <td>{fmt(r.capturedAt)}</td>
                  <td>{r.geo ? <span className="mono">{r.geo.lat}, {r.geo.lon}</span> : <span className="muted">Not available</span>}</td>
                  <td className="mono" title={r.recordHash}>{short(r.recordHash)}</td>
                  <td>{syncedIds.has(r.id) ? <span className="tag tag-ok">Synced</span> : <span className="tag">On device</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- Step 4: Review ---------- */

function ReviewStep({ qp, scores, evidenceByPc, declSet, allScored, scoredCount, total, signoff, setSignoff, onSign, signing, profile }) {
  const results = useMemo(() => unitResults(qp, scores), [qp, scores]);
  const checks = useMemo(() => scoringChecks(qp, scores, evidenceByPc, declSet), [qp, scores, evidenceByPc, declSet]);
  const calib = useMemo(() => calibration(qp, scores), [qp, scores]);
  const overall = allScored ? (results.every((r) => r.pass) ? "Competent" : "Not yet competent") : "Incomplete";
  const locked = !!profile;
  const canSign = allScored && signoff.agreed && signoff.name.trim() && signoff.id.trim() && !signing && !locked;

  return (
    <div className="stack">
      <div>
        <h1>Review and sign-off</h1>
        <p className="muted lede"><span className="mono">{qp.code}</span> {qp.title}. A unit passes at {PASS_PCT}% with every safety-critical criterion at Competent or above.</p>
      </div>

      <section className="panel">
        <div className="panel-h"><h2>Unit results</h2><span className="small muted">Overall: {overall}</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Unit</th><th>Title</th><th>Score</th><th>Result</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.unit.label}>
                  <td className={r.unit.code ? "mono" : ""}>{r.unit.label}</td>
                  <td>{r.unit.title}</td>
                  <td>{r.complete ? `${r.pct}%` : "—"}</td>
                  <td>
                    {!r.complete ? <span className="tag">Incomplete</span>
                      : r.pass ? <span className="tag tag-ok">Pass</span>
                      : <span className="tag tag-warn">{r.criticalFail ? "Safety criterion not met" : "Below threshold"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h"><h2>Scoring checks</h2><span className="small muted">Advisory. The assessor's score stands.</span></div>
        <div className="panel-pad stack-sm">
          {scoredCount === 0 ? (
            <p className="muted">Score criteria on the assessment step to see checks.</p>
          ) : checks.length === 0 ? (
            <Notice kind="ok">No issues found in the scored criteria.</Notice>
          ) : (
            checks.map((c, i) => (
              <Notice key={i} kind={c.kind}><b>{c.pc.ref}</b> {c.msg}</Notice>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <div>
            <h2>Inter-assessor agreement</h2>
            <p className="small muted">Your scores compared with two co-assessors on the same criteria.</p>
          </div>
        </div>
        <div className="panel-pad stack">
          <div className="grid-3">
            <div className="stat">
              <span className="small muted">Fleiss' kappa</span>
              <b>{calib.kappa == null ? "—" : calib.kappa.toFixed(2)}</b>
              <span className="small muted">
                {calib.kappa == null
                  ? calib.rows.length < 2 ? "Score at least two criteria" : "Undefined: all ratings in one category"
                  : `${kappaBand(calib.kappa)}, target 0.75`}
              </span>
            </div>
            <div className="stat">
              <span className="small muted">Score spread</span>
              <b>{calib.sd == null ? "—" : `${calib.sd.toFixed(1)} pts`}</b>
              <span className="small muted">Std-dev of total score across assessors</span>
            </div>
            <div className="stat">
              <span className="small muted">Large disagreements</span>
              <b>{calib.rows.length ? calib.disagreements : "—"}</b>
              <span className="small muted">Criteria where scores differ by 2 or more</span>
            </div>
          </div>
          {calib.rows.length > 0 && (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Criterion</th><th>You</th><th>Co-assessor A</th><th>Co-assessor B</th><th>Spread</th></tr></thead>
                <tbody>
                  {calib.rows.map((r) => (
                    <tr key={r.pc.id} className={r.spread >= 2 ? "flag" : ""}>
                      <td><b>{r.pc.ref}</b> <span className="muted">{r.pc.en}</span></td>
                      <td>{r.s[0]}</td><td>{r.s[1]}</td><td>{r.s[2]}</td><td>{r.spread}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted">Co-assessor scores are simulated in this prototype so the agreement metric can be demonstrated. In deployment they come from the moderation panel scoring the same evidence.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h"><h2>Assessor sign-off</h2></div>
        <div className="panel-pad stack">
          {locked ? (
            <Notice kind="ok">Signed by {profile.assessor.name} ({profile.assessor.id}) on {fmt(profile.signedAt)}.</Notice>
          ) : (
            <>
              <div className="grid-3">
                <div>
                  <label className="label" htmlFor="a-name">Assessor name</label>
                  <input id="a-name" className="field" value={signoff.name} onChange={(e) => setSignoff((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label" htmlFor="a-id">Assessor ID</label>
                  <input id="a-id" className="field" value={signoff.id} onChange={(e) => setSignoff((s) => ({ ...s, id: e.target.value }))} />
                </div>
              </div>
              <label className="row" style={{ alignItems: "flex-start", gap: 10, flexWrap: "nowrap" }}>
                <input type="checkbox" checked={signoff.agreed} onChange={(e) => setSignoff((s) => ({ ...s, agreed: e.target.checked }))} style={{ marginTop: 4 }} />
                <span>I observed the candidate perform the tasks above. The scores are my own judgement and the scoring checks were advisory.</span>
              </label>
              {!allScored && <Notice kind="warn">Score all {total} criteria before signing. {total - scoredCount} remaining.</Notice>}
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-primary" disabled={!canSign} onClick={onSign}>
                  {signing ? "Signing…" : "Sign and issue profile"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------- Step 5: Profile ---------- */

function ProfileStep({ profile, synced, onReset }) {
  const pass = profile.result === "Competent";
  return (
    <div className="stack">
      <div className="row between no-print">
        <div>
          <h1>Competency profile</h1>
          <p className="muted lede">{synced ? "Synced to the server." : "Saved on this device. It will sync when the network is back."}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => downloadJson(profile, `${profile.profileId}.json`)}><FileDown size={15} />Download JSON</button>
          <button className="btn" onClick={() => window.print()}><Printer size={15} />Print</button>
          <button className="btn" onClick={onReset}>Start new session</button>
        </div>
      </div>

      <article className="doc">
        <div className="doc-seal"><Seal size={56} /></div>
        <p className="small muted">Recognition of Prior Learning</p>
        <h1 style={{ fontSize: 26, marginTop: 2 }}>Competency profile</h1>
        <p className="hi muted">कौशल प्रोफ़ाइल</p>

        <dl className="kv kv-wide" style={{ marginTop: 24 }}>
          <dt>Candidate</dt><dd className="hi"><b>{profile.candidate.name || "—"}</b></dd>
          <dt>District</dt><dd>{profile.candidate.district || "—"}</dd>
          <dt>Declared experience</dt><dd>{profile.declaration.years ? `${profile.declaration.years} years` : "—"}</dd>
          <dt>Qualification</dt><dd>{profile.qp.title} (<span className="mono">{profile.qp.code}</span>)</dd>
          <dt>NSQF level</dt><dd>{profile.qp.level}</dd>
          <dt>Sector skill council</dt><dd>{profile.qp.ssc}</dd>
          <dt>Assessed on</dt><dd>{fmt(profile.signedAt)}</dd>
          <dt>Assessor</dt><dd>{profile.assessor.name} ({profile.assessor.id})</dd>
        </dl>

        <table className="tbl" style={{ marginTop: 24 }}>
          <thead><tr><th>Unit</th><th>Title</th><th>Score</th><th>Result</th></tr></thead>
          <tbody>
            {profile.units.map((u) => (
              <tr key={u.label}>
                <td className={u.code ? "mono" : ""}>{u.label}</td>
                <td>{u.title}</td>
                <td>{u.scorePct}%</td>
                <td>{u.result}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 20 }}>
          <span className={`result ${pass ? "pass" : "fail"}`}>{profile.result}</span>
        </div>

        <dl className="kv kv-wide small" style={{ marginTop: 24 }}>
          <dt>Profile ID</dt><dd className="mono">{profile.profileId}</dd>
          <dt>Evidence</dt><dd>{profile.evidence.count} records, ledger head <span className="mono hash">{profile.evidence.ledgerHead}</span></dd>
          <dt>Profile hash</dt><dd className="mono hash">{profile.hash}</dd>
        </dl>

        <p className="small muted doc-foot">
          Prototype record produced by KaushalPramaan for demonstration. It is not a certificate issued by NCVET or a Sector Skill Council.
        </p>
      </article>
    </div>
  );
}

/* =========================================================================
   Styles
   ========================================================================= */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Devanagari:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
html,body{margin:0}
.kp{--ink:#18212B;--ink-2:#36414D;--muted:#5D6873;--line:#D6DCE2;--line-2:#E6EAEE;--ground:#F1F3F5;--paper:#FFFFFF;--blue:#23477A;--blue-h:#1B3961;--blue-soft:#E9EFF7;--ok:#2B7A4B;--ok-soft:#E4F1E9;--warn:#8F5E00;--warn-soft:#FAF0DB;--bad:#A8352A;--bad-soft:#F7E5E2;
font-family:"IBM Plex Sans","IBM Plex Sans Devanagari",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--ground);min-height:100vh;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.kp *{box-sizing:border-box}
.kp h1{font-size:22px;font-weight:600;letter-spacing:-.01em;margin:0}
.kp h2{font-size:16px;font-weight:600;margin:0}
.kp h3{font-size:14px;font-weight:600;margin:0}
.kp p{margin:0}
.kp .lede{margin-top:4px;max-width:72ch}
.kp .hi{font-family:"IBM Plex Sans Devanagari","IBM Plex Sans",sans-serif}
.kp .mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:12.5px}
.kp .muted{color:var(--muted)}
.kp .small{font-size:12.5px}
.kp .hash{word-break:break-all}
.kp .spin{animation:kp-spin 1s linear infinite}
@keyframes kp-spin{to{transform:rotate(360deg)}}

.kp-top{background:var(--paper);border-bottom:1px solid var(--line)}
.kp-top-in{max-width:1200px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;margin-right:auto}
.brand b{font-size:16px;font-weight:600}
.net{display:inline-flex;align-items:center;gap:6px}

.kp-shell{max-width:1200px;margin:0 auto;padding:24px 20px 64px;display:grid;grid-template-columns:210px minmax(0,1fr);gap:28px;align-items:start}
.kp-rail{position:sticky;top:16px;list-style:none;margin:0;padding:0}
.rail-item{position:relative;padding:0 0 22px 38px}
.rail-item:not(:last-child)::before{content:"";position:absolute;left:13px;top:30px;bottom:4px;width:2px;background:var(--line)}
.rail-item.done:not(:last-child)::before{background:var(--blue)}
.rail-btn{all:unset;cursor:pointer;display:block;border-radius:4px}
.rail-btn:disabled{cursor:not-allowed}
.rail-btn:focus-visible{outline:2px solid var(--blue);outline-offset:3px}
.rail-num{position:absolute;left:0;top:0;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:600;border:2px solid var(--line);background:var(--paper);color:var(--muted)}
.rail-item.done .rail-num{background:var(--blue);border-color:var(--blue);color:#fff}
.rail-item.current .rail-num{border-color:var(--blue);color:var(--blue);background:var(--paper)}
.rail-en{display:block;font-weight:500;padding-top:3px}
.rail-hi{display:block;font-size:12.5px;color:var(--muted)}
.rail-item.current .rail-en{color:var(--blue);font-weight:600}
.rail-item.locked .rail-en{color:var(--muted)}

.panel{background:var(--paper);border:1px solid var(--line);border-radius:6px}
.panel-pad{padding:18px 20px}
.panel-h{padding:14px 20px;border-bottom:1px solid var(--line-2);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.stack>*+*{margin-top:16px}
.stack-sm>*+*{margin-top:8px}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.between{justify-content:space-between}
.grid-2{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start}
.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 14px;border-radius:5px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:inherit;font-weight:500;cursor:pointer;white-space:nowrap}
.btn:hover:not(:disabled){border-color:#A9B4BF;background:#FAFBFC}
.btn-primary{background:var(--blue);border-color:var(--blue);color:#fff}
.btn-primary:hover:not(:disabled){background:var(--blue-h);border-color:var(--blue-h)}
.btn-link{border:0;background:none;padding:0;height:auto;color:var(--blue)}
.btn-link:hover:not(:disabled){background:none;text-decoration:underline}
.btn:disabled{opacity:.45;cursor:not-allowed}
.kp :focus-visible{outline:2px solid var(--blue);outline-offset:2px}

.field{width:100%;border:1px solid var(--line);border-radius:5px;padding:7px 10px;font:inherit;color:inherit;background:#fff}
.field:disabled{background:var(--ground)}
textarea.field{resize:vertical;min-height:160px;line-height:1.7}
.label{display:block;font-size:12.5px;font-weight:500;color:var(--ink-2);margin-bottom:5px}
.kv{display:grid;grid-template-columns:110px 1fr;gap:8px 12px;margin:0}
.kv-wide{grid-template-columns:170px 1fr}
.kv dt{color:var(--muted)}
.kv dd{margin:0}

.chip{display:inline-block;padding:2px 9px;border-radius:999px;border:1px solid var(--line);background:var(--paper);font-size:12.5px;margin:0 4px 4px 0}
.chip-term{background:var(--blue-soft);border-color:transparent;color:var(--blue)}
.tag{display:inline-block;font-size:12px;font-weight:500;padding:1px 8px;border-radius:4px;background:var(--line-2);color:var(--ink-2);white-space:nowrap}
.tag-crit{background:var(--bad-soft);color:var(--bad)}
.tag-ok{background:var(--ok-soft);color:var(--ok)}
.tag-warn{background:var(--warn-soft);color:var(--warn)}

.notice{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:5px;font-size:13px}
.notice>svg{flex:none;margin-top:2px}
.notice .btn-link{color:inherit}
.notice.info{background:var(--blue-soft);color:var(--blue-h)}
.notice.warn{background:var(--warn-soft);color:var(--warn)}
.notice.bad{background:var(--bad-soft);color:var(--bad)}
.notice.ok{background:var(--ok-soft);color:var(--ok)}

.mic{display:flex;align-items:center;gap:14px;padding:14px;border:1px dashed var(--line);border-radius:6px}
.mic-btn{width:52px;height:52px;border-radius:50%;border:0;display:grid;place-items:center;background:var(--blue);color:#fff;cursor:pointer;flex:none}
.mic-btn.on{background:var(--bad)}
.mic-btn:disabled{opacity:.4;cursor:not-allowed}
.rec-dot{width:8px;height:8px;border-radius:50%;background:var(--bad);display:inline-block;animation:kp-pulse 1.2s ease-in-out infinite}
@keyframes kp-pulse{50%{opacity:.25}}

.match{padding:14px 16px;cursor:pointer;display:block}
.match.sel{border-color:var(--blue);box-shadow:inset 3px 0 0 var(--blue)}
.match-body{margin:10px 0 0 28px}
.match-body>p{max-width:72ch;margin-bottom:6px}
.unit-line{padding:8px 0 4px;border-top:1px solid var(--line-2)}
.bar{display:inline-block;height:6px;background:var(--line-2);border-radius:3px;overflow:hidden;width:120px}
.bar>i{display:block;height:100%;background:var(--blue)}

.unit-h{padding:11px 20px;background:#F7F8FA;border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.panel-h+div .unit-h{border-top:0}
.pc{padding:16px 20px;display:grid;grid-template-columns:40px minmax(0,1fr);gap:8px 12px;border-bottom:1px solid var(--line-2)}
.pc:last-child{border-bottom:0}
.pc-ref{font-weight:600;color:var(--muted);padding-top:1px}
.pc-side{grid-column:2;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px}
.pc-side .note{flex:1 1 200px;max-width:340px;height:34px}
.scale{display:inline-grid;grid-template-columns:repeat(4,auto);border:1px solid var(--line);border-radius:5px;overflow:hidden}
.scale button{all:unset;display:block;cursor:pointer;padding:4px 10px;font-size:12px;text-align:center;border-left:1px solid var(--line);min-width:62px;color:var(--ink-2)}
.scale button:first-child{border-left:0}
.scale button b{display:block;font-size:13px;color:var(--ink)}
.scale button:hover:not([disabled]){background:var(--ground)}
.scale button[aria-pressed="true"]{background:var(--blue);color:#fff}
.scale button[aria-pressed="true"] b{color:#fff}
.scale button[aria-pressed="true"].low{background:var(--warn)}
.scale button:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}
.scale button[disabled]{cursor:not-allowed}

.ev{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:5px;padding:3px 9px 3px 3px;font-size:12px;line-height:1.3}
.ev img,.ev .ev-ph{width:30px;height:30px;border-radius:3px;object-fit:cover;background:var(--line-2);display:grid;place-items:center}

.tbl-wrap{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;font-weight:500;color:var(--muted);padding:8px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
.tbl td{padding:8px 14px;border-bottom:1px solid var(--line-2);vertical-align:top}
.tbl tr:last-child td{border-bottom:0}
.tbl tr.flag td{background:var(--warn-soft)}
.tbl .clip{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;user-select:none;position:relative}
.switch input{position:absolute;opacity:0;width:1px;height:1px}
.switch-track{width:32px;height:18px;border-radius:9px;background:var(--line);position:relative;transition:background .15s}
.switch-track::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}
.switch input:checked+.switch-track{background:var(--warn)}
.switch input:checked+.switch-track::after{transform:translateX(14px)}
.switch input:focus-visible+.switch-track{outline:2px solid var(--blue);outline-offset:2px}

.stat{padding:12px 14px;border:1px solid var(--line-2);border-radius:5px;display:flex;flex-direction:column;gap:2px}
.stat b{font-size:24px;font-weight:600;line-height:1.2}

.doc{max-width:780px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:36px 40px;position:relative}
.doc-seal{position:absolute;top:32px;right:36px}
.doc-foot{margin-top:24px;border-top:1px solid var(--line-2);padding-top:12px}
.result{display:inline-block;padding:6px 14px;border-radius:5px;font-weight:600;font-size:15px}
.result.pass{background:var(--ok-soft);color:var(--ok)}
.result.fail{background:var(--warn-soft);color:var(--warn)}

@media (prefers-reduced-motion:reduce){.rec-dot,.kp .spin{animation:none}.switch-track,.switch-track::after{transition:none}}
@media (max-width:900px){
  .kp-shell{grid-template-columns:1fr;padding:16px 12px 48px;gap:16px}
  .kp-rail{position:static;display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
  .rail-item{padding:0;flex:none}
  .rail-item::before{display:none}
  .rail-btn{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--line);border-radius:5px;background:var(--paper)}
  .rail-num{position:static;width:24px;height:24px;font-size:12px}
  .rail-hi{display:none}
  .rail-en{padding:0}
  .grid-2,.grid-3{grid-template-columns:1fr}
  .pc{grid-template-columns:30px minmax(0,1fr);padding:14px}
  .pc-side{grid-column:1 / 3}
  .match-body{margin-left:0}
  .kv-wide{grid-template-columns:130px 1fr}
  .doc{padding:24px 18px}
  .doc-seal{display:none}
}
@media print{
  .kp-top,.kp-rail,.no-print{display:none!important}
  .kp{background:#fff}
  .kp-shell{display:block;padding:0}
  .doc{border:0;padding:0;max-width:none}
}
`;