<?php
$config = require __DIR__ . '/config/models.php';
$karyawanList = $config['karyawan'];

// Model Specifications & Descriptions
$modelDetails = [
    'anthropic/claude-3.5-sonnet' => [
        'provider' => 'Anthropic',
        'context' => '200k tokens',
        'specialty' => 'Coding React/Remotion, Spatial Reasoning, Multi-step Orchestration, Naskah Alami',
        'badge' => 'Tier S - Paling Presisi'
    ],
    'deepseek/deepseek-r1' => [
        'provider' => 'DeepSeek',
        'context' => '64k tokens',
        'specialty' => 'Deep Research, Membaca Dokumentasi Panjang, Pemahaman Logika Teknis',
        'badge' => 'Tier S - Reasoning & Hemat'
    ],
    'openai/gpt-4o-mini' => [
        'provider' => 'OpenAI',
        'context' => '128k tokens',
        'specialty' => 'Cepat, Ringan, Kreatif, Hook Viral TikTok, SEO Hashtag',
        'badge' => 'Super Cepat & Murah'
    ],
    'qwen/qwen-2.5-coder-32b-instruct' => [
        'provider' => 'Alibaba Qwen',
        'context' => '32k tokens',
        'specialty' => 'Verifikasi Kode Bash, Python, Docker, Deteksi Bug Sintaks',
        'badge' => 'Spesialis Koding'
    ],
    'anthropic/claude-3.5-haiku' => [
        'provider' => 'Anthropic',
        'context' => '200k tokens',
        'specialty' => 'Desain SVG, Diagram Visual, Tata Letak Slide Cepat',
        'badge' => 'Cepat & Visual'
    ]
];
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konfigurasi Model OpenRouter - FlyStudio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0b0f19; color: #f1f5f9; }
    .mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="min-h-screen flex flex-col">

  <!-- Header -->
  <header class="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="index.php" class="flex items-center gap-2.5 group">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
            <i data-lucide="cpu" class="w-5 h-5 text-white"></i>
          </div>
          <div>
            <span class="text-sm font-bold text-white tracking-wide">FLYSTUDIO</span>
            <span class="text-xs text-indigo-400 font-semibold block">Model AI & LLM Hub</span>
          </div>
        </a>
      </div>

      <nav class="flex items-center gap-1.5 sm:gap-2">
        <a href="index.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
          <i data-lucide="layout-dashboard" class="w-4 h-4"></i> Kantor 3D
        </a>
        <a href="karyawan.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
          <i data-lucide="users" class="w-4 h-4"></i> Karyawan (9)
        </a>
        <a href="video.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
          <i data-lucide="video" class="w-4 h-4"></i> Studio Video 9:16
        </a>
        <a href="models.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30">
          <i data-lucide="cpu" class="w-4 h-4"></i> Model LLM
        </a>
      </nav>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto p-4 sm:p-6 w-full space-y-6">

    <!-- Top Info Card -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            1 OpenRouter API Key
          </span>
          <span class="text-xs text-slate-400">&bull; Multi-Model Routing</span>
        </div>
        <h1 class="text-xl font-bold text-white mt-1">Konfigurasi Model Tiap Karyawan AI</h1>
        <p class="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Setiap karyawan AI dipasangkan dengan model LLM spesifik yang paling unggul di fungsinya, namun semuanya ditenagai oleh 1 shared API Key OpenRouter yang tersimpan aman di <code class="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">.env</code>.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <a href="karyawan.php" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition">
          <i data-lucide="message-square" class="w-4 h-4"></i>
          <span>Chat dengan Karyawan</span>
        </a>
      </div>
    </div>

    <!-- Models Table / Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <?php foreach ($karyawanList as $k): 
        $details = $modelDetails[$k['model']] ?? [
          'provider' => 'OpenRouter',
          'context' => '128k',
          'specialty' => 'General AI Tasks',
          'badge' => 'Standard'
        ];
      ?>
        <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style="background: <?= $k['warna'] ?>;">
                  <?= strtoupper(substr($k['nama'], 0, 2)) ?>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white"><?= htmlspecialchars($k['nama']) ?></h3>
                  <p class="text-[11px] text-slate-400"><?= htmlspecialchars($k['jabatan']) ?></p>
                </div>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                <?= htmlspecialchars($details['badge']) ?>
              </span>
            </div>

            <div class="space-y-2 mt-4 pt-3 border-t border-slate-800/80">
              <div>
                <span class="text-[10px] uppercase font-bold text-slate-500 block">Model OpenRouter</span>
                <span class="text-xs font-mono font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 inline-block mt-0.5">
                  <?= htmlspecialchars($k['model']) ?>
                </span>
              </div>

              <div>
                <span class="text-[10px] uppercase font-bold text-slate-500 block">Keahlian Khusus</span>
                <p class="text-xs text-slate-300 leading-relaxed"><?= htmlspecialchars($details['specialty']) ?></p>
              </div>

              <div>
                <span class="text-[10px] uppercase font-bold text-slate-500 block">Ruangan</span>
                <span class="text-xs text-slate-400"><?= htmlspecialchars($k['ruang']) ?></span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span class="text-[10px] text-slate-500">Fallback: <?= htmlspecialchars(explode('/', $k['fallback_model'])[1] ?? $k['fallback_model']) ?></span>
            <a href="karyawan.php?id=<?= $k['slug'] ?>" class="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Chat <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

  </main>

  <script>
    lucide.createIcons();
  </script>
</body>
</html>

