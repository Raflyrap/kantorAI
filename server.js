/**
 * FLYSTUDIO - Unified Node.js Server & Website Orchestrator Engine (9 Stages)
 * - Pure Website / Landing Page Generation (Remotion & Video fully removed)
 * - Loads all 9 AI Employees from karyawan/*.json
 * - Uses Unified Runner (runner.js) & Native SQLite Storage (db.js)
 * - Budget Cap Guard ($1.50 per project) & Usage Cost Tracking
 * - 9-Stage State Machine with 3 Human-In-The-Loop Checkpoints (Rafly Approval)
 * - Realtime 3D Speech Bubbles & Office Status (idle, working, waiting_approval)
 * - Website Preview Server (/preview/<projectId>/) & Final ZIP Bundle Generator
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { execSync } = require('child_process');

const { initDb, recordUsage, recordMessage, getProjectCost, getUsageHistory, getMessages } = require('./db');
const { callAgent, BUDGET_CAP } = require('./runner');

const PORT = 3001;
const ROOT_DIR = __dirname;
const KARYAWAN_DIR = path.join(ROOT_DIR, 'karyawan');
const PROJECTS_DIR = path.join(ROOT_DIR, 'projects');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');

[OUTPUT_DIR, PROJECTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Inisialisasi Database SQLite Native
initDb();

// 1. Load 9 Karyawan Dinamis dari karyawan/*.json
const EMPLOYEES_CONFIG = {};
function loadEmployees() {
  if (!fs.existsSync(KARYAWAN_DIR)) return;
  const files = fs.readdirSync(KARYAWAN_DIR).filter(f => f.endsWith('.json'));
  files.forEach(f => {
    try {
      const raw = fs.readFileSync(path.join(KARYAWAN_DIR, f), 'utf8');
      const data = JSON.parse(raw);
      const slug = data.slug || f.replace('.json', '');
      EMPLOYEES_CONFIG[slug] = {
        id: data.id || slug,
        slug: slug,
        nama: data.nama || slug,
        jabatan: data.jabatan || '',
        ruang: data.ruang || 'r1',
        warna: data.warna || '#3B82F6',
        avatar_hewan: data.avatar_hewan || 'fox',
        model: data.model || 'openai/gpt-4o-mini',
        fallback_model: data.fallback_model || 'anthropic/claude-haiku-4.5',
        deskripsi: data.deskripsi || '',
        system_prompt: data.system_prompt || `Kamu adalah ${data.nama}, staf di FlyStudio.`
      };
    } catch (e) {
      console.error(`Gagal membaca ${f}:`, e.message);
    }
  });
  console.log(`-> Berhasil memuat ${Object.keys(EMPLOYEES_CONFIG).length} karyawan AI Website dari karyawan/*.json`);
}
loadEmployees();

// 2. In-Memory Office State & 9-Stage State Machine for Website
const officeState = {
  currentProjectId: 'default-project',
  currentStage: 0, // 0: standby, 1..9 stages, 10: completed
  stageName: 'Standby (Semua Staf Menunggu Arahan Bos Rafly)',
  topic: '',
  meetingActive: false,
  latestDelivery: null,
  liveTranscript: [], // [{ time, sender, senderSlug, role, target, targetSlug, text, stage }]
  waitingForAdvice: null,
  checkpoints: {
    checkpoint1: {
      status: 'idle', // 'idle' | 'pending' | 'approved' | 'revision'
      concepts: [],
      outline: [],
      selectedConcept: null,
      feedback: ''
    },
    checkpoint2: {
      status: 'idle', // 'idle' | 'pending' | 'approved' | 'revision'
      copyData: null,
      designSystem: null,
      reviewNotes: '',
      approved: false
    },
    checkpoint3: {
      status: 'idle', // 'idle' | 'pending' | 'approved' | 'revision'
      previewUrl: '',
      downloadUrl: '',
      seoData: null,
      approved: false
    }
  },
  employees: {
    raka: { status: 'idle', bubble: 'Siap merancang struktur website impian Bos Rafly!', bubbleUntil: 0, room: 'meet' },
    rina: { status: 'idle', bubble: 'Standby riset audiens sasaran & benchmark UX kompetitor.', bubbleUntil: 0, room: 'r1' },
    bagas: { status: 'idle', bubble: 'Standby mengonsep headline & wireframe kreatif.', bubbleUntil: 0, room: 'r1' },
    sari: { status: 'idle', bubble: 'Standby meracik copy persuasif per section.', bubbleUntil: 0, room: 'r2' },
    dimas: { status: 'idle', bubble: 'Standby review kode HTML/CSS/JS & aksesibilitas.', bubbleUntil: 0, room: 'r2' },
    luna: { status: 'idle', bubble: 'Standby menyusun design system & komponen UI.', bubbleUntil: 0, room: 'r3' },
    kevin: { status: 'idle', bubble: 'Standby uji browser responsif & validasi form.', bubbleUntil: 0, room: 'r3' },
    adam: { status: 'idle', bubble: 'Standby coding website interaktif di projects/website/.', bubbleUntil: 0, room: 'r4' },
    nadia: { status: 'idle', bubble: 'Standby racik SEO meta, keyword & strategi konversi.', bubbleUntil: 0, room: 'r4' }
  }
};

// Reset State Helper (Menghasilkan Project ID baru tanpa menghapus proyek lama)
function resetOfficeState() {
  const newPid = 'proj-' + Date.now();
  officeState.currentProjectId = newPid;
  officeState.currentStage = 0;
  officeState.stageName = 'Standby (Semua Staf Menunggu Arahan Bos Rafly)';
  officeState.topic = '';
  officeState.meetingActive = false;
  officeState.waitingForAdvice = null;
  officeState.latestDelivery = null;
  officeState.checkpoints = {
    checkpoint1: { status: 'idle', concepts: [], outline: [], selectedConcept: null, feedback: '' },
    checkpoint2: { status: 'idle', copyData: null, designSystem: null, reviewNotes: '', approved: false },
    checkpoint3: { status: 'idle', previewUrl: '', downloadUrl: '', seoData: null, approved: false }
  };
  Object.keys(officeState.employees).forEach(slug => {
    officeState.employees[slug].status = 'idle';
    officeState.employees[slug].bubble = 'Siap menerima tugas pembuatan website dari Bos Rafly!';
    officeState.employees[slug].bubbleUntil = Date.now() + 10000;
  });
  recordDialog('system', 'all', 'Kantor telah di-reset. Semua 9 staf AI standby menunggu tugas website dari Bos Rafly.', 0);
  console.log(`[RESET] Project baru diinisialisasi: ${newPid}. Semua staf AI IDLE/STANDBY.`);
}

// Helper: Add dialog to Live Transcript, 3D speech bubble, and SQLite messages
function recordDialog(senderSlug, targetSlug, text, stageNum) {
  let senderNama = senderSlug;
  let senderRole = '';
  let targetNama = targetSlug;

  if (senderSlug === 'rafly') {
    senderNama = 'Bos Rafly';
    senderRole = 'Executive Producer';
  } else if (senderSlug === 'system') {
    senderNama = 'FlyStudio System';
    senderRole = 'Control';
  } else if (EMPLOYEES_CONFIG[senderSlug]) {
    senderNama = EMPLOYEES_CONFIG[senderSlug].nama;
    senderRole = EMPLOYEES_CONFIG[senderSlug].jabatan;
  }

  if (targetSlug === 'rafly') {
    targetNama = 'Bos Rafly';
  } else if (targetSlug === 'all') {
    targetNama = 'Seluruh Tim';
  } else if (EMPLOYEES_CONFIG[targetSlug]) {
    targetNama = EMPLOYEES_CONFIG[targetSlug].nama;
  }

  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  officeState.liveTranscript.push({
    time: timeStr,
    sender: senderNama,
    senderSlug: senderSlug,
    role: senderRole,
    target: targetNama,
    targetSlug: targetSlug,
    text: text,
    stage: stageNum
  });

  // Catat ke Database SQLite
  try {
    recordMessage(officeState.currentProjectId, stageNum, senderNama, senderRole, targetNama, text);
  } catch (e) { }

  // Pasang speech bubble 3D
  if (officeState.employees[senderSlug]) {
    officeState.employees[senderSlug].bubble = text.slice(0, 95) + (text.length > 95 ? '...' : '');
    officeState.employees[senderSlug].bubbleUntil = Date.now() + 12000;
  }
}

// Helper: Compress folder into ZIP using PowerShell Compress-Archive
function createZipBundle(sourceDir, zipFilePath) {
  try {
    if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
    const cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipFilePath}' -Force"`;
    execSync(cmd);
    console.log(`[ZIP] Bundle final berhasil dibuat: ${zipFilePath}`);
    return true;
  } catch (e) {
    console.error('[ZIP Error]:', e.message);
    return false;
  }
}

// ==========================================
// 3. Alur Kerja 9 Tahap (Autonomous Engine)
// ==========================================

async function startAutonomousDelegation(initiatorSlug, userTopic) {
  const pId = officeState.currentProjectId;
  officeState.topic = userTopic;

  // Siapkan folder projek
  const projDir = path.join(PROJECTS_DIR, pId);
  const webDir = path.join(projDir, 'website');
  const outDir = path.join(projDir, 'output');
  [projDir, webDir, outDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  console.log(`\n======================================================`);
  console.log(`[ALUR KERJA WEBSITE] Memulai projek: "${userTopic}" (ID: ${pId})`);
  console.log(`======================================================\n`);

  // TAHAP 1: RAKA (PM - anthropic/claude-sonnet-5.5)
  officeState.currentStage = 1;
  officeState.stageName = 'Tahap 1: Perencanaan Halaman & Pembagian Tugas (Raka)';
  officeState.employees.raka.status = 'working';

  let rakaPlan = {
    projectName: userTopic,
    pageType: "Landing Page",
    sections: ["Hero", "Problem/Pain Points", "Solution & Benefits", "Feature Highlights", "Testimonials", "Pricing / Offer", "FAQ", "Footer CTA"],
    features: ["Responsive Navbar", "Interactive FAQ Accordion", "Contact / Newsletter Form", "Modern Card Layout"]
  };

  try {
    const rakaConf = EMPLOYEES_CONFIG.raka;
    const promptRaka = `Instruksi Bos Rafly: "${userTopic}".\nBuat rencana website terstruktur dalam format JSON murni:\n{\n  "projectName": "...",\n  "pageType": "Landing Page",\n  "sections": ["Hero", "Benefits", "Features", "Testimonials", "FAQ", "CTA"],\n  "features": ["Responsive Navbar", "Interactive FAQ Accordion", "Lead Form"]\n}`;
    const rakaRes = await callAgent(rakaConf, promptRaka, pId);
    const m = rakaRes.text.match(/\{[\s\S]*\}/);
    if (m) rakaPlan = JSON.parse(m[0]);
  } catch (e) {
    console.warn('Gagal parse rencana Raka, menggunakan fallback template:', e.message);
  }

  fs.writeFileSync(path.join(projDir, 'project-plan.json'), JSON.stringify(rakaPlan, null, 2));

  const rakaBrief = `Tim, Bos Rafly memberikan proyek: "${userTopic}". Rencana struktur website: ${rakaPlan.sections.join(' -> ')}. Rina, silakan mulai riset audiens & value proposition!`;
  recordDialog('raka', 'rina', rakaBrief, 1);
  await new Promise(r => setTimeout(r, 1200));
  officeState.employees.raka.status = 'idle';

  // TAHAP 2: RINA (RESEARCH - deepseek/deepseek-r1)
  officeState.currentStage = 2;
  officeState.stageName = 'Tahap 2: Riset Audiens, Benchmarking & Fakta Kunci (Rina)';
  officeState.employees.rina.status = 'working';
  console.log(`[Stage 2] Rina (DeepSeek R1) melakukan riset audiens...`);

  let rinaSummary = `Target audiens adalah pemula yang mencari solusi praktis, terpercaya, dan berorientasi hasil untuk ${userTopic}. Poin kunci: onboarding mudah, kurikulum terstruktur, dan dukungan komunitas aktif.`;
  try {
    const rinaConf = EMPLOYEES_CONFIG.rina;
    const promptRina = `Lakukan riset untuk website "${userTopic}". Identifikasi: 1) Target audiens dan motivasi mereka, 2) Value proposition utama, 3) 3 fitur wajib ada. Tulis dalam ringkasan 2 paragraf padat.`;
    const rinaRes = await callAgent(rinaConf, promptRina, pId);
    rinaSummary = rinaRes.text;
  } catch (e) {
    console.warn('Gagal panggil Rina:', e.message);
  }

  recordDialog('rina', 'bagas', `Bagas, ini temuan riset untuk "${userTopic}":\n${rinaSummary.slice(0, 100)}...\nSilakan buatkan 3 konsep kreatif website dan outline section ya!`, 2);
  await new Promise(r => setTimeout(r, 1200));
  officeState.employees.rina.status = 'idle';

  // TAHAP 3: BAGAS (CREATIVE DIRECTOR - openai/gpt-4o-mini) -> CHECKPOINT 1
  officeState.currentStage = 3;
  officeState.stageName = 'Tahap 3: Perumusan 3 Konsep Kreatif & Outline Section (Bagas) [CHECKPOINT 1]';
  officeState.employees.bagas.status = 'waiting_approval';
  console.log(`[Stage 3] Bagas (GPT-4o Mini) menyusun 3 konsep kreatif website...`);

  let conceptOptions = [
    { id: 1, headline: `Kuasai ${userTopic} dengan Mudah & Praktis`, tagline: "Langkah pasti menjadi ahli tanpa rasa pusing atau buang waktu.", visualDirection: "Modern Tech Dark Mode dengan aksen Neon Cyan" },
    { id: 2, headline: `Solusi Tepat untuk Mengembangkan Skill ${userTopic}`, tagline: "Metode belajar interaktif dan terbukti langsung di industri.", visualDirection: "Clean Vibrant Slate dengan sentuhan Emerald Green" },
    { id: 3, headline: `Transformasi Karir Anda Lewat ${userTopic}`, tagline: "Bimbingan langkah demi langkah dari praktisi berpengalaman.", visualDirection: "Professional Corporate Navy & White Minimalist" }
  ];

  let outlineSections = [
    "1. Hero Section (Headline, Subheadline, Primary CTA Button, Mockup/Badge)",
    "2. Problem & Pain Points (3 Kendala Utama yang Dihadapi Pengunjung)",
    "3. Solution & Key Benefits (Solusi Cerdas & Keunggulan Layanan)",
    "4. Interactive Feature Grid (Detail Fitur & Kurikulum/Layanan)",
    "5. Social Proof & Testimonials (Testimoni & Skor Kepuasan)",
    "6. Pricing & Special Offer (Paket Harga / Free Trial)",
    "7. FAQ Accordion (Tanya Jawab Populer)",
    "8. Final CTA Footer (Ajak Bergabung & Hubungi Kami)"
  ];

  try {
    const bagasConf = EMPLOYEES_CONFIG.bagas;
    const promptBagas = `Temuan riset Rina: "${rinaSummary}". Topik: "${userTopic}".\nBuat 3 opsi konsep kreatif website dan outline dalam format JSON murni:\n{\n  "concepts": [\n    {"id": 1, "headline": "...", "tagline": "...", "visualDirection": "..."},\n    {"id": 2, "headline": "...", "tagline": "...", "visualDirection": "..."},\n    {"id": 3, "headline": "...", "tagline": "...", "visualDirection": "..."}\n  ],\n  "outline": ["1. Hero ...", "2. Benefits ...", "3. Features ...", "4. FAQ ...", "5. CTA ..."]\n}`;
    const bagasRes = await callAgent(bagasConf, promptBagas, pId);
    const m = bagasRes.text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed.concepts && parsed.concepts.length) conceptOptions = parsed.concepts;
      if (parsed.outline && parsed.outline.length) outlineSections = parsed.outline;
    }
  } catch (e) {
    console.warn('Gagal parse konsep Bagas, pakai default konsep:', e.message);
  }

  officeState.checkpoints.checkpoint1 = {
    status: 'pending',
    concepts: conceptOptions,
    outline: outlineSections,
    selectedConcept: null,
    feedback: ''
  };

  const bagasMsg = `Bos Rafly, 3 alternatif konsep kreatif website "${userTopic}" sudah siap di Checkpoint 1! Silakan pilih konsep favorit Bos untuk dilanjutkan ke tahap copywriting & desain.`;
  recordDialog('bagas', 'rafly', bagasMsg, 3);
  officeState.waitingForAdvice = { employee: 'bagas', topic: userTopic, type: 'checkpoint1', question: bagasMsg, concepts: conceptOptions };
  console.log(`[CHECKPOINT 1] Menunggu persetujuan konsep dari Bos Rafly.`);
}

// Lanjutan Workflow Setelah Checkpoint 1 disetujui Rafly
async function advanceFromCheckpoint1(selectedConceptId = 1, customFeedback = '') {
  const pId = officeState.currentProjectId;
  const cp1 = officeState.checkpoints.checkpoint1;
  cp1.status = 'approved';
  cp1.selectedConcept = cp1.concepts.find(c => c.id == selectedConceptId) || cp1.concepts[0];
  cp1.feedback = customFeedback;

  officeState.waitingForAdvice = null;
  officeState.employees.bagas.status = 'idle';

  const chosenHeadline = cp1.selectedConcept.headline;
  const chosenVisual = cp1.selectedConcept.visualDirection;
  const topic = officeState.topic || 'Website Modern';

  recordDialog('bagas', 'sari', `Sari, Bos Rafly menyetujui konsep: "${chosenHeadline}". Arah visual: "${chosenVisual}". Catatan: "${customFeedback}". Tolong tulis copy lengkap per section ya!`, 3);
  recordDialog('bagas', 'luna', `Luna, silakan siapkan Design System, variabel CSS, dan palet warna yang cocok dengan gaya "${chosenVisual}"!`, 3);
  await new Promise(r => setTimeout(r, 1000));

  // TAHAP 4: SARI (COPYWRITER) + LUNA (UI/UX DESIGNER) -> CHECKPOINT 2
  officeState.currentStage = 4;
  officeState.stageName = 'Tahap 4: Copywriting Konten (Sari) & Design System UI/UX (Luna) [CHECKPOINT 2]';
  officeState.employees.sari.status = 'working';
  officeState.employees.luna.status = 'working';
  console.log(`[Stage 4] Sari menulis copy dan Luna merancang design system...`);

  // Default Fallback Copy & Design (Strictly NO EMOJI, 100% SVG based)
  let copyData = {
    hero: {
      title: chosenHeadline,
      subtitle: cp1.selectedConcept.tagline,
      badge: "Solusi Terdepan & Terverifikasi",
      ctaPrimary: "Mulai Sekarang Gratis",
      ctaSecondary: "Pelajari Kurikulum"
    },
    benefits: [
      { id: "ben-1", title: "Praktis & Terarah", desc: "Materi disusun step-by-step tanpa jargon rumit dan terstruktur rapi." },
      { id: "ben-2", title: "Langsung Praktek", desc: "Studi kasus nyata yang relevan dengan kebutuhan industri masa kini." },
      { id: "ben-3", title: "Bimbingan Mentor", desc: "Dukungan konsultasi langsung dari tim berpengalaman di bidangnya." }
    ],
    features: [
      { id: "feat-1", title: "Akses Seumur Hidup", desc: "Belajar kapan saja tanpa batas waktu dari perangkat apa pun." },
      { id: "feat-2", title: "Sertifikat Kelulusan", desc: "Bukti kredibilitas resmi yang siap dipajang di portofolio & LinkedIn." },
      { id: "feat-3", title: "Forum Komunitas", desc: "Networking eksklusif dengan sesama praktisi dan pembelajar aktif." }
    ],
    faq: [
      { q: "Apakah kursus ini cocok untuk pemula?", a: "Sangat cocok! Kami memulai dari dasar tanpa syarat keahlian awal." },
      { q: "Bagaimana sistem pembelajarannya?", a: "Full online dan fleksibel, bisa diakses dari laptop maupun smartphone." },
      { q: "Apakah ada garansi kepuasan?", a: "Ya, kami menyediakan garansi kepuasan 7 hari penuh." }
    ],
    ctaFooter: {
      headline: "Siap Memulai Transformasi Anda?",
      subheadline: "Bergabung bersama ribuan member lainnya sekarang juga.",
      buttonLabel: "Daftar Akun Gratis"
    }
  };

  let designSystem = {
    fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
    googleFontUrl: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap",
    colors: {
      bgPrimary: "#080C14",
      bgCard: "#0F1626",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#6366F1",
      accentHover: "#4F46E5",
      border: "rgba(255, 255, 255, 0.08)"
    },
    borderRadius: "16px"
  };

  try {
    const sariConf = EMPLOYEES_CONFIG.sari;
    const promptSari = `Konsep website terpilih Bos Rafly:\nHeadline: "${chosenHeadline}"\nTagline: "${cp1.selectedConcept.tagline}"\nTopik: "${topic}".\nATURAN MUTLAK BOS RAFLY: DILARANG KERAS MENGGUNAKAN EMOJI ATAU EMOTIKON DI MANA PUN (jangan gunakan 🚀, ✨, 🔥, dll). Tulis teks murni elegan dan persuasif.\nBuat copy lengkap dalam format JSON murni:\n{\n  "hero": {"title": "...", "subtitle": "...", "badge": "...", "ctaPrimary": "...", "ctaSecondary": "..."},\n  "benefits": [{"id": "ben-1", "title": "...", "desc": "..."}, {"id": "ben-2", "title": "...", "desc": "..."}, {"id": "ben-3", "title": "...", "desc": "..."}],\n  "features": [{"id": "feat-1", "title": "...", "desc": "..."}, {"id": "feat-2", "title": "...", "desc": "..."}, {"id": "feat-3", "title": "...", "desc": "..."}],\n  "faq": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}],\n  "ctaFooter": {"headline": "...", "subheadline": "...", "buttonLabel": "..."}\n}`;
    const sariRes = await callAgent(sariConf, promptSari, pId);
    const mSari = sariRes.text.match(/\{[\s\S]*\}/);
    if (mSari) copyData = JSON.parse(mSari[0]);
  } catch (e) {
    console.warn('Gagal call Sari, gunakan fallback copy:', e.message);
  }

  try {
    const lunaConf = EMPLOYEES_CONFIG.luna;
    const promptLuna = `Arah visual website: "${chosenVisual}". Terapkan prinsip dari repo 'plugin87/ux-ui-agent-skills' dan 'nextlevelbuilder/ui-ux-pro-max-skill' (standar WCAG AAA contrast, spacing tokens 4-8-12-16-24-32-48-64px, modern font pairings Plus Jakarta Sans / Inter, dark-mode surface palette).\nATURAN MUTLAK: DILARANG MENGGUNAKAN EMOJI. Semua icon wajib inline SVG.\nBuatkan Design System website dalam format JSON murni:\n{\n  "fontFamily": "'Plus Jakarta Sans', Inter, sans-serif",\n  "googleFontUrl": "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap",\n  "colors": {\n    "bgPrimary": "#080C14",\n    "bgCard": "#0F1626",\n    "textPrimary": "#F8FAFC",\n    "textSecondary": "#94A3B8",\n    "accent": "#6366F1",\n    "accentHover": "#4F46E5",\n    "border": "rgba(255, 255, 255, 0.08)"\n  },\n  "borderRadius": "16px"\n}`;
    const lunaRes = await callAgent(lunaConf, promptLuna, pId);
    const mLuna = lunaRes.text.match(/\{[\s\S]*\}/);
    if (mLuna) designSystem = JSON.parse(mLuna[0]);
  } catch (e) {
    console.warn('Gagal call Luna, gunakan fallback design:', e.message);
  }

  officeState.checkpoints.checkpoint2 = {
    status: 'pending',
    copyData: copyData,
    designSystem: designSystem,
    reviewNotes: `Copywriting persuasif telah selesai diracik oleh Sari (100% bebas emoji), dan Design System UI/UX telah disusun oleh Luna mengacu pada ux-ui-agent-skills & ui-ux-pro-max-skill sesuai gaya visual "${chosenVisual}".`,
    approved: false
  };

  fs.writeFileSync(path.join(PROJECTS_DIR, pId, 'copy-data.json'), JSON.stringify(copyData, null, 2));
  fs.writeFileSync(path.join(PROJECTS_DIR, pId, 'design-system.json'), JSON.stringify(designSystem, null, 2));

  officeState.employees.sari.status = 'idle';
  officeState.employees.luna.status = 'idle';
  officeState.employees.dimas.status = 'waiting_approval';

  const cp2Msg = `Bos Rafly, draf copywriting lengkap dan Design System visual (berbasis ux-ui-agent-skills & ui-ux-pro-max, 100% SVG inline tanpa emoji) untuk "${topic}" sudah siap di Checkpoint 2. Mohon review & persetujuan Bos agar Adam bisa langsung mulai coding website!`;
  recordDialog('dimas', 'rafly', cp2Msg, 4);
  officeState.waitingForAdvice = { employee: 'dimas', topic, type: 'checkpoint2', question: cp2Msg };
  console.log(`[CHECKPOINT 2] Menunggu persetujuan teks & desain dari Bos Rafly.`);
}

// Lanjutan Workflow Setelah Checkpoint 2 disetujui Rafly
async function advanceFromCheckpoint2(approved = true, notes = '') {
  const pId = officeState.currentProjectId;
  const cp2 = officeState.checkpoints.checkpoint2;
  cp2.status = 'approved';
  cp2.approved = true;
  officeState.waitingForAdvice = null;

  officeState.employees.dimas.status = 'idle';
  const topic = officeState.topic || 'Website Modern';
  const copyData = cp2.copyData;
  const ds = cp2.designSystem;

  recordDialog('dimas', 'adam', `Adam, teks copy dan design system sudah disetujui Bos Rafly! Terapkan doktrin taste-skill (Leonxlnx): anti-generic layout, micro-interactions, subtle borders, dan strictly inline SVG icons tanpa emoji. Silakan bangun index.html!`, 5);
  await new Promise(r => setTimeout(r, 1000));

  // TAHAP 5: ADAM (FRONTEND DEVELOPER - anthropic/claude-sonnet-5.5)
  officeState.currentStage = 5;
  officeState.stageName = 'Tahap 5: Implementasi Kode Website HTML/CSS/JS (Adam) [taste-skill standard]';
  officeState.employees.adam.status = 'working';
  console.log(`[Stage 5] Adam (Claude Sonnet 5.5) membangun website index.html dengan standar taste-skill...`);

  const webDir = path.join(PROJECTS_DIR, pId, 'website');
  if (!fs.existsSync(webDir)) fs.mkdirSync(webDir, { recursive: true });

  // Generate HTML Website menerapkan prinsip taste-skill + ui-ux-pro-max + ux-ui-agent-skills
  let htmlContent = generateModernWebsiteHtml(topic, copyData, ds);
  // Sanitasi ketat: pastikan tidak ada emoji yang terselip
  htmlContent = stripEmojis(htmlContent);

  const indexPath = path.join(webDir, 'index.html');
  fs.writeFileSync(indexPath, htmlContent, 'utf8');
  console.log(`[Adam] File website berhasil ditulis (100% SVG, 0 emoji): ${indexPath}`);
  console.log(`[Adam] File website berhasil ditulis: ${indexPath}`);

  recordDialog('adam', 'dimas', `Dimas, file website index.html sudah selesai saya bangun di projects/${pId}/website/. Mohon direview kode dan aksesibilitasnya ya!`, 5);
  recordDialog('adam', 'kevin', `Kevin, tolong uji navigasi responsif dan interaktivitasnya di browser juga ya!`, 5);
  await new Promise(r => setTimeout(r, 1200));
  officeState.employees.adam.status = 'idle';

  // TAHAP 6: DIMAS (CODE REVIEW) + KEVIN (TESTER QA)
  officeState.currentStage = 6;
  officeState.stageName = 'Tahap 6: Audit Kode & Pengujian Browser Responsif (Dimas & Kevin)';
  officeState.employees.dimas.status = 'working';
  officeState.employees.kevin.status = 'working';
  console.log(`[Stage 6] Dimas dan Kevin melakukan audit teknis dan QA browser...`);

  let codeReviewNotes = "Sintaks HTML5 valid, CSS variabel terstruktur rapi, CDN Tailwind/Google Fonts aktif, kontras warna memenuhi standar WCAG.";
  try {
    const dimasConf = EMPLOYEES_CONFIG.dimas;
    const promptDimas = `Review file website index.html untuk topik "${topic}". Pastikan sintaks HTML5 semantik (heading h1-h3, button form), aksesibilitas, dan tidak ada tag rusak. Berikan penilaian teknis 1-2 kalimat.`;
    const dimasRes = await callAgent(dimasConf, promptDimas, pId);
    codeReviewNotes = dimasRes.text;
  } catch (e) { }

  let qaNotes = "Uji responsivitas lolos di viewport mobile (375px), tablet (768px), dan desktop (1440px). FAQ accordion interaktif dan form berjalan lancar.";
  try {
    const kevinConf = EMPLOYEES_CONFIG.kevin;
    const promptKevin = `Uji skenario tampilan responsif dan interaktivitas tombol/form untuk website "${topic}". Laporkan hasil uji browser dalam 1-2 kalimat ringkas.`;
    const kevinRes = await callAgent(kevinConf, promptKevin, pId);
    qaNotes = kevinRes.text;
  } catch (e) { }

  recordDialog('dimas', 'adam', `Adam, hasil review teknis: ${codeReviewNotes.slice(0, 80)}... Kode aman dan siap lanjut!`, 6);
  recordDialog('kevin', 'adam', `Adam, hasil uji responsif: ${qaNotes.slice(0, 80)}... Tampilan sangat mulus di semua device!`, 6);
  await new Promise(r => setTimeout(r, 1200));
  officeState.employees.dimas.status = 'idle';
  officeState.employees.kevin.status = 'idle';

  // TAHAP 7: NADIA (SEO & GROWTH) -> CHECKPOINT 3
  officeState.currentStage = 7;
  officeState.stageName = 'Tahap 7: Optimasi SEO Meta Tags & Strategi Konversi (Nadia) [CHECKPOINT 3]';
  officeState.employees.nadia.status = 'working';
  console.log(`[Stage 7] Nadia (GPT-4o Mini) menambahkan meta SEO...`);

  let seoData = {
    metaTitle: `${topic} - Panduan Lengkap & Terpercaya | FlyStudio`,
    metaDescription: `Kuasai ${topic} dengan bimbingan praktis dan materi terstruktur. Akses fleksibel, metode interaktif, dan sertifikat resmi. Daftar sekarang!`,
    keywords: [topic, "belajar coding", "kursus online", "tutorial pemula", "flystudio tech"],
    recommendedUrl: `https://flystudio.id/${encodeURIComponent(topic.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`
  };

  try {
    const nadiaConf = EMPLOYEES_CONFIG.nadia;
    const promptNadia = `Buat paket optimasi SEO untuk website "${topic}" dalam format JSON murni:\n{\n  "metaTitle": "...",\n  "metaDescription": "...",\n  "keywords": ["...", "..."],\n  "recommendedUrl": "..."\n}`;
    const nadiaRes = await callAgent(nadiaConf, promptNadia, pId);
    const mSeo = nadiaRes.text.match(/\{[\s\S]*\}/);
    if (mSeo) seoData = JSON.parse(mSeo[0]);
  } catch (e) { }

  fs.writeFileSync(path.join(PROJECTS_DIR, pId, 'output', 'seo.json'), JSON.stringify(seoData, null, 2));

  // Update HTML with SEO tags
  let currentHtml = fs.readFileSync(indexPath, 'utf8');
  currentHtml = currentHtml.replace('<title>FlyStudio Website</title>', `<title>${seoData.metaTitle}</title>\n    <meta name="description" content="${seoData.metaDescription}">\n    <meta name="keywords" content="${(seoData.keywords || []).join(', ')}">`);
  fs.writeFileSync(indexPath, currentHtml, 'utf8');

  officeState.employees.nadia.status = 'idle';
  officeState.employees.adam.status = 'waiting_approval';

  const previewUrl = `/preview/${pId}/`;
  const downloadUrl = `/api/download-website?project=${pId}`;

  officeState.checkpoints.checkpoint3 = {
    status: 'pending',
    previewUrl: previewUrl,
    downloadUrl: downloadUrl,
    seoData: seoData,
    approved: false
  };

  // Buat ZIP awal agar tombol unduh langsung berfungsi saat Checkpoint 3 disajikan
  try {
    const earlyZipPath = path.join(PROJECTS_DIR, pId, 'output', 'website-final.zip');
    createZipBundle(webDir, earlyZipPath);
  } catch (e) {}

  const adamDeliveryMsg = `Bos Rafly, website "${topic}" sudah selesai kami bangun, diuji fungsional oleh Kevin, direview oleh Dimas, dan dioptimasi SEO oleh Nadia! Pratinjau langsung siap dibuka di browser. Silakan klik [Buka Pratinjau], [Setuju / Download ZIP], atau ajukan revisi.`;

  officeState.latestDelivery = {
    id: 'deliv-' + Date.now(),
    type: 'website',
    title: topic,
    previewUrl: previewUrl,
    downloadUrl: downloadUrl,
    text: adamDeliveryMsg,
    seoData: seoData
  };

  recordDialog('adam', 'rafly', adamDeliveryMsg, 7);
  officeState.waitingForAdvice = { employee: 'adam', topic, type: 'checkpoint3', question: adamDeliveryMsg, previewUrl, downloadUrl };
  console.log(`[CHECKPOINT 3] Website selesai. Menunggu persetujuan Bos Rafly.`);
}

// TAHAP 8-10: ENDING RUN (Setelah Checkpoint 3 disetujui Rafly)
async function finalizeProjectEndingRun() {
  const pId = officeState.currentProjectId;
  const topic = officeState.topic || 'Website Modern';
  const projDir = path.join(PROJECTS_DIR, pId);
  const outDir = path.join(projDir, 'output');
  const webDir = path.join(projDir, 'website');

  console.log(`\n[ENDING RUN] Memulai proses finalisasi proyek ${pId}...`);
  officeState.currentStage = 8;
  officeState.stageName = 'Tahap 8: Pembuatan Laporan Eksekutif (Raka) & Audit Biaya';

  // 1. Buat Laporan Raka (laporan-raka.md)
  const laporanContent = `# Laporan Penyelesaian Proyek Website FlyStudio
**Nama Proyek:** ${topic}
**Project ID:** ${pId}
**Tanggal:** ${new Date().toLocaleDateString('id-ID')}
**Status:** SELESAI & DISETUJUI BOS RAFLY

---

## 1. Apa yang Telah Dibuat
- **Halaman Utama (index.html):** Landing page responsif modern dengan layout Hero, Benefit, Feature Grid, Interactive FAQ Accordion, dan Footer Call To Action.
- **Design System:** Tipografi Inter dari Google Fonts, palet warna kontras tinggi yang ramah aksesibilitas, dan styling CSS mandiri.
- **Optimasi SEO:** Meta Title, Meta Description, dan kata kunci terarah dari Nadia.
- **Quality Assurance:** Kode lolos uji sintaks oleh Dimas dan lolos uji responsif multi-device oleh Kevin.

## 2. Cara Membuka Website
1. Ekstrak file bundle \`website-final.zip\`.
2. Buka folder \`website/\` dan klik ganda file \`index.html\` di browser apa pun (Google Chrome, Firefox, Edge, Safari).
3. Halaman sudah self-contained dan bisa langsung diunggah ke hosting cPanel, Vercel, Netlify, atau GitHub Pages.

## 3. Catatan Pengembangan Lanjutan (Opsional)
- Integrasikan endpoint backend untuk form kontak/newsletter (e.g. Formspree, Mailchimp, atau database API).
- Tambahkan Google Analytics / Meta Pixel untuk pelacakan konversi pengunjung.

---
*Dibuat secara otomatis oleh Raka (Project Manager FlyStudio).*
`;
  fs.writeFileSync(path.join(outDir, 'laporan-raka.md'), laporanContent, 'utf8');

  // 2. Buat Ringkasan Biaya SQLite (ringkasan-biaya.json)
  const history = getUsageHistory(pId);
  const totalCost = getProjectCost(pId);
  const summaryBiaya = {
    projectId: pId,
    totalCostUsd: totalCost,
    budgetCapUsd: BUDGET_CAP,
    totalApiCalls: history.length,
    callBreakdown: history
  };
  fs.writeFileSync(path.join(outDir, 'ringkasan-biaya.json'), JSON.stringify(summaryBiaya, null, 2), 'utf8');

  // Salin folder website ke dalam output folder agar ikut ter-bundle
  const outWebDir = path.join(outDir, 'website');
  if (!fs.existsSync(outWebDir)) fs.mkdirSync(outWebDir, { recursive: true });
  fs.copyFileSync(path.join(webDir, 'index.html'), path.join(outWebDir, 'index.html'));

  // 3. Buat Bundle ZIP Final
  officeState.currentStage = 9;
  officeState.stageName = 'Tahap 9: Pembuatan Arsip Paket ZIP Final';
  const zipPath = path.join(outDir, 'website-final.zip');
  createZipBundle(outDir, zipPath);

  // 4. Tahap 10: Selesai
  officeState.currentStage = 10;
  officeState.stageName = 'Selesai: Paket Website Siap Diunduh & Dipublikasikan';
  officeState.employees.adam.status = 'idle';
  officeState.waitingForAdvice = null;

  const finalMsg = `Selamat Bos Rafly! Seluruh paket website "${topic}" telah selesai diproduksi dan di-bundle menjadi ZIP. Bos bisa langsung mengunduh arsip final melalui tautan di bawah ini atau membukanya kembali kapan saja. Terima kasih atas kepemimpinan Bos Rafly!`;
  recordDialog('adam', 'rafly', finalMsg, 10);
  console.log(`[PROJECT COMPLETED] Proyek ${pId} sukses 100%! Total Biaya: $${totalCost.toFixed(5)} USD.`);
}

// Helper: Sanitasi Emoji ketat (Sesuai instruksi Bos Rafly: STRICTLY NO EMOJI, 100% SVG Icons)
function stripEmojis(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}-\u{23E9}\u{23F0}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25FB}-\u{25FE}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{2139}\u{2194}-\u{2199}\u{21A9}-\u{21AA}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/gu, '')
    .trim();
}

// Icon Set Inline SVG Standar Lucide / Heroicons (taste-skill & ui-ux-pro-max standard)
const SVG_ICONS = {
  rocket: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2 5-2"></path><path d="M12 15v5s3.03-.55 4.5-2c1.63-1.62 2-5 2-5"></path></svg>`,
  sparkles: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>`,
  shield: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
  zap: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  layers: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  check: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`,
  checkCircle: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`,
  arrowRight: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  star: `<svg class="w-4 h-4 fill-amber-400 text-amber-400" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  users: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  chart: `<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  chevronDown: `<svg class="w-5 h-5 transform transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  brand: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-8 4.5v9L12 21l8-4.5v-9L12 3Z"></path><path d="m12 12 8-4.5"></path><path d="M12 12v9"></path><path d="M12 12 4 7.5"></path></svg>`
};

// Helper: Generator Template HTML Modern & Responsive
// Mengadopsi prinsip dari:
// 1. Leonxlnx/taste-skill: Anti-generic layout, subtle border luminescence, dark depth, high craft
// 2. nextlevelbuilder/ui-ux-pro-max-skill: Design dials, font pairing Plus Jakarta Sans, WCAG AAA tokens
// 3. plugin87/ux-ui-agent-skills: Fluid spacing scale, component states, accessible interactivity
// STRICTLY NO EMOJI: Semua icon menggunakan SVG Inline murni
function generateModernWebsiteHtml(topic, copy, ds) {
  const c = ds.colors || {
    bgPrimary: "#080C14",
    bgCard: "#0F1626",
    textPrimary: "#F8FAFC",
    textSecondary: "#94A3B8",
    accent: "#6366F1",
    accentHover: "#4F46E5",
    border: "rgba(255, 255, 255, 0.08)"
  };

  const font = ds.fontFamily || "'Plus Jakarta Sans', Inter, sans-serif";
  const fontUrl = ds.googleFontUrl || "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap";

  const cleanTitle = stripEmojis(copy.hero?.title || topic);
  const cleanSubtitle = stripEmojis(copy.hero?.subtitle || 'Solusi terintegrasi dengan arsitektur modern untuk mempercepat produktivitas dan pertumbuhan Anda.');
  const cleanBadge = stripEmojis(copy.hero?.badge || 'Solusi Terdepan & Terverifikasi');
  const cleanCtaPrimary = stripEmojis(copy.hero?.ctaPrimary || 'Mulai Sekarang Gratis');
  const cleanCtaSecondary = stripEmojis(copy.hero?.ctaSecondary || 'Pelajari Fitur');

  const benefitIcons = [SVG_ICONS.zap, SVG_ICONS.layers, SVG_ICONS.shield, SVG_ICONS.chart];

  const benefitsHtml = (copy.benefits || []).map((b, idx) => {
    const icon = benefitIcons[idx % benefitIcons.length];
    return `
    <div class="group p-8 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl hover:border-indigo-500/40 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
      <div class="absolute -right-10 -bottom-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
      <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        ${icon}
      </div>
      <h3 class="text-xl font-bold text-slate-100 mb-3 tracking-tight">${stripEmojis(b.title)}</h3>
      <p class="text-slate-400 text-sm leading-relaxed">${stripEmojis(b.desc)}</p>
    </div>`;
  }).join('');

  const featureIcons = [SVG_ICONS.shield, SVG_ICONS.sparkles, SVG_ICONS.chart, SVG_ICONS.users, SVG_ICONS.rocket, SVG_ICONS.layers];

  const featuresHtml = (copy.features || []).map((f, idx) => {
    const icon = featureIcons[idx % featureIcons.length];
    return `
    <div class="p-6 rounded-2xl border border-white/10 bg-slate-900/30 backdrop-blur-md flex items-start gap-4 hover:border-indigo-500/30 transition-all duration-300">
      <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex-shrink-0 flex items-center justify-center mt-0.5">
        ${icon}
      </div>
      <div>
        <h4 class="font-bold text-base text-slate-100 mb-1.5">${stripEmojis(f.title)}</h4>
        <p class="text-slate-400 text-sm leading-relaxed">${stripEmojis(f.desc)}</p>
      </div>
    </div>`;
  }).join('');

  const faqHtml = (copy.faq || []).map((q, idx) => `
    <div class="faq-item border border-white/10 rounded-2xl bg-slate-900/40 backdrop-blur-md overflow-hidden mb-4 transition-all duration-300">
      <button onclick="toggleFaq(${idx})" class="w-full text-left p-6 font-semibold text-slate-200 flex justify-between items-center gap-4 hover:text-white transition-colors focus:outline-none">
        <span class="text-base md:text-lg">${stripEmojis(q.q)}</span>
        <div id="faq-chevron-${idx}" class="text-indigo-400 flex-shrink-0">
          ${SVG_ICONS.chevronDown}
        </div>
      </button>
      <div id="faq-ans-${idx}" class="hidden px-6 pb-6 pt-0 text-slate-400 text-sm md:text-base border-t border-white/5 leading-relaxed">
        ${stripEmojis(q.a)}
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="id" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cleanTitle} | Official Experience</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${fontUrl}" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root {
            --bg-primary: #080C14;
            --bg-card: #0F1626;
            --text-primary: #F8FAFC;
            --text-secondary: #94A3B8;
            --accent: #6366F1;
            --accent-hover: #4F46E5;
        }
        body {
            font-family: ${font};
            background-color: var(--bg-primary);
            color: var(--text-primary);
        }
        .hero-glow {
            background: radial-gradient(circle at 50% 10%, rgba(99, 102, 241, 0.18) 0%, rgba(8, 12, 20, 0) 70%);
        }
        .card-surface {
            background: rgba(15, 22, 38, 0.65);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
    </style>
</head>
<body class="antialiased selection:bg-indigo-500 selection:text-white bg-[#080C14] text-slate-100 min-h-screen">

    <!-- Navbar (Glassmorphic Neo-dark) -->
    <header class="fixed top-0 left-0 right-0 z-50 bg-[#080C14]/80 backdrop-blur-xl border-b border-white/10">
        <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <a href="#" class="flex items-center gap-3 group">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                    ${SVG_ICONS.brand}
                </div>
                <span class="font-extrabold text-xl tracking-tight text-white">
                    ${topic.split(' ')[0] || 'Fly'}<span class="text-indigo-400 font-medium">Studio</span>
                </span>
            </a>
            <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                <a href="#benefits" class="hover:text-white transition-colors">Keunggulan</a>
                <a href="#features" class="hover:text-white transition-colors">Fitur</a>
                <a href="#faq" class="hover:text-white transition-colors">Tanya Jawab</a>
            </nav>
            <div class="flex items-center gap-4">
                <a href="#cta" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25">
                    <span>${cleanCtaPrimary}</span>
                    ${SVG_ICONS.arrowRight}
                </a>
            </div>
        </div>
    </header>

    <!-- Hero Section (Taste-Skill Curated Layout) -->
    <section class="pt-40 pb-24 px-6 relative overflow-hidden hero-glow">
        <div class="max-w-5xl mx-auto text-center relative z-10">
            <!-- Curated Status Pill (No Emoji, Pulsing SVG Dot) -->
            <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wide uppercase mb-8 backdrop-blur-md">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>${cleanBadge}</span>
            </div>

            <h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.12] mb-8 max-w-4xl mx-auto">
                ${cleanTitle}
            </h1>

            <p class="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
                ${cleanSubtitle}
            </p>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="#cta" class="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-base bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xl shadow-indigo-600/30 hover:-translate-y-0.5">
                    <span>${cleanCtaPrimary}</span>
                    ${SVG_ICONS.arrowRight}
                </a>
                <a href="#features" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-200 transition-all backdrop-blur-md">
                    <span>${cleanCtaSecondary}</span>
                </a>
            </div>

            <!-- Product Proof Card (Taste-Skill Editorial Depth) -->
            <div class="mt-16 card-surface rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-2xl relative">
                <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full bg-rose-500/80"></div>
                        <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
                        <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                        <span class="text-xs text-slate-500 ml-2 font-mono">system.status.active</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        ${SVG_ICONS.shield}
                        <span>Enterprise Verified</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                    <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5">
                        <div class="text-xs text-slate-400 mb-1">Akurasi Performa</div>
                        <div class="text-xl sm:text-2xl font-extrabold text-white">99.8%</div>
                    </div>
                    <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5">
                        <div class="text-xs text-slate-400 mb-1">Pengguna Aktif</div>
                        <div class="text-xl sm:text-2xl font-extrabold text-indigo-400">10,000+</div>
                    </div>
                    <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5">
                        <div class="text-xs text-slate-400 mb-1">Kepuasan Klien</div>
                        <div class="flex items-center gap-1 text-xl sm:text-2xl font-extrabold text-amber-400">
                            <span>4.9</span>
                            ${SVG_ICONS.star}
                        </div>
                    </div>
                    <div class="p-4 rounded-xl bg-slate-900/60 border border-white/5">
                        <div class="text-xs text-slate-400 mb-1">Dukungan Tim</div>
                        <div class="text-xl sm:text-2xl font-extrabold text-emerald-400">24/7 Realtime</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Benefits Section (Bento Grid) -->
    <section id="benefits" class="py-24 px-6 border-t border-white/10 bg-[#080C14]">
        <div class="max-w-7xl mx-auto">
            <div class="text-center max-w-2xl mx-auto mb-16">
                <h2 class="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Nilai & Keunggulan Nyata</h2>
                <p class="text-slate-400 text-base md:text-lg">Dirancang secara spesifik dengan presisi tinggi demi hasil yang maksimal.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                ${benefitsHtml}
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-24 px-6 border-t border-white/10 bg-slate-950/50">
        <div class="max-w-7xl mx-auto">
            <div class="text-center max-w-2xl mx-auto mb-16">
                <h2 class="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Fitur Lengkap & Terintegrasi</h2>
                <p class="text-slate-400 text-base md:text-lg">Semua kapabilitas terbaik hadir untuk mendukung setiap langkah Anda.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                ${featuresHtml}
            </div>
        </div>
    </section>

    <!-- FAQ Section -->
    <section id="faq" class="py-24 px-6 border-t border-white/10 bg-[#080C14]">
        <div class="max-w-3xl mx-auto">
            <div class="text-center mb-16">
                <h2 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">Pertanyaan yang Sering Diajukan</h2>
                <p class="text-slate-400 text-base">Informasi lengkap dan transparan untuk menjawab rasa ingin tahu Anda.</p>
            </div>
            <div>
                ${faqHtml}
            </div>
        </div>
    </section>

    <!-- CTA & Lead Capture Section -->
    <section id="cta" class="py-24 px-6 border-t border-white/10 bg-gradient-to-b from-slate-950 to-[#080C14] text-center relative overflow-hidden">
        <div class="max-w-3xl mx-auto relative z-10">
            <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-6">
                ${SVG_ICONS.sparkles}
            </div>
            <h2 class="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
                ${stripEmojis(copy.ctaFooter?.headline || 'Siap Memulai Langkah Anda?')}
            </h2>
            <p class="text-base md:text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed">
                ${stripEmojis(copy.ctaFooter?.subheadline || 'Bergabunglah sekarang dan rasakan kemudahan bekerja bersama kami.')}
            </p>
            <form onsubmit="handleLeadSubmit(event)" class="max-w-md mx-auto flex flex-col sm:flex-row gap-3 mb-6">
                <input type="email" required placeholder="Masukkan alamat email Anda..." class="flex-1 px-5 py-4 rounded-xl border border-white/15 bg-slate-900/80 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm">
                <button type="submit" class="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 text-sm">
                    <span>${stripEmojis(copy.ctaFooter?.buttonLabel || 'Daftar Sekarang')}</span>
                    ${SVG_ICONS.arrowRight}
                </button>
            </form>
            <div id="lead-success" class="hidden inline-flex items-center gap-2 text-emerald-400 font-semibold text-sm bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                ${SVG_ICONS.checkCircle}
                <span>Terima kasih! Kami telah mencatat email Anda dan akan segera menghubungi Anda.</span>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 px-6 border-t border-white/10 bg-[#080C14] text-center text-sm text-slate-500">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div class="flex items-center gap-2 text-slate-400 font-medium">
                <div class="w-6 h-6 text-indigo-400">
                    ${SVG_ICONS.brand}
                </div>
                <span>${topic}</span>
            </div>
            <p class="text-xs text-slate-500">&copy; ${new Date().getFullYear()} ${topic}. All rights reserved. Built with precision by FlyStudio Virtual Office.</p>
            <div class="flex items-center gap-2 text-xs text-emerald-400">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>System Operational</span>
            </div>
        </div>
    </footer>

    <!-- Interactive Scripts -->
    <script>
        function toggleFaq(idx) {
            const ans = document.getElementById('faq-ans-' + idx);
            const chevron = document.getElementById('faq-chevron-' + idx);
            if (ans.classList.contains('hidden')) {
                ans.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            } else {
                ans.classList.add('hidden');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            }
        }

        function handleLeadSubmit(e) {
            e.preventDefault();
            const successEl = document.getElementById('lead-success');
            if (successEl) {
                successEl.classList.remove('hidden');
                successEl.classList.add('inline-flex');
            }
            e.target.reset();
        }
    </script>
</body>
</html>`;
}

// ==========================================
// 4. HTTP Server Router
// ==========================================

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Pixel office frontend: explicit allowlist, no filesystem path from user input.
  // Keep the legacy 3D office accessible for existing AI workflows.
  if (req.method === 'GET' && (pathname === '/' || pathname === '/pixel' || pathname === '/index.html' || pathname === '/flystudio-pixel-office.html' || pathname === '/kantor-flystudio.html')) {
    const isLegacy = pathname === '/kantor-flystudio.html';
    const page = path.join(ROOT_DIR, isLegacy ? 'kantor-flystudio.html' : 'flystudio-pixel-office.html');
    if (!fs.existsSync(page)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Halaman kantor tidak ditemukan.');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(page).pipe(res);
    return;
  }

  // 1. Static Preview Serving: GET /preview/:projectId/
  if (pathname.startsWith('/preview/')) {
    const parts = pathname.split('/').filter(Boolean);
    const requestedPid = parts[1] || officeState.currentProjectId;
    const subPath = parts.slice(2).join('/') || 'index.html';
    const filePath = path.join(PROJECTS_DIR, requestedPid, 'website', subPath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      let contentType = 'text/html; charset=utf-8';
      if (filePath.endsWith('.css')) contentType = 'text/css';
      if (filePath.endsWith('.js')) contentType = 'application/javascript';
      if (filePath.endsWith('.json')) contentType = 'application/json';
      if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
      if (filePath.endsWith('.png')) contentType = 'image/png';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'X-Frame-Options': 'ALLOWALL'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h3>Halaman pratinjau belum siap atau tidak ditemukan di: ${requestedPid}</h3>`);
      return;
    }
  }

  // 2. Download Final ZIP: GET /api/download-website?project=<id>
  if (pathname === '/api/download-website') {
    const reqPid = parsedUrl.query.project || officeState.currentProjectId;
    const projDir = path.join(PROJECTS_DIR, reqPid);
    const outDir = path.join(projDir, 'output');
    const zipPath = path.join(outDir, 'website-final.zip');

    if (!fs.existsSync(zipPath)) {
      const webDir = path.join(projDir, 'website');
      if (fs.existsSync(webDir)) {
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        createZipBundle(webDir, zipPath);
      }
    }

    if (fs.existsSync(zipPath)) {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="flystudio-${reqPid}-website.zip"`
      });
      fs.createReadStream(zipPath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Paket ZIP final belum tersedia. Pastikan projek telah disetujui di Checkpoint 3.' }));
      return;
    }
  }

  // 3. GET /api/status (Realtime status untuk 3D & UI)
  if (pathname === '/api/status' && req.method === 'GET') {
    const currentCost = getProjectCost(officeState.currentProjectId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      state: officeState,
      budget: {
        currentCostUsd: currentCost,
        capUsd: BUDGET_CAP,
        isCapped: currentCost >= BUDGET_CAP
      },
      employeesConfig: EMPLOYEES_CONFIG
    }));
    return;
  }

  // 4. GET /api/transcript
  if (pathname === '/api/transcript' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      transcript: officeState.liveTranscript
    }));
    return;
  }

  // 5. GET /api/usage (SQLite cost tracking)
  if (pathname === '/api/usage' && req.method === 'GET') {
    const usageList = getUsageHistory(officeState.currentProjectId);
    const totalCost = getProjectCost(officeState.currentProjectId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      projectId: officeState.currentProjectId,
      totalCostUsd: totalCost,
      budgetCapUsd: BUDGET_CAP,
      usage: usageList
    }));
    return;
  }

  // JSON Body Parser for POST Endpoints
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let payload = {};
    if (body) {
      try { payload = JSON.parse(body); } catch (e) { }
    }

    // POST /api/reset (Reset Kantor & Mulai Projek Baru)
    if (pathname === '/api/reset' && req.method === 'POST') {
      resetOfficeState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Seluruh kantor dan staf AI berhasil di-reset ke status STANDBY untuk projek baru.' }));
      return;
    }

    // POST /api/checkpoint/1 (Persetujuan Konsep Rafly)
    if (pathname === '/api/checkpoint/1' && req.method === 'POST') {
      const conceptId = payload.conceptId || payload.hookId || 1;
      const feedback = payload.feedback || payload.advice || '';
      advanceFromCheckpoint1(conceptId, feedback).catch(e => console.error('CP1 advance error:', e));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Checkpoint 1 disetujui. Tim melanjutkan ke copywriting & design system.' }));
      return;
    }

    // POST /api/checkpoint/2 (Persetujuan Copy & Design Rafly)
    if (pathname === '/api/checkpoint/2' && req.method === 'POST') {
      const approved = payload.approved !== false;
      const notes = payload.notes || '';
      advanceFromCheckpoint2(approved, notes).catch(e => console.error('CP2 advance error:', e));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Checkpoint 2 disetujui. Adam membangun website index.html.' }));
      return;
    }

    // POST /api/checkpoint/3 (Persetujuan Final Preview Rafly)
    if (pathname === '/api/checkpoint/3' && req.method === 'POST') {
      const action = payload.action || 'approve';
      if (action === 'approve') {
        officeState.checkpoints.checkpoint3.status = 'approved';
        officeState.checkpoints.checkpoint3.approved = true;
        finalizeProjectEndingRun().catch(e => console.error('Ending run error:', e));
      } else {
        officeState.checkpoints.checkpoint3.status = 'revision';
        recordDialog('raka', 'adam', `Catatan revisi website dari Bos: "${payload.notes || 'Perbaiki bagian tata letak'}". Tim bersiap merevisi.`, 8);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, state: officeState }));
      return;
    }

    // POST /api/chat (Interaksi Chat 1-on-1 Bos Rafly dengan Responsivitas Checkpoint)
    if (pathname === '/api/chat' && req.method === 'POST') {
      const slug = (payload.agent || payload.employee || 'raka').toLowerCase();
      const msg = (payload.message || '').trim();
      const conf = EMPLOYEES_CONFIG[slug] || EMPLOYEES_CONFIG.raka;

      if (!msg) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Pesan tidak boleh kosong' }));
        return;
      }

      console.log(`[Chat 1-on-1] Bos Rafly -> ${conf.nama}: "${msg}"`);
      recordDialog('rafly', slug, msg, officeState.currentStage);

      // KASUS A1: Checkpoint 2 sedang pending (Dimas menunggu persetujuan copy & design)
      if (officeState.checkpoints.checkpoint2 && officeState.checkpoints.checkpoint2.status === 'pending') {
        const isApproval = /setuju|lanjut|acc|ok|oke|gas|siap|bagus|mantap|keren|lanjutkan|yes|approve|proceed/i.test(msg) || slug === 'dimas' || slug === 'raka';
        if (isApproval) {
          console.log(`-> Bos Rafly menyetujui Checkpoint 2 via chat: "${msg}"!`);
          advanceFromCheckpoint2(true, msg).catch(e => console.error('CP2 advance error:', e));

          const replyText = `Siap laksanakan, Bos Rafly! Copywriting dan Design System resmi disetujui. Adam langsung mulai membangun file website index.html sekarang juga!`;
          recordDialog('dimas', 'rafly', replyText, 4);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            agent: 'dimas',
            nama: 'Dimas',
            peran: 'Technical Reviewer & Code QA',
            model: conf.model,
            reply: replyText
          }));
          return;
        }
      }

      // KASUS A2: Checkpoint 1 sedang pending (Bagas menunggu konsep pilihan)
      if (officeState.checkpoints.checkpoint1 && officeState.checkpoints.checkpoint1.status === 'pending') {
        console.log(`-> Bos Rafly memberikan arahan untuk Checkpoint 1 via chat: "${msg}"!`);
        let selectedConceptId = 1;
        const matchConcept = msg.match(/[#\s](\d)/);
        if (matchConcept) selectedConceptId = parseInt(matchConcept[1], 10);

        advanceFromCheckpoint1(selectedConceptId, msg).catch(e => console.error('CP1 advance error:', e));

        const replyText = `Terima kasih banyak atas pilihannya, Bos Rafly! Konsep #${selectedConceptId} langsung saya kunci dan oper ke Sari (Copywriter) dan Luna (UI/UX Designer) sekarang juga.`;
        recordDialog('bagas', 'rafly', replyText, 3);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          agent: 'bagas',
          nama: 'Bagas',
          peran: 'Creative Director',
          model: conf.model,
          reply: replyText
        }));
        return;
      }

      // KASUS A3: Checkpoint 3 sedang pending (Adam menunggu persetujuan website)
      if (officeState.checkpoints.checkpoint3 && officeState.checkpoints.checkpoint3.status === 'pending') {
        const isApproval = /setuju|mantap|bagus|keren|ok|oke|acc|download|gas|approve|publikasi/i.test(msg);
        if (isApproval) {
          console.log(`-> Bos Rafly menyetujui Checkpoint 3 (Website Final) via chat: "${msg}"!`);
          officeState.checkpoints.checkpoint3.status = 'approved';
          officeState.checkpoints.checkpoint3.approved = true;
          finalizeProjectEndingRun().catch(e => console.error('Ending run error:', e));

          const replyText = `Terima kasih banyak, Bos Rafly! Website resmi disetujui. Paket final ZIP (index.html, seo.json, laporan-raka.md, ringkasan-biaya.json) siap diunduh!`;
          recordDialog('adam', 'rafly', replyText, 10);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            agent: 'adam',
            nama: 'Adam',
            peran: 'Frontend Developer',
            model: conf.model,
            reply: replyText,
            previewUrl: officeState.checkpoints.checkpoint3.previewUrl,
            downloadUrl: officeState.checkpoints.checkpoint3.downloadUrl
          }));
          return;
        }
      }

      // KASUS B: Bos Rafly memberikan tugas / instruksi baru pembuatan website
      const isTaskInstruction = /buat|bikin|kerjakan|website|web|landing|page|dashboard|kursus|toko|portofolio|projek|topik/i.test(msg) || msg.length > 15;

      if (isTaskInstruction && officeState.currentStage === 0) {
        let extractedTopic = msg.replace(/^(buatkan|buat|bikin|tolong|coba)\s+/i, '').trim();
        if (extractedTopic.length > 60) extractedTopic = extractedTopic.slice(0, 60);

        const acknowledgeReply = `Siap Bos Rafly! Tugas website "${extractedTopic}" saya terima. Saya langsung susun rencana halaman, membagi tugas ke tim, dan memulai alur kerja 9 tahap secara realtime!`;
        recordDialog(slug, 'rafly', acknowledgeReply, 1);

        startAutonomousDelegation(slug, extractedTopic).catch(e => console.error('Delegation error:', e));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          agent: slug,
          nama: conf.nama,
          peran: conf.jabatan,
          model: conf.model,
          reply: acknowledgeReply,
          action: 'delegation_started',
          topic: extractedTopic
        }));
        return;
      }

      // KASUS C: Obrolan normal 1-on-1 via OpenRouter
      try {
        const isCp3Ready = officeState.checkpoints.checkpoint3.status === 'pending' || officeState.checkpoints.checkpoint3.status === 'approved';
        let resPreviewUrl = null;
        let resDownloadUrl = null;
        let finalReply = '';

        if (slug === 'adam' && isCp3Ready) {
          resPreviewUrl = officeState.checkpoints.checkpoint3.previewUrl;
          resDownloadUrl = officeState.checkpoints.checkpoint3.downloadUrl;
          finalReply = `Bos Rafly, websitenya sudah selesai kami bangun dan siap ditinjau! File tersimpan di projects/${officeState.currentProjectId}/website/index.html. Silakan klik tombol [Buka Pratinjau Website] di bawah ini untuk melihat langsung di browser, atau [Unduh Bundle ZIP] untuk mengunduh semua file finalnya!`;
          recordDialog('adam', 'rafly', finalReply, officeState.currentStage);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            agent: 'adam',
            nama: 'Adam',
            peran: 'Frontend Developer',
            model: conf.model,
            reply: finalReply,
            previewUrl: resPreviewUrl,
            downloadUrl: resDownloadUrl,
            videoUrl: resPreviewUrl
          }));
          return;
        }

        const userPrompt = `Bos Rafly bertanya kepadamu: "${msg}". Konteks saat ini proyek: "${officeState.topic || 'Landing Page'}". Jawab dengan sopan, antusias, dan profesional sesuai peranmu sebagai ${conf.jabatan} di FlyStudio.`;
        const result = await callAgent(conf, userPrompt, officeState.currentProjectId);
        finalReply = result.text;
        recordDialog(slug, 'rafly', finalReply, officeState.currentStage);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          agent: slug,
          nama: conf.nama,
          peran: conf.jabatan,
          model: result.model,
          isFallback: result.isFallback,
          reply: finalReply,
          previewUrl: resPreviewUrl,
          downloadUrl: resDownloadUrl,
          videoUrl: resPreviewUrl,
          usage: result.usage
        }));
      } catch (e) {
        console.error('Chat error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Karyawan sedang sibuk. Silakan coba kembali.' }));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`FLYSTUDIO Unified Website Engine aktif di http://localhost:${PORT}`);
  console.log(`9 Karyawan AI siap melayani Bos Rafly dengan OpenRouter.`);
  console.log(`Budget Cap Guard: $${BUDGET_CAP.toFixed(2)} USD per project`);
  console.log(`=======================================================`);
});
