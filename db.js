/**
 * FLYSTUDIO - Database SQLite Manager
 * Uses Node.js native `node:sqlite` (DatabaseSync)
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'studio.db');
const db = new DatabaseSync(DB_PATH);

// Skema Biaya Perkiraan OpenRouter (per 1M tokens -> USD)
const MODEL_PRICING = {
  'openai/gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'anthropic/claude-sonnet-5.5': { prompt: 3.00, completion: 15.00 },
  'anthropic/claude-3.5-haiku': { prompt: 0.80, completion: 4.00 },
  'deepseek/deepseek-r1': { prompt: 0.55, completion: 2.19 },
  'qwen/qwen-2.5-coder-32b-instruct': { prompt: 0.07, completion: 0.16 },
  'meta-llama/llama-3.3-70b-instruct': { prompt: 0.12, completion: 0.30 },
  'deepseek/deepseek-coder': { prompt: 0.14, completion: 0.28 }
};

function calculateCost(model, promptTokens, completionTokens) {
  const pricing = MODEL_PRICING[model] || { prompt: 1.00, completion: 3.00 };
  const pCost = (promptTokens / 1_000_000) * pricing.prompt;
  const cCost = (completionTokens / 1_000_000) * pricing.completion;
  return Number((pCost + cCost).toFixed(6));
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      current_stage INTEGER DEFAULT 0,
      stage_name TEXT,
      checkpoint1_status TEXT DEFAULT 'idle',
      checkpoint2_status TEXT DEFAULT 'idle',
      checkpoint3_status TEXT DEFAULT 'idle',
      total_cost_usd REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      agent_slug TEXT NOT NULL,
      model_used TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0.0,
      is_fallback INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT,
      stage INTEGER,
      sender TEXT NOT NULL,
      sender_role TEXT,
      target TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('-> SQLite Database initialized at:', DB_PATH);
}

function recordUsage(projectId, agentSlug, modelUsed, promptTokens, completionTokens, isFallback = 0) {
  const totalTokens = (promptTokens || 0) + (completionTokens || 0);
  const cost = calculateCost(modelUsed, promptTokens, completionTokens);

  const stmt = db.prepare(`
    INSERT INTO usage (project_id, agent_slug, model_used, prompt_tokens, completion_tokens, total_tokens, cost_usd, is_fallback)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(projectId || 'default-project', agentSlug, modelUsed, promptTokens, completionTokens, totalTokens, cost, isFallback ? 1 : 0);

  // Update total cost di tabel projects jika ada
  try {
    const updateStmt = db.prepare(`
      UPDATE projects SET total_cost_usd = total_cost_usd + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    updateStmt.run(cost, projectId || 'default-project');
  } catch(e) {}

  return { cost, totalTokens };
}

function recordMessage(projectId, stage, sender, senderRole, target, message) {
  const stmt = db.prepare(`
    INSERT INTO messages (project_id, stage, sender, sender_role, target, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(projectId || 'default-project', stage || 0, sender, senderRole || '', target, message);
}

function getProjectCost(projectId) {
  const row = db.prepare(`
    SELECT SUM(cost_usd) as total_cost FROM usage WHERE project_id = ?
  `).get(projectId || 'default-project');
  return Number((row && row.total_cost ? row.total_cost : 0).toFixed(5));
}

function getUsageHistory(projectId) {
  return db.prepare(`
    SELECT * FROM usage WHERE project_id = ? ORDER BY id ASC
  `).all(projectId || 'default-project');
}

function getMessages(projectId) {
  return db.prepare(`
    SELECT * FROM messages WHERE project_id = ? ORDER BY id ASC
  `).all(projectId || 'default-project');
}

module.exports = {
  db,
  initDb,
  recordUsage,
  recordMessage,
  getProjectCost,
  getUsageHistory,
  getMessages,
  calculateCost
};

