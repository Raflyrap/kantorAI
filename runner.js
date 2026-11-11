/**
 * FLYSTUDIO - Unified OpenRouter LLM Runner
 * - Single client for all 9 AI Employees
 * - Automatic Fallback if primary model fails
 * - SQLite Usage & Cost Tracking
 * - Budget Cap Guard ($1.50 per project)
 */

const https = require('https');
const path = require('path');
const fs = require('fs');
const { recordUsage, getProjectCost } = require('./db');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(l => {
      const clean = l.trim();
      if (!clean || clean.startsWith('#')) return;
      const idx = clean.indexOf('=');
      if (idx !== -1) {
        env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
      }
    });
  }
  return env;
}

const ENV = loadEnv();
const OPENROUTER_API_KEY = ENV.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || '';
const BUDGET_CAP = parseFloat(ENV.BUDGET_CAP_PER_PROJECT_USD || '1.50');

function makeOpenRouterRequest(selectedModel, messages, maxTokens = 1500) {
  return new Promise((resolve, reject) => {
    if (!OPENROUTER_API_KEY) {
      return reject(new Error('OPENROUTER_API_KEY tidak ditemukan di environment.'));
    }

    const payload = JSON.stringify({
      model: selectedModel,
      messages: messages,
      temperature: 0.7,
      max_tokens: maxTokens
    });

    const options = {
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost/kantor-kreatif/',
        'X-Title': 'FlyStudio Virtual Office'
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body);
            const text = parsed.choices?.[0]?.message?.content || '';
            const usage = parsed.usage || { prompt_tokens: 0, completion_tokens: 0 };
            resolve({
              success: true,
              text,
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              model: selectedModel
            });
          } catch (err) {
            reject(new Error(`Gagal parse JSON response: ${err.message}`));
          }
        } else {
          // Bersihkan error body agar tidak membocorkan credential
          const sanitizedErr = body.slice(0, 150).replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer ***');
          reject(new Error(`OpenRouter HTTP ${res.statusCode}: ${sanitizedErr}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout memanggil model ${selectedModel} (30s)`));
    });

    req.on('error', (err) => {
      reject(new Error(`Koneksi OpenRouter gagal: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Execute LLM call for a specific agent with Budget Guard & Fallback
 * @param {Object} agentConfig - { slug, nama, model, fallback_model, system_prompt }
 * @param {Array|string} inputMessages - User message or array of messages
 * @param {string} projectId - Project identifier for SQLite tracking
 * @param {Object} [overrideOptions] - Optional model override (e.g. for testing fallback)
 */
async function callAgent(agentConfig, inputMessages, projectId = 'default-project', overrideOptions = {}) {
  // 1. Budget Cap Guard
  const currentCost = getProjectCost(projectId);
  if (currentCost >= BUDGET_CAP) {
    throw new Error(`[BUDGET CAP REACHED] Biaya proyek saat ini ($${currentCost.toFixed(4)}) telah mencapai batas anggaran ($${BUDGET_CAP.toFixed(2)}). Menunggu persetujuan Rafly.`);
  }

  // 2. Format Messages with System Prompt
  const messages = [];
  if (agentConfig.system_prompt) {
    messages.push({ role: 'system', content: agentConfig.system_prompt });
  }

  if (typeof inputMessages === 'string') {
    messages.push({ role: 'user', content: inputMessages });
  } else if (Array.isArray(inputMessages)) {
    inputMessages.forEach(m => messages.push(m));
  }

  const primaryModel = overrideOptions.forceModel || agentConfig.model || 'openai/gpt-4o-mini';
  const fallbackModel = agentConfig.fallback_model || 'anthropic/claude-3.5-haiku';

  console.log(`[Runner] Memanggil agen: ${agentConfig.nama} (${agentConfig.slug}) | Model: ${primaryModel}`);

  // 3. Coba Model Utama
  try {
    const res = await makeOpenRouterRequest(primaryModel, messages, overrideOptions.maxTokens || 1500);
    const { cost, totalTokens } = recordUsage(
      projectId,
      agentConfig.slug,
      res.model,
      res.promptTokens,
      res.completionTokens,
      0 // is_fallback = false
    );

    return {
      success: true,
      text: res.text,
      agent: agentConfig.slug,
      nama: agentConfig.nama,
      model: res.model,
      isFallback: false,
      usage: {
        promptTokens: res.promptTokens,
        completionTokens: res.completionTokens,
        totalTokens,
        costUsd: cost,
        projectTotalCost: getProjectCost(projectId)
      }
    };
  } catch (err) {
    console.warn(`[Runner Fallback Triggered] Model utama (${primaryModel}) gagal: ${err.message}.`);
    console.log(`-> Mencoba otomatis fallback model: ${fallbackModel}`);

    // 4. Otomatis Panggil Fallback Model
    if (fallbackModel && fallbackModel !== primaryModel) {
      try {
        const fallbackRes = await makeOpenRouterRequest(fallbackModel, messages, overrideOptions.maxTokens || 1500);
        const { cost, totalTokens } = recordUsage(
          projectId,
          agentConfig.slug,
          fallbackRes.model,
          fallbackRes.promptTokens,
          fallbackRes.completionTokens,
          1 // is_fallback = true
        );

        return {
          success: true,
          text: fallbackRes.text,
          agent: agentConfig.slug,
          nama: agentConfig.nama,
          model: fallbackRes.model,
          isFallback: true,
          originalModel: primaryModel,
          fallbackReason: err.message,
          usage: {
            promptTokens: fallbackRes.promptTokens,
            completionTokens: fallbackRes.completionTokens,
            totalTokens,
            costUsd: cost,
            projectTotalCost: getProjectCost(projectId)
          }
        };
      } catch (errFallback) {
        throw new Error(`Model utama (${primaryModel}) dan fallback (${fallbackModel}) keduanya gagal. Error: ${errFallback.message}`);
      }
    }
    throw err;
  }
}

module.exports = {
  callAgent,
  BUDGET_CAP
};

