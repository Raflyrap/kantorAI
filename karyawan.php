<?php
$config = require __DIR__ . '/config/models.php';
$karyawanList = $config['karyawan'];
$selected = $_GET['id'] ?? 'raka';
if (!isset($karyawanList[$selected])) {
    $selected = 'raka';
}
$current = $karyawanList[$selected];
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Direktori & Chat Karyawan AI - FlyStudio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0b0f19; color: #f1f5f9; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.6); }
    ::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.4); border-radius: 9999px; }
  </style>
</head>
<body class="min-h-screen flex flex-col">

  <!-- Top Navigation Header -->
  <header class="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="index.php" class="flex items-center gap-2.5 group">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition">
            <i data-lucide="users" class="w-5 h-5 text-white"></i>
          </div>
          <div>
            <span class="text-sm font-bold text-white tracking-wide">FLYSTUDIO</span>
            <span class="text-xs text-indigo-400 font-semibold block">Karyawan AI Hub</span>
          </div>
        </a>
      </div>

      <nav class="flex items-center gap-1.5 sm:gap-2">
        <a href="index.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
          <i data-lucide="layout-dashboard" class="w-4 h-4"></i> Kantor 3D
        </a>
        <a href="karyawan.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 text-white transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30">
          <i data-lucide="users" class="w-4 h-4"></i> Karyawan (9)
        </a>
        <a href="video.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
          <i data-lucide="video" class="w-4 h-4"></i> Studio Video 9:16
        </a>
        <a href="models.php" class="px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
          <i data-lucide="cpu" class="w-4 h-4"></i> Model LLM
        </a>
      </nav>
    </div>
  </header>

  <!-- Main Container -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

    <!-- Left Column: Karyawan Cards List (5 Cols) -->
    <section class="lg:col-span-5 flex flex-col gap-3">
      <div class="flex items-center justify-between mb-1">
        <div>
          <h2 class="text-base font-bold text-white">Daftar 9 Karyawan AI</h2>
          <p class="text-xs text-slate-400">Klik karyawan untuk mengobrol atau melihat tugasnya.</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          9 Online
        </span>
      </div>

      <div class="space-y-2.5 overflow-y-auto max-h-[calc(100vh-170px)] pr-1">
        <?php foreach ($karyawanList as $slug => $k): 
          $isActive = ($slug === $selected);
        ?>
          <a href="karyawan.php?id=<?= $slug ?>" class="block p-3.5 rounded-2xl border transition <?= $isActive ? 'bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700' ?>">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md" style="background: <?= $k['warna'] ?>;">
                  <?= strtoupper(substr($k['nama'], 0, 2)) ?>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-bold text-white truncate"><?= htmlspecialchars($k['nama']) ?></h3>
                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                  </div>
                  <p class="text-xs text-slate-400 truncate"><?= htmlspecialchars($k['jabatan']) ?></p>
                </div>
              </div>

              <span class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700 whitespace-nowrap">
                <?= htmlspecialchars(explode('/', $k['model'])[1] ?? $k['model']) ?>
              </span>
            </div>

            <p class="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
              <?= htmlspecialchars($k['deskripsi']) ?>
            </p>
          </a>
        <?php endforeach; ?>
      </div>
    </section>

    <!-- Right Column: Selected Employee Profile & Live Chat (7 Cols) -->
    <section class="lg:col-span-7 flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <!-- Profile Header -->
      <div class="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-13 h-13 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg" style="background: <?= $current['warna'] ?>; width: 50px; height: 50px;">
            <?= strtoupper(substr($current['nama'], 0, 2)) ?>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-white"><?= htmlspecialchars($current['nama']) ?></h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Siap Menjawab</span>
            </div>
            <p class="text-xs text-slate-400"><?= htmlspecialchars($current['jabatan']) ?> &bull; <span class="text-indigo-400"><?= htmlspecialchars($current['ruang']) ?></span></p>
          </div>
        </div>

        <div class="text-right">
          <div class="text-[10px] uppercase font-bold text-slate-500">Model OpenRouter</div>
          <span class="text-xs font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded-lg inline-block mt-0.5">
            <?= htmlspecialchars($current['model']) ?>
          </span>
        </div>
      </div>

      <!-- Chat Messages Container -->
      <div id="chat-messages" class="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs min-h-[350px] max-h-[500px]">
        <!-- Welcome Prompt Bubble from Agent -->
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0" style="background: <?= $current['warna'] ?>;">
            <?= strtoupper(substr($current['nama'], 0, 2)) ?>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold text-slate-200"><?= htmlspecialchars($current['nama']) ?></span>
              <span class="text-[10px] text-slate-500 font-mono"><?= htmlspecialchars($current['model']) ?></span>
            </div>
            <div class="bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-2xl rounded-tl-sm text-slate-200 leading-relaxed max-w-xl">
              Halo Mas Rafly! Saya <b><?= htmlspecialchars($current['nama']) ?></b> (<?= htmlspecialchars($current['jabatan']) ?>). Ada tugas atau pertanyaan seputar video tutorial IT yang ingin dibahas sekarang?
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Input Form -->
      <div class="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/95">
        <form id="chat-form" onsubmit="handleSend(event)" class="flex gap-2">
          <input 
            id="chat-input" 
            type="text" 
            placeholder="Ketik pertanyaan atau perintah untuk <?= htmlspecialchars($current['nama']) ?>..." 
            class="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          >
          <button 
            type="submit" 
            id="send-btn" 
            class="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-600/30"
          >
            <span>Kirim</span>
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
          </button>
        </form>
      </div>
    </section>

  </main>

  <script>
    const currentAgent = <?= json_encode($current['slug']) ?>;
    const currentName = <?= json_encode($current['nama']) ?>;
    const currentColor = <?= json_encode($current['warna']) ?>;
    const currentModel = <?= json_encode($current['model']) ?>;

    const chatHistory = [];

    async function handleSend(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;

      const container = document.getElementById('chat-messages');

      // Append User Message
      const userBubble = document.createElement('div');
      userBubble.className = 'flex items-start gap-3 justify-end';
      userBubble.innerHTML = `
        <div class="flex-1 text-right">
          <div class="flex items-center justify-end gap-2 mb-1">
            <span class="text-[10px] text-slate-500">Baru saja</span>
            <span class="font-bold text-indigo-400">Rafly (Bos)</span>
          </div>
          <div class="bg-indigo-600 text-white p-3.5 rounded-2xl rounded-tr-sm inline-block text-left leading-relaxed shadow-lg shadow-indigo-600/20 max-w-xl">
            ${escapeHtml(text)}
          </div>
        </div>
        <div class="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
          RF
        </div>
      `;
      container.appendChild(userBubble);
      input.value = '';
      container.scrollTop = container.scrollHeight;

      chatHistory.push({ role: 'user', content: text });

      // Typing Indicator
      const typingEl = document.createElement('div');
      typingEl.id = 'typing-indicator';
      typingEl.className = 'flex items-center gap-2 text-slate-400 text-xs italic pl-11';
      typingEl.innerHTML = `<span class="animate-pulse">Sedang berpikir dengan ${currentModel}...</span>`;
      container.appendChild(typingEl);
      container.scrollTop = container.scrollHeight;

      const sendBtn = document.getElementById('send-btn');
      sendBtn.disabled = true;

      try {
        const res = await fetch('api.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'chat',
            agent: currentAgent,
            message: text,
            history: chatHistory
          })
        });

        const data = await res.json();
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        sendBtn.disabled = false;

        if (data.success) {
          chatHistory.push({ role: 'assistant', content: data.reply });

          const aiBubble = document.createElement('div');
          aiBubble.className = 'flex items-start gap-3';
          aiBubble.innerHTML = `
            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0" style="background: ${currentColor};">
              ${currentName.substring(0, 2).toUpperCase()}
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-bold text-slate-200">${escapeHtml(data.nama)}</span>
                <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(data.model)}</span>
              </div>
              <div class="bg-slate-800/90 border border-slate-700/80 p-3.5 rounded-2xl rounded-tl-sm text-slate-200 leading-relaxed max-w-xl">
                ${escapeHtml(data.reply).replace(/\\n/g, '<br>')}
              </div>
            </div>
          `;
          container.appendChild(aiBubble);
          container.scrollTop = container.scrollHeight;
        } else {
          alert('Error: ' + (data.error || 'Gagal memproses pesan'));
        }
      } catch (err) {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        sendBtn.disabled = false;
        alert('Koneksi backend gagal: ' + err.message);
      }
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    lucide.createIcons();
  </script>
</body>
</html>

