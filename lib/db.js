// Banco de dados em arquivo JSON (dados/crm.json).
// Tudo fica em memória e é gravado no disco logo depois de cada alteração.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { seedData } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.CRM_DADOS || path.join(ROOT, 'dados'));
export const FILES_DIR = path.join(DATA_DIR, 'arquivos');
const DB_FILE = path.join(DATA_DIR, 'crm.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP_BACKUPS = 14;

export const uid = (p = '') => p + crypto.randomBytes(6).toString('hex');
export const now = () => new Date().toISOString();

const EMPTY = () => ({
  version: 1,
  rev: 0,
  settings: { workspaceName: 'Meu CRM', brandColor: '#1D4ED8', minutesPerAction: 2.5 },
  members: [],
  stages: [],
  origins: [],
  leads: [],
  interactions: [],
  history: [],
  tasks: [],
  files: [],
  automations: [],
  runs: [],
  notifications: [],
  counters: { lead: 0 },
});

export let db = EMPTY();

export function load() {
  fs.mkdirSync(FILES_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = { ...EMPTY(), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
  } else {
    db = { ...EMPTY(), ...seedData() };
    saveNow();
  }
  dailyBackup();
}

let timer = null;
export function save() {
  db.rev++;
  clearTimeout(timer);
  timer = setTimeout(saveNow, 150);
}

export function saveNow() {
  clearTimeout(timer);
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}

export function replaceAll(data) {
  db = { ...EMPTY(), ...data, rev: db.rev + 1 };
  saveNow();
}

function dailyBackup() {
  const day = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUP_DIR, `crm-${day}.json`);
  if (!fs.existsSync(target) && fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, target);
  const old = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(BACKUP_DIR, f));
}

// Histórico do lead (aba "Histórico" da ficha)
export function logHistory(leadId, text, kind = 'info') {
  db.history.push({ id: uid('h_'), leadId, text, kind, at: now() });
}

export function notify(text, leadId = null) {
  db.notifications.push({ id: uid('n_'), text, leadId, at: now(), read: false });
  if (db.notifications.length > 300) db.notifications = db.notifications.slice(-300);
}

export const byId = (list, id) => db[list].find(x => x.id === id);
