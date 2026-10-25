import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import archiver from 'archiver';
import { db, UPLOADS_DIR, TEMP_CHUNKS_DIR } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer for chunk uploads (saved to temp_chunks)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { id } = req.params;
    const { fileId } = req.body;
    const chunkDir = path.join(TEMP_CHUNKS_DIR, id, fileId || 'default');
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    const { chunkIndex } = req.body;
    cb(null, `chunk_${chunkIndex || 0}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB per chunk max

// ==========================================
// 1. PUBLIC & TRANSFER APIS
// ==========================================

// Get System Info / Limits
app.get('/api/info', (req, res) => {
  const config = db.getConfig();
  res.json({
    siteName: config.siteName,
    maxUploadSizeBytes: config.maxUploadSizeBytes,
    maxUploadSizeGB: Math.round(config.maxUploadSizeBytes / (1024 * 1024 * 1024)),
    chunkSizeBytes: config.chunkSizeBytes,
    guestRetentionDays: config.guestRetentionDays
  });
});

// Validate Client Slug or get Client Info
app.get('/api/client-lookup/:slug', (req, res) => {
  const client = db.getClientBySlug(req.params.slug);
  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({
    id: client.id,
    name: client.name,
    slug: client.slug,
    retentionPolicy: client.retentionPolicy,
    retentionDays: client.retentionDays,
    maxUploadSizeGB: client.maxUploadSizeGB
  });
});

// Dynamic Client Login / Sign In (No hardcoded names)
app.post('/api/client-login', (req, res) => {
  const { code, name, email } = req.body;
  const input = (code || name || email || '').trim();
  if (!input) {
    return res.status(400).json({ error: 'Please enter your client name or code' });
  }

  let client = db.getClientBySlug(input) ||
    db.getClients().find(c => c.email.toLowerCase() === input.toLowerCase() || c.name.toLowerCase() === input.toLowerCase());

  if (!client) {
    const clientName = name?.trim() || input;
    const clientEmail = email?.trim() || `${input.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`;
    client = db.createClient({
      name: clientName,
      slug: input.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      email: clientEmail,
      retentionPolicy: 'limited',
      retentionDays: 14,
      maxUploadSizeGB: 10
    });
  }

  res.json({
    id: client.id,
    name: client.name,
    slug: client.slug,
    email: client.email,
    retentionPolicy: client.retentionPolicy,
    retentionDays: client.retentionDays,
    maxUploadSizeGB: client.maxUploadSizeGB
  });
});

// Step 1: Initiate Transfer
app.post('/api/transfers/initiate', (req, res) => {
  try {
    const {
      title,
      message,
      senderEmail,
      recipientEmails,
      transferType = 'link',
      clientSlug,
      password,
      customExpiryDays,
      files = []
    } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Files array is required' });
    }

    const transferId = `tr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const config = db.getConfig();

    let client = null;
    let isPermanent = false;
    let retentionDays = config.guestRetentionDays || 7;

    if (clientSlug) {
      client = db.getClientBySlug(clientSlug);
      if (client) {
        if (client.retentionPolicy === 'permanent') {
          isPermanent = true;
          retentionDays = null;
        } else {
          retentionDays = client.retentionDays || retentionDays;
        }
      }
    }

    if (!isPermanent && customExpiryDays && Number(customExpiryDays) > 0) {
      // Allow custom expiry if less than or equal to max client retention or default
      retentionDays = Math.min(Number(customExpiryDays), retentionDays || 30);
    }

    let expiresAt = null;
    if (!isPermanent && retentionDays) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + retentionDays);
      expiresAt = expDate.toISOString();
    }

    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

    // Prepare transfer files metadata
    const preparedFiles = files.map((f, idx) => ({
      fileId: f.fileId || `file_${idx}_${Date.now()}`,
      name: f.name,
      relativePath: f.relativePath || f.name,
      size: f.size,
      mimeType: f.mimeType || mime.lookup(f.name) || 'application/octet-stream',
      status: 'pending'
    }));

    const transferData = {
      id: transferId,
      title: title?.trim() || `Transfer ${new Date().toLocaleDateString()}`,
      message: message?.trim() || '',
      senderEmail: senderEmail?.trim() || 'guest@weshare.io',
      recipientEmails: Array.isArray(recipientEmails) ? recipientEmails : (recipientEmails ? [recipientEmails] : []),
      transferType,
      clientId: client ? client.id : null,
      clientName: client ? client.name : null,
      isPermanent,
      retentionDays,
      expiresAt,
      createdAt: new Date().toISOString(),
      totalSize,
      fileCount: preparedFiles.length,
      status: 'uploading',
      password: password ? password.trim() : null,
      downloadCount: 0,
      files: preparedFiles
    };

    db.createTransfer(transferData);

    // Create transfer directory in uploads
    const transferDir = path.join(UPLOADS_DIR, transferId);
    if (!fs.existsSync(transferDir)) {
      fs.mkdirSync(transferDir, { recursive: true });
    }

    res.json({
      success: true,
      transferId,
      chunkSizeBytes: config.chunkSizeBytes,
      expiresAt,
      isPermanent,
      files: preparedFiles
    });
  } catch (err) {
    console.error('Error initiating transfer:', err);
    res.status(500).json({ error: 'Failed to initiate transfer' });
  }
});

// Step 2: Upload a single chunk for a file
app.post('/api/transfers/:id/upload-chunk', upload.single('chunk'), (req, res) => {
  try {
    const { id } = req.params;
    const { fileId, chunkIndex, totalChunks } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No chunk file received' });
    }

    res.json({
      success: true,
      transferId: id,
      fileId,
      chunkIndex: Number(chunkIndex),
      totalChunks: Number(totalChunks),
      receivedBytes: req.file.size
    });
  } catch (err) {
    console.error('Error uploading chunk:', err);
    res.status(500).json({ error: 'Chunk upload failed' });
  }
});

// Step 3: Assemble chunks into single complete file (Streaming merge, low RAM, 10GB safe)
app.post('/api/transfers/:id/assemble-file', async (req, res) => {
  try {
    const { id } = req.params;
    const { fileId, totalChunks } = req.body;

    const transfer = db.getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const fileMeta = transfer.files.find(f => f.fileId === fileId);
    if (!fileMeta) {
      return res.status(404).json({ error: 'File metadata not found' });
    }

    const chunkDir = path.join(TEMP_CHUNKS_DIR, id, fileId);
    const targetFile = path.join(UPLOADS_DIR, id, fileId);

    if (!fs.existsSync(chunkDir)) {
      return res.status(400).json({ error: 'No chunks found for this file' });
    }

    const numChunks = Number(totalChunks);
    const writeStream = fs.createWriteStream(targetFile, { flags: 'w' });

    for (let i = 0; i < numChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.end();
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }

      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    }

    writeStream.end();

    // Clean up temporary chunks
    try {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`Failed to clean temp chunks for ${fileId}:`, e);
    }

    // Update file status in DB
    fileMeta.status = 'completed';
    db.save();

    res.json({
      success: true,
      fileId,
      status: 'completed'
    });
  } catch (err) {
    console.error('Error assembling file:', err);
    res.status(500).json({ error: 'Failed to assemble file' });
  }
});

// Step 4: Finalize Transfer
app.post('/api/transfers/:id/finalize', (req, res) => {
  try {
    const { id } = req.params;
    const transfer = db.getTransferById(id);
    if (!transfer) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    transfer.status = 'ready';
    db.save();

    res.json({
      success: true,
      transfer: {
        id: transfer.id,
        title: transfer.title,
        message: transfer.message,
        isPermanent: transfer.isPermanent,
        expiresAt: transfer.expiresAt,
        totalSize: transfer.totalSize,
        fileCount: transfer.fileCount,
        files: transfer.files
      }
    });
  } catch (err) {
    console.error('Error finalizing transfer:', err);
    res.status(500).json({ error: 'Failed to finalize transfer' });
  }
});

// Step 5: Get Transfer Details for Download Page
app.get('/api/transfers/:id', (req, res) => {
  const transfer = db.getTransferById(req.params.id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found or has expired' });
  }

  // Check expiry
  if (!transfer.isPermanent && transfer.expiresAt && new Date(transfer.expiresAt) <= new Date()) {
    return res.status(410).json({
      error: 'This transfer has expired and its files have been purged in accordance with data retention policies.',
      expired: true
    });
  }

  const isPasswordProtected = !!transfer.password;
  const providedPassword = req.headers['x-transfer-password'];

  if (isPasswordProtected && providedPassword !== transfer.password) {
    return res.json({
      id: transfer.id,
      title: transfer.title,
      isPasswordProtected: true,
      isPermanent: transfer.isPermanent,
      expiresAt: transfer.expiresAt,
      fileCount: transfer.fileCount,
      totalSize: transfer.totalSize,
      senderEmail: transfer.senderEmail
    });
  }

  // Return full transfer details (strip password from response)
  const { password, ...safeTransfer } = transfer;
  res.json({
    ...safeTransfer,
    isPasswordProtected
  });
});

// Verify Password for a transfer
app.post('/api/transfers/:id/verify-password', (req, res) => {
  const { password } = req.body;
  const transfer = db.getTransferById(req.params.id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found' });
  }
  if (!transfer.password || transfer.password === password) {
    return res.json({ success: true, authorized: true });
  }
  return res.status(401).json({ success: false, error: 'Incorrect password' });
});

// Download Single File (Supports Range Requests for high speed streaming)
app.get('/api/transfers/:id/files/:fileId/download', (req, res) => {
  const { id, fileId } = req.params;
  const transfer = db.getTransferById(id);
  if (!transfer) {
    return res.status(404).send('Transfer not found');
  }

  if (!transfer.isPermanent && transfer.expiresAt && new Date(transfer.expiresAt) <= new Date()) {
    return res.status(410).send('Transfer expired');
  }

  const fileMeta = transfer.files.find(f => f.fileId === fileId);
  if (!fileMeta) {
    return res.status(404).send('File not found');
  }

  const filePath = path.join(UPLOADS_DIR, id, fileId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File content not found on server');
  }

  transfer.downloadCount = (transfer.downloadCount || 0) + 1;
  transfer.lastDownloadedAt = new Date().toISOString();
  db.save();

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const fileName = encodeURIComponent(fileMeta.name);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': fileMeta.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', fileMeta.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Inline Preview for Images/Audio/Video/PDF
app.get('/api/transfers/:id/files/:fileId/preview', (req, res) => {
  const { id, fileId } = req.params;
  const transfer = db.getTransferById(id);
  if (!transfer) return res.status(404).send('Transfer not found');

  const fileMeta = transfer.files.find(f => f.fileId === fileId);
  if (!fileMeta) return res.status(404).send('File not found');

  const filePath = path.join(UPLOADS_DIR, id, fileId);
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found on disk');

  res.setHeader('Content-Type', fileMeta.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileMeta.name)}"`);
  fs.createReadStream(filePath).pipe(res);
});

// Download All Files as Streaming ZIP (Preserves Folder Trees & 0 RAM overhead)
app.get('/api/transfers/:id/download-zip', (req, res) => {
  const { id } = req.params;
  const transfer = db.getTransferById(id);
  if (!transfer) {
    return res.status(404).send('Transfer not found');
  }

  if (!transfer.isPermanent && transfer.expiresAt && new Date(transfer.expiresAt) <= new Date()) {
    return res.status(410).send('Transfer expired');
  }

  transfer.downloadCount = (transfer.downloadCount || 0) + 1;
  transfer.lastDownloadedAt = new Date().toISOString();
  db.save();

  const archive = archiver('zip', {
    zlib: { level: 1 } // Fast compression for high speed downloads
  });

  const zipName = encodeURIComponent(`${transfer.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_weshare.zip`);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  archive.on('error', (err) => {
    console.error('Archiver error:', err);
    if (!res.headersSent) {
      res.status(500).send('ZIP generation error');
    }
  });

  archive.pipe(res);

  // Append each file with its relative path preserved
  for (const f of transfer.files) {
    const filePath = path.join(UPLOADS_DIR, id, f.fileId);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: f.relativePath || f.name });
    }
  }

  archive.finalize();
});

// ==========================================
// 2. SUPER ADMIN APIS
// ==========================================

// Middleware for Admin Authentication
const adminAuth = (req, res, next) => {
  const pin = req.headers['x-admin-pin'];
  const config = db.getConfig();
  if (!pin || pin !== config.adminPin) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Super Admin PIN' });
  }
  next();
};

// Admin Auth check
app.post('/api/admin/auth', (req, res) => {
  const { pin } = req.body;
  const config = db.getConfig();
  if (pin === config.adminPin) {
    return res.json({ success: true, authorized: true, siteName: config.siteName });
  }
  return res.status(401).json({ success: false, error: 'Invalid Super Admin PIN' });
});

// Admin Stats
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const stats = db.getStats();
  const config = db.getConfig();
  res.json({
    ...stats,
    config
  });
});

// Admin Transfers List (with filters & search)
app.get('/api/admin/transfers', adminAuth, (req, res) => {
  const { search, status, client } = req.query;
  let transfers = db.getTransfers();

  if (search) {
    const q = search.toLowerCase();
    transfers = transfers.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.senderEmail.toLowerCase().includes(q) ||
      (t.clientName && t.clientName.toLowerCase().includes(q)) ||
      t.id.toLowerCase().includes(q)
    );
  }

  if (status) {
    if (status === 'permanent') {
      transfers = transfers.filter(t => t.isPermanent);
    } else if (status === 'expiring') {
      transfers = transfers.filter(t => !t.isPermanent && t.status === 'ready');
    } else if (status === 'expired') {
      transfers = transfers.filter(t => t.status === 'expired');
    }
  }

  if (client) {
    transfers = transfers.filter(t => t.clientId === client);
  }

  res.json(transfers);
});

// Admin Toggle Permanent Retention / Expiry Date on Transfer
app.patch('/api/admin/transfers/:id/retention', adminAuth, (req, res) => {
  const { id } = req.params;
  const { isPermanent, expiresAt, additionalDays } = req.body;

  const transfer = db.getTransferById(id);
  if (!transfer) {
    return res.status(404).json({ error: 'Transfer not found' });
  }

  const updates = {};

  if (typeof isPermanent === 'boolean') {
    updates.isPermanent = isPermanent;
    if (isPermanent) {
      updates.expiresAt = null;
    }
  }

  if (expiresAt) {
    updates.expiresAt = new Date(expiresAt).toISOString();
    updates.isPermanent = false;
  } else if (additionalDays && Number(additionalDays) > 0) {
    const baseDate = transfer.expiresAt ? new Date(transfer.expiresAt) : new Date();
    baseDate.setDate(baseDate.getDate() + Number(additionalDays));
    updates.expiresAt = baseDate.toISOString();
    updates.isPermanent = false;
  }

  const updated = db.updateTransfer(id, updates);
  res.json({ success: true, transfer: updated });
});

// Admin Delete Transfer (Instant purge of files)
app.delete('/api/admin/transfers/:id', adminAuth, (req, res) => {
  const success = db.deleteTransfer(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Transfer not found' });
  }
  res.json({ success: true, message: 'Transfer and associated files deleted permanently' });
});

// Admin Clients Management
app.get('/api/admin/clients', adminAuth, (req, res) => {
  const clients = db.getClients();
  const transfers = db.getTransfers();

  // Attach live metrics to each client
  const enrichedClients = clients.map(client => {
    const clientTransfers = transfers.filter(t => t.clientId === client.id);
    const totalBytes = clientTransfers.reduce((acc, t) => acc + (t.totalSize || 0), 0);
    const activeCount = clientTransfers.filter(t => t.status === 'ready').length;
    return {
      ...client,
      transfersCount: clientTransfers.length,
      activeTransfers: activeCount,
      totalBytesUsed: totalBytes
    };
  });

  res.json(enrichedClients);
});

// Admin Create Client
app.post('/api/admin/clients', adminAuth, (req, res) => {
  try {
    const { name, email, slug, retentionPolicy, retentionDays, maxUploadSizeGB, notes } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Client name and email are required' });
    }

    const newClient = db.createClient({
      name,
      email,
      slug,
      retentionPolicy,
      retentionDays,
      maxUploadSizeGB,
      notes
    });

    res.status(201).json({ success: true, client: newClient });
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Admin Update Client Retention Policy or Details
app.put('/api/admin/clients/:id', adminAuth, (req, res) => {
  try {
    const updated = db.updateClient(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // If client retention policy changed to permanent, optionally update all client's current transfers
    if (req.body.applyToExistingTransfers && req.body.retentionPolicy) {
      const isPerm = req.body.retentionPolicy === 'permanent';
      const transfers = db.getTransfers().filter(t => t.clientId === req.params.id);
      for (const t of transfers) {
        db.updateTransfer(t.id, {
          isPermanent: isPerm,
          expiresAt: isPerm ? null : t.expiresAt
        });
      }
    }

    res.json({ success: true, client: updated });
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Admin Delete Client
app.delete('/api/admin/clients/:id', adminAuth, (req, res) => {
  const success = db.deleteClient(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Client not found' });
  }
  res.json({ success: true, message: 'Client deleted' });
});

// Admin Trigger Immediate Purge of Expired Files
app.post('/api/admin/purge-now', adminAuth, (req, res) => {
  const purged = db.purgeExpiredTransfers();
  res.json({
    success: true,
    purgedCount: purged.length,
    purged
  });
});

// Update Admin Configuration
app.patch('/api/admin/config', adminAuth, (req, res) => {
  const updated = db.updateConfig(req.body);
  res.json({ success: true, config: updated });
});

// Background Auto-Purge Worker (runs every 30 minutes)
setInterval(() => {
  try {
    const config = db.getConfig();
    if (config.autoPurgeEnabled !== false) {
      const purged = db.purgeExpiredTransfers();
      if (purged.length > 0) {
        console.log(`[Auto-Purge] Automatically cleaned up ${purged.length} expired transfers`);
      }
    }
  } catch (err) {
    console.error('[Auto-Purge Error]:', err);
  }
}, 30 * 60 * 1000);

// Run initial purge check at startup
setTimeout(() => {
  db.purgeExpiredTransfers();
}, 2000);

// Serve frontend static build if exists
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 WeShare Enterprise Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads Directory: ${UPLOADS_DIR}`);
  console.log(`⚡ 10GB Chunk Streaming & Auto-Retention Active`);
});
