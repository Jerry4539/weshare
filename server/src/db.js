import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const TEMP_CHUNKS_DIR = path.resolve(__dirname, '../../temp_chunks');

// Ensure directories exist
for (const dir of [DATA_DIR, UPLOADS_DIR, TEMP_CHUNKS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const DEFAULT_DB = {
  adminConfig: {
    adminPin: 'Jerry_4539',
    guestRetentionDays: 7,
    maxUploadSizeBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    chunkSizeBytes: 10 * 1024 * 1024, // 10 MB per chunk
    siteName: 'WeShare Enterprise',
    autoPurgeEnabled: true
  },
  clients: [
    {
      id: 'client_vip_creative',
      name: 'Studio Nova Productions',
      slug: 'studio-nova',
      email: 'studio@novacreative.io',
      retentionPolicy: 'permanent', // 'permanent' or 'limited'
      retentionDays: null,
      maxUploadSizeGB: 10,
      createdAt: new Date().toISOString(),
      notes: 'Key agency client - indefinite permanent storage rights enabled'
    },
    {
      id: 'client_apex_media',
      name: 'Apex Media Agency',
      slug: 'apex-media',
      email: 'assets@apexmedia.co',
      retentionPolicy: 'limited',
      retentionDays: 14,
      maxUploadSizeGB: 10,
      createdAt: new Date().toISOString(),
      notes: 'Standard client - auto-delete files after 14 days'
    },
    {
      id: 'client_akash',
      name: 'Akash',
      slug: 'akash',
      email: 'akash@client.com',
      retentionPolicy: 'permanent',
      retentionDays: null,
      maxUploadSizeGB: 10,
      createdAt: new Date().toISOString(),
      notes: 'Priority client - permanent storage rights'
    }
  ],
  transfers: [],
  purgeLogs: []
};

class Database {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('Error reading database file, initializing defaults:', err);
    }
    this.save(DEFAULT_DB);
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }

  save(data = this.data) {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  getConfig() {
    return this.data.adminConfig;
  }

  updateConfig(updates) {
    this.data.adminConfig = { ...this.data.adminConfig, ...updates };
    this.save();
    return this.data.adminConfig;
  }

  // Clients
  getClients() {
    return this.data.clients;
  }

  getClientById(id) {
    return this.data.clients.find(c => c.id === id) || null;
  }

  getClientBySlug(slug) {
    return this.data.clients.find(c => c.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  createClient(clientData) {
    const id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newClient = {
      id,
      name: clientData.name.trim(),
      slug: (clientData.slug || clientData.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).toLowerCase(),
      email: clientData.email.trim(),
      retentionPolicy: clientData.retentionPolicy || 'limited', // 'permanent' | 'limited'
      retentionDays: clientData.retentionPolicy === 'permanent' ? null : Number(clientData.retentionDays || 7),
      maxUploadSizeGB: Number(clientData.maxUploadSizeGB || 10),
      createdAt: new Date().toISOString(),
      notes: clientData.notes || ''
    };
    this.data.clients.push(newClient);
    this.save();
    return newClient;
  }

  updateClient(id, updates) {
    const idx = this.data.clients.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const current = this.data.clients[idx];
    const retentionPolicy = updates.retentionPolicy ?? current.retentionPolicy;
    const retentionDays = retentionPolicy === 'permanent' ? null : Number(updates.retentionDays ?? current.retentionDays ?? 7);

    this.data.clients[idx] = {
      ...current,
      ...updates,
      retentionPolicy,
      retentionDays,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.clients[idx];
  }

  deleteClient(id) {
    const idx = this.data.clients.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.data.clients.splice(idx, 1);
    this.save();
    return true;
  }

  // Transfers
  getTransfers() {
    return this.data.transfers;
  }

  getTransferById(id) {
    return this.data.transfers.find(t => t.id === id) || null;
  }

  createTransfer(transferData) {
    this.data.transfers.unshift(transferData);
    this.save();
    return transferData;
  }

  updateTransfer(id, updates) {
    const idx = this.data.transfers.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.transfers[idx] = { ...this.data.transfers[idx], ...updates };
    this.save();
    return this.data.transfers[idx];
  }

  deleteTransfer(id) {
    const idx = this.data.transfers.findIndex(t => t.id === id);
    if (idx === -1) return false;

    // Delete folder from disk if exists
    const transferDir = path.join(UPLOADS_DIR, id);
    if (fs.existsSync(transferDir)) {
      try {
        fs.rmSync(transferDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`Error deleting folder ${transferDir}:`, err);
      }
    }

    this.data.transfers.splice(idx, 1);
    this.save();
    return true;
  }

  // Stats calculation
  getStats() {
    const transfers = this.data.transfers;
    const clients = this.data.clients;

    let totalSizeBytes = 0;
    let totalFiles = 0;
    let permanentTransfers = 0;
    let expiredTransfers = 0;
    let activeTransfers = 0;

    const now = new Date();

    for (const t of transfers) {
      totalSizeBytes += (t.totalSize || 0);
      totalFiles += (t.files ? t.files.length : 0);
      if (t.isPermanent) {
        permanentTransfers++;
      }
      if (t.status === 'expired' || (t.expiresAt && new Date(t.expiresAt) < now && !t.isPermanent)) {
        expiredTransfers++;
      } else if (t.status === 'ready') {
        activeTransfers++;
      }
    }

    return {
      totalTransfers: transfers.length,
      activeTransfers,
      permanentTransfers,
      expiredTransfers,
      totalSizeBytes,
      totalFiles,
      clientCount: clients.length,
      purgeCount: this.data.purgeLogs.length
    };
  }

  // Purge expired transfers according to client retention policy
  purgeExpiredTransfers() {
    const now = new Date();
    const purged = [];

    for (const t of this.data.transfers) {
      if (t.isPermanent) continue; // Never purge permanent transfers
      if (t.status === 'expired') continue;

      if (t.expiresAt && new Date(t.expiresAt) <= now) {
        const transferDir = path.join(UPLOADS_DIR, t.id);
        let freedBytes = t.totalSize || 0;

        if (fs.existsSync(transferDir)) {
          try {
            fs.rmSync(transferDir, { recursive: true, force: true });
          } catch (err) {
            console.error(`Purge error deleting directory ${transferDir}:`, err);
          }
        }

        t.status = 'expired';
        t.files = []; // Clean up file references
        purged.push({
          transferId: t.id,
          title: t.title,
          clientId: t.clientId,
          freedBytes,
          purgedAt: now.toISOString()
        });
      }
    }

    if (purged.length > 0) {
      this.data.purgeLogs.unshift(...purged);
      // Keep only last 100 purge logs
      if (this.data.purgeLogs.length > 100) {
        this.data.purgeLogs = this.data.purgeLogs.slice(0, 100);
      }
      this.save();
    }

    return purged;
  }
}

export const db = new Database();
export { UPLOADS_DIR, TEMP_CHUNKS_DIR, DATA_DIR };
