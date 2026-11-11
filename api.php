<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 1. Read .env file safely
function loadEnv($path = __DIR__ . '/.env') {
    if (!file_exists($path)) {
        // Try parent directory
        $parent = dirname(__DIR__) . '/.env';
        if (file_exists($parent)) $path = $parent;
        else return [];
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $env = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line, 2);
            $env[trim($key)] = trim($val);
        }
    }
    return $env;
}

$env = loadEnv();
$apiKey = $env['OPENROUTER_API_KEY'] ?? getenv('OPENROUTER_API_KEY') ?? '';

// Handle pre-check jika user mengirimkan API Key secara dinamis via payload
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?? $_POST;
$action = $data['action'] ?? $_GET['action'] ?? 'chat';

if (!empty($data['api_key'])) {
    $apiKey = trim($data['api_key']);
}

// ACTION: VERIFY API KEY OPENROUTER LANGSUNG KE OPENROUTER AUTH ENDPOINT
if ($action === 'verify_api_key' || $action === 'verify_key') {
    $testKey = trim($data['api_key'] ?? $apiKey);
    if (empty($testKey)) {
        echo json_encode(['success' => false, 'error' => 'API Key tidak boleh kosong.']);
        exit;
    }
    
    // Panggil https://openrouter.ai/api/v1/auth/key
    $ch = curl_init('https://openrouter.ai/api/v1/auth/key');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $testKey,
        'Content-Type: application/json'
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);
    
    if ($curlErr) {
        echo json_encode(['success' => false, 'error' => 'Gagal terhubung ke OpenRouter: ' . $curlErr]);
        exit;
    }
    
    $json = json_decode($resp, true);
    if ($httpCode === 200 && isset($json['data'])) {
        $keyData = $json['data'];
        $label = $keyData['label'] ?? 'OpenRouter Key';
        $usage = $keyData['usage'] ?? 0;
        $limit = $keyData['limit'] ?? null;
        $isFreeTier = ($keyData['is_free_tier'] ?? false);
        
        // Simpan key yang valid ke file .env
        $envPath = __DIR__ . '/.env';
        if (file_exists($envPath)) {
            $envContent = file_get_contents($envPath);
            if (strpos($envContent, 'OPENROUTER_API_KEY=') !== false) {
                $envContent = preg_replace('/OPENROUTER_API_KEY=.*/', 'OPENROUTER_API_KEY=' . $testKey, $envContent);
            } else {
                $envContent .= "\nOPENROUTER_API_KEY=" . $testKey . "\n";
            }
            file_put_contents($envPath, $envContent);
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'API Key valid & terverifikasi!',
            'label' => $label,
            'usage' => $usage,
            'limit' => $limit,
            'is_free_tier' => $isFreeTier
        ]);
        exit;
    } else {
        $errMsg = $json['error']['message'] ?? 'API Key salah atau tidak terdaftar di OpenRouter. Silakan periksa kembali.';
        echo json_encode(['success' => false, 'error' => $errMsg]);
        exit;
    }
}

if (empty($apiKey)) {
    echo json_encode([
        'success' => false,
        'error' => 'API Key OpenRouter belum diset di file .env'
    ]);
    exit;
}

// 2. Define Agent Personas & OpenRouter Models
$AGENTS = [
    'raka' => [
        'nama' => 'Raka',
        'peran' => 'Creative Director & Orchestrator',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Raka, Creative Director di FlyStudio. Bosmu bernama Rafly. Tugasmu menerima instruksi konten tutorial IT, membagi alur kerja ke tim, memantau kualitas konten, dan memberikan laporan profesional, solutif, dan ramah dalam bahasa Indonesia."
    ],
    'rina' => [
        'nama' => 'Rina',
        'peran' => 'Ahli Referensi & Research Analyst',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Rina, Ahli Referensi & Riset IT di FlyStudio. Bosmu bernama Rafly. Tugasmu mencari dokumentasi resmi teknologi (Docker, Git, Linux, MySQL, dll), memvalidasi konsep teknis, dan merangkum poin inti yang akurat untuk video tutorial."
    ],
    'bagas' => [
        'nama' => 'Bagas',
        'peran' => 'Strategist & Creative Ideator',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Bagas, Strategist & Ideator Kreatif di FlyStudio. Bosmu bernama Rafly. Tugasmu merancang hook 3 detik awal TikTok, sudut pandang unik, analogi yang mudah dicerna, dan format video yang memikat audiens pemula."
    ],
    'sari' => [
        'nama' => 'Sari',
        'peran' => 'Copywriter & Scriptwriter',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Sari, Copywriter & Scriptwriter di FlyStudio. Bosmu bernama Rafly. Tugasmu menyusun naskah tutorial per adegan (Scene 1 s/d 4) dengan kalimat pendek, to the point, santai, dan mudah diucapkan voiceover."
    ],
    'dimas' => [
        'nama' => 'Dimas',
        'peran' => 'Produser & Technical Reviewer',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Dimas, Produser & Technical Reviewer di FlyStudio. Bosmu bernama Rafly. Tugasmu menguji kode perintah di terminal CLI, memastikan semua sintaks 100% bebas error, dan memverifikasi kelayakan produksi video."
    ],
    'luna' => [
        'nama' => 'Luna',
        'peran' => 'Desainer Grafis & Visual',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Luna, Desainer Grafis di FlyStudio. Bosmu bernama Rafly. Tugasmu merancang komposisi visual vertikal 9:16, infografis terminal, palet warna, dan thumbnail eye-catching untuk TikTok."
    ],
    'kevin' => [
        'nama' => 'Kevin',
        'peran' => 'Art Director & Voice Producer',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Kevin, Art Director & Demo Voice Producer di FlyStudio. Bosmu bernama Rafly. Tugasmu mengatur ritme rekaman narasi suara TTS bahasa Indonesia, efek suara (SFX whoosh/chime), dan demo langkah demi langkah."
    ],
    'adam' => [
        'nama' => 'Adam',
        'peran' => 'Storyboard Artist & Video Editor',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Adam, Storyboard Artist & Video Editor di FlyStudio. Bosmu bernama Rafly. Tugasmu menggabungkan slide visual, kode terminal, rekaman audio narasi, dan subtitle karaoke menjadi video TikTok 9:16 siap posting."
    ],
    'nadia' => [
        'nama' => 'Nadia',
        'peran' => 'Content Planner & TikTok Growth',
        'model' => 'anthropic/claude-sonnet-5.5',
        'fallback_model' => 'anthropic/claude-3.5-haiku',
        'system' => "Kamu adalah Nadia, Content Planner & TikTok Growth di FlyStudio. Bosmu bernama Rafly. Tugasmu merancang caption TikTok, 3-5 hashtag algoritma FYP, jadwal posting, dan Call-to-Action untuk memancing komentar penonton."
    ]];

// Helper: Call OpenRouter API
function callOpenRouter($model, $messages, $apiKey, $fallbackModel = null) {
    $url = 'https://openrouter.ai/api/v1/chat/completions';
    
    $payload = json_encode([
        'model' => $model,
        'messages' => $messages,
        'temperature' => 0.7,
        'max_tokens' => 1200
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
        'HTTP-Referer: http://localhost/kantor-kreatif/',
        'X-Title: FlyStudio AI Office'
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 45);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200 || empty($response)) {
        // Fallback to simpler model if primary model fails (e.g., quota or timeout)
        if ($fallbackModel && $fallbackModel !== $model) {
            return callOpenRouter($fallbackModel, $messages, $apiKey, null);
        }
        return [
            'success' => false,
            'http_code' => $httpCode,
            'error' => $error ?: 'Gagal menghubungi model OpenRouter (' . $httpCode . '): ' . substr($response, 0, 150)
        ];
    }

    $json = json_decode($response, true);
    $content = $json['choices'][0]['message']['content'] ?? '';

    return [
        'success' => true,
        'content' => $content,
        'model_used' => $json['model'] ?? $model,
        'usage' => $json['usage'] ?? []
    ];
}

// 3. Process Request
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?? $_POST;
$action = $data['action'] ?? $_GET['action'] ?? 'chat';

// ACTION A: Chat with specific AI Agent
if ($action === 'chat') {
    $agentId = strtolower(trim($data['agent'] ?? 'raka'));
    $userMsg = trim($data['message'] ?? '');

    if (empty($userMsg)) {
        echo json_encode(['success' => false, 'error' => 'Pesan tidak boleh kosong']);
        exit;
    }

    if (!isset($AGENTS[$agentId])) {
        $agentId = 'raka';
    }

    $agent = $AGENTS[$agentId];
    $messages = [
        ['role' => 'system', 'content' => $agent['system']]
    ];

    // Optional conversation history
    if (!empty($data['history']) && is_array($data['history'])) {
        foreach (array_slice($data['history'], -6) as $h) {
            if (!empty($h['role']) && !empty($h['content'])) {
                $messages[] = ['role' => $h['role'], 'content' => $h['content']];
            }
        }
    }

    $messages[] = ['role' => 'user', 'content' => $userMsg];

    $result = callOpenRouter($agent['model'], $messages, $apiKey, $agent['fallback_model']);

    if (!$result['success']) {
        echo json_encode($result);
        exit;
    }

    echo json_encode([
        'success' => true,
        'agent' => $agentId,
        'nama' => $agent['nama'],
        'peran' => $agent['peran'],
        'model' => $result['model_used'],
        'reply' => $result['content'],
        'usage' => $result['usage']
    ]);
    exit;
}

// ACTION A.2: Group Chat di Meja Rapat (Karyawan Menjawab Diskusi Rapat)
if ($action === 'group_chat' || $action === 'meeting_chat') {
    $userMsg = trim($data['message'] ?? '');
    if (empty($userMsg)) {
        echo json_encode(['success' => false, 'error' => 'Pesan rapat tidak boleh kosong']);
        exit;
    }

    // Tentukan staf yang merespons (default: Raka Creative Director & Sari Copywriter)
    // Jika user menyebut nama tertentu (misal: dimas, luna, kevin, adam, nadia, rina, bagas), libatkan mereka
    $mentioned = [];
    $lowerMsg = strtolower($userMsg);
    foreach ($AGENTS as $k => $ag) {
        if (strpos($lowerMsg, strtolower($ag['nama'])) !== false || strpos($lowerMsg, $k) !== false) {
            $mentioned[] = $k;
        }
    }
    if (empty($mentioned)) {
        $selectedKeys = ['raka', 'sari'];
    } else {
        $selectedKeys = array_unique(array_slice($mentioned, 0, 3));
    }

    $colors = [
        'raka' => '#6366F1',
        'rina' => '#EC4899',
        'bagas' => '#3B82F6',
        'sari' => '#10B981',
        'dimas' => '#F59E0B',
        'luna' => '#8B5CF6',
        'kevin' => '#06B6D4',
        'adam' => '#F43F5E',
        'nadia' => '#14B8A6'
    ];

    $replies = [];
    foreach ($selectedKeys as $k) {
        $ag = $AGENTS[$k];
        $prompt = [
            ['role' => 'system', 'content' => "Kamu adalah {$ag['nama']}, bertindak sebagai {$ag['peran']} di FlyStudio yang dipimpin Bos Rafly. Saat ini sedang rapat pleno tim di meja rapat.\nBos Rafly berbicara: \"{$userMsg}\".\nJawab langsung, relevan, suportif, dan profesional dalam 1-2 kalimat bahasa Indonesia santai sesuai peranmu tanpa emoji."],
            ['role' => 'user', 'content' => $userMsg]
        ];
        $res = callOpenRouter($ag['model'], $prompt, $apiKey, $ag['fallback_model']);
        $textReply = $res['success'] ? $res['content'] : "Siap Bos Rafly, arahan sudah kami catat dan siap dieksekusi.";
        
        $replies[] = [
            'sender' => $ag['nama'] . ' (' . $ag['peran'] . ')',
            'role' => 'assistant',
            'color' => $colors[$k] ?? '#6366F1',
            'text' => $textReply,
            'model' => $res['model_used'] ?? $ag['model']
        ];
    }

    echo json_encode([
        'success' => true,
        'replies' => $replies
    ]);
    exit;
}

// ACTION B: Generate Full Video Tutorial Workflow
if ($action === 'generate_video' || $action === 'approve_video') {
    $topic = trim($data['topic'] ?? 'Tutorial Docker untuk Pemula');
    $approvedBy = trim($data['approved_by'] ?? 'Bos Rafly');
    $customInstruction = trim($data['instruction'] ?? '');

    $systemPrompt = "Kamu adalah sistem orkestrasi AI FlyStudio yang memproduksi video tutorial IT vertikal TikTok 9:16 (durasi 45-60 detik) untuk Bos Rafly.
Topik yang diberikan: '{$topic}'.
Instruksi tambahan Bos: '{$customInstruction}'.

Kamu HARUS menghasilkan struktur video TikTok 9:16 yang SANGAT AKURAT, LENGKAP, dan PAS dengan pembicaraan (narasi) dan demonstrasi teknisnya.
Format output WAJIB HANYA berupa JSON valid tanpa pembungkus markdown.

STRUKTUR JSON WAJIB:
{
  \"title\": \"Judul Padat & Eye-catching (Maks 7 kata)\",
  \"topic\": \"{$topic}\",
  \"hook\": \"Kalimat hook 3 detik pertama yang memicu rasa penasaran penonton\",
  \"duration\": \"50 detik\",
  \"total_scenes\": 4,
  \"approved_by\": \"{$approvedBy}\",
  \"status\": \"approved\",
  \"scenes\": [
    {
      \"scene\": 1,
      \"time\": \"0:00 - 0:08\",
      \"duration_sec\": 8,
      \"type\": \"hook_problem\",
      \"narasi\": \"Kalimat voiceover bahasa Indonesia santai, padat, dan jelas khas content creator IT\",
      \"subtitles\": [
        {\"text\": \"potongan kata 1\", \"start\": 0.0, \"end\": 2.0},
        {\"text\": \"potongan kata 2\", \"start\": 2.0, \"end\": 4.5},
        {\"text\": \"potongan kata 3\", \"start\": 4.5, \"end\": 8.0}
      ],
      \"visual\": \"Deskripsi visual animasi 9:16 yang muncul di layar\",
      \"code\": \"perintah terminal/CLI atau potongan kode IT nyata yang 100% akurat\",
      \"code_explanation\": \"Penjelasan singkat kode\",
      \"animation\": \"zoom_bounce\",
      \"transition\": \"slide_left\",
      \"sfx\": \"whoosh_pop\",
      \"layout\": \"hero_hook\"
    },
    {
      \"scene\": 2,
      \"time\": \"0:08 - 0:22\",
      \"duration_sec\": 14,
      \"type\": \"analogy_concept\",
      \"narasi\": \"Penjelasan konsep/analogi dengan bahasa mudah dipahami pemula\",
      \"subtitles\": [
        {\"text\": \"frasa 1\", \"start\": 0.0, \"end\": 4.5},
        {\"text\": \"frasa 2\", \"start\": 4.5, \"end\": 9.0},
        {\"text\": \"frasa 3\", \"start\": 9.0, \"end\": 14.0}
      ],
      \"visual\": \"Visual ilustrasi atau slide animasi konsep\",
      \"code\": \"perintah atau sintaks penting berikutnya\",
      \"code_explanation\": \"Penjelasan teknis yang akurat\",
      \"animation\": \"slide_fade\",
      \"transition\": \"slide_left\",
      \"sfx\": \"keyboard_typing\",
      \"layout\": \"terminal_preview\"
    },
    {
      \"scene\": 3,
      \"time\": \"0:22 - 0:40\",
      \"duration_sec\": 18,
      \"type\": \"code_demo\",
      \"narasi\": \"Langkah eksekusi praktis yang langsung berhasil dijalankan\",
      \"subtitles\": [
        {\"text\": \"frasa 1\", \"start\": 0.0, \"end\": 6.0},
        {\"text\": \"frasa 2\", \"start\": 6.0, \"end\": 12.0},
        {\"text\": \"frasa 3\", \"start\": 12.0, \"end\": 18.0}
      ],
      \"visual\": \"Tampilan Terminal interaktif MacOS style dengan status sukses hijau\",
      \"code\": \"perintah terminal inti yang menunjukkan hasil eksekusi sukses\",
      \"code_explanation\": \"Penjelasan output CLI\",
      \"animation\": \"typing_pulse\",
      \"transition\": \"zoom_in\",
      \"sfx\": \"success_chime\",
      \"layout\": \"terminal_focus\"
    },
    {
      \"scene\": 4,
      \"time\": \"0:40 - 0:50\",
      \"duration_sec\": 10,
      \"type\": \"conclusion_cta\",
      \"narasi\": \"Kesimpulan trik dan ajakan interaksi follow & komentar\",
      \"subtitles\": [
        {\"text\": \"frasa penutup 1\", \"start\": 0.0, \"end\": 5.0},
        {\"text\": \"frasa penutup 2\", \"start\": 5.0, \"end\": 10.0}
      ],
      \"visual\": \"Summary card dengan badge takeaway + tombol follow & save\",
      \"code\": \"rekap perintah atau link dokumentasi\",
      \"code_explanation\": \"Takeaway utama\",
      \"animation\": \"pop_badge\",
      \"transition\": \"fade_out\",
      \"sfx\": \"pop_bell\",
      \"layout\": \"cta_card\"
    }
  ],
  \"remotion_code_preview\": \"// Remotion Composition Component Code Ready\\nimport { AbsoluteFill, Sequence, Audio } from 'remotion';\",
  \"tiktok\": {
    \"caption\": \"Caption TikTok persuasif memancing komentar audiens IT\",
    \"hashtags\": [\"#BelajarCoding\", \"#TipsIT\", \"#TechTok\", \"#ProgrammerIndonesia\", \"#TutorialIT\"],
    \"cta\": \"Komen 'MAU' kalau butuh panduan lengkapnya!\",
    \"sound_recommendation\": \"Tech Beat Modern / Lo-Fi Upbeat Coding\"
  }
}";

    $messages = [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => "Bos {$approvedBy} menyetujui produksi video. Hasilkan video TikTok 9:16 lengkap dan akurat untuk: {$topic}"]
    ];

    // Panggil Claude Sonnet 5.5 sebagai model flagship terbaik dengan fallback Claude Sonnet 4.5
    $result = callOpenRouter('anthropic/claude-sonnet-5.5', $messages, $apiKey, 'anthropic/claude-sonnet-4.5');

    if (!$result['success']) {
        // Fallback ketiga ke gpt-4o-mini jika limit
        $result = callOpenRouter('openai/gpt-4o-mini', $messages, $apiKey);
        if (!$result['success']) {
            echo json_encode($result);
            exit;
        }
    }

    $raw = trim($result['content']);
    $raw = preg_replace('/^```(?:json)?\s*/i', '', $raw);
    $raw = preg_replace('/\s*```$/i', '', $raw);

    $videoData = json_decode($raw, true);
    if (!$videoData || empty($videoData['scenes'])) {
        // Fallback default berstruktur jika parser gagal
        $videoData = [
            'title' => "Tutorial {$topic}",
            'topic' => $topic,
            'hook' => "Masih bingung soal {$topic}? Tonton trik 50 detik ini!",
            'duration' => "50 detik",
            'total_scenes' => 4,
            'approved_by' => $approvedBy,
            'status' => 'approved',
            'scenes' => [
                [
                    'scene' => 1,
                    'time' => '0:00 - 0:08',
                    'duration_sec' => 8,
                    'type' => 'hook_problem',
                    'narasi' => "Kalian masih sering ribet konfigurasi {$topic} sampai pusing? Cukup pakai 1 trik praktis ini!",
                    'subtitles' => [
                        ['text' => "Masih ribet konfigurasi {$topic}?", 'start' => 0.0, 'end' => 4.0],
                        ['text' => "Pakai 1 trik praktis ini!", 'start' => 4.0, 'end' => 8.0]
                    ],
                    'visual' => "Animasi Hook Judul + Logo IT Bouncing",
                    'code' => "{$topic} --version",
                    'code_explanation' => "Verifikasi environment",
                    'animation' => 'zoom_bounce',
                    'transition' => 'slide_left',
                    'sfx' => 'whoosh_pop',
                    'layout' => 'hero_hook'
                ],
                [
                    'scene' => 2,
                    'time' => '0:08 - 0:24',
                    'duration_sec' => 16,
                    'type' => 'code_demo',
                    'narasi' => "Pertama, buka terminal kalian dan jalankan sintaks berikut. Langkah ini otomatis mengisolasi environment kalian tanpa merusak sistem laptop.",
                    'subtitles' => [
                        ['text' => "Buka terminal dan jalankan sintaks ini.", 'start' => 0.0, 'end' => 7.0],
                        ['text' => "Otomatis mengisolasi environment kalian!", 'start' => 7.0, 'end' => 16.0]
                    ],
                    'visual' => "Terminal Linux MacOS Style dengan syntax highlight",
                    'code' => "{$topic} run -d -p 8080:80 app-service",
                    'code_explanation' => "Menjalankan service",
                    'animation' => 'slide_fade',
                    'transition' => 'slide_left',
                    'sfx' => 'keyboard_typing',
                    'layout' => 'terminal_preview'
                ],
                [
                    'scene' => 3,
                    'time' => '0:24 - 0:40',
                    'duration_sec' => 16,
                    'type' => 'code_demo',
                    'narasi' => "Lalu periksa statusnya. Lihat, service langsung aktif dalam hitungan detik dan siap diakses di localhost!",
                    'subtitles' => [
                        ['text' => "Periksa status servicenya.", 'start' => 0.0, 'end' => 6.0],
                        ['text' => "Langsung aktif dalam hitungan detik di localhost!", 'start' => 6.0, 'end' => 16.0]
                    ],
                    'visual' => "Terminal output status UP (healthy) warna hijau",
                    'code' => "{$topic} ps",
                    'code_explanation' => "Status kontainer aktif",
                    'animation' => 'typing_pulse',
                    'transition' => 'zoom_in',
                    'sfx' => 'success_chime',
                    'layout' => 'terminal_focus'
                ],
                [
                    'scene' => 4,
                    'time' => '0:40 - 0:50',
                    'duration_sec' => 10,
                    'type' => 'conclusion_cta',
                    'narasi' => "Gampang banget kan? Jangan lupa follow untuk tips koding berikutnya dan save video ini biar nggak lupa!",
                    'subtitles' => [
                        ['text' => "Gampang banget kan?", 'start' => 0.0, 'end' => 4.0],
                        ['text' => "Follow & save video ini biar nggak lupa!", 'start' => 4.0, 'end' => 10.0]
                    ],
                    'visual' => "Summary card dengan tombol Follow & Bookmark",
                    'code' => "# Sukses! Akses http://localhost:8080",
                    'code_explanation' => "Selesai",
                    'animation' => 'pop_badge',
                    'transition' => 'fade_out',
                    'sfx' => 'pop_bell',
                    'layout' => 'cta_card'
                ]
            ],
            'tiktok' => [
                'caption' => "Tutorial {$topic} praktis dalam 50 detik! Praktis dan anti-ribet.",
                'hashtags' => ["#BelajarKoding", "#TipsIT", "#TechTok", "#ProgrammerIndonesia"],
                'cta' => "Ada pertanyaan seputar koding? Tulis di kolom komentar!",
                'sound_recommendation' => "Lo-Fi Coding Beats"
            ]
        ];
    }

    echo json_encode([
        'success' => true,
        'model' => $result['model_used'] ?? 'anthropic/claude-sonnet-5.5',
        'video' => $videoData
    ]);
    exit;
}
echo json_encode([
    'success' => false,
    'error' => 'Aksi tidak dikenali'
]);

