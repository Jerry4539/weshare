/**
 * Turbo Chunked Upload Engine
 * Multi-worker parallel chunk streaming for maximum network saturation and speed.
 */

export class ChunkUploader {
  constructor(options = {}) {
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.chunkSize = options.chunkSize || 10 * 1024 * 1024; // 10MB
    this.concurrency = options.concurrency || 3; // 3 parallel chunks for turbo speed
    this.abortController = new AbortController();
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
    this.abortController.abort();
  }

  async upload({
    title,
    message,
    senderEmail,
    recipientEmails,
    transferType,
    clientSlug,
    password,
    customExpiryDays,
    files = []
  }) {
    try {
      const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

      // Step 1: Initiate
      const filesMeta = files.map((f, i) => ({
        fileId: `file_${i}_${Date.now()}`,
        name: f.name,
        relativePath: f.webkitRelativePath || f.relativePath || f.name,
        size: f.size,
        mimeType: f.type || 'application/octet-stream'
      }));

      const initRes = await fetch('/api/transfers/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.abortController.signal,
        body: JSON.stringify({
          title,
          message,
          senderEmail,
          recipientEmails,
          transferType,
          clientSlug,
          password,
          customExpiryDays,
          files: filesMeta
        })
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || 'Failed to initiate transfer');
      }

      const initData = await initRes.json();
      const transferId = initData.transferId;
      const serverChunkSize = initData.chunkSizeBytes || this.chunkSize;

      let uploadedBytesOverall = 0;
      const startTime = Date.now();
      let lastTime = startTime;
      let lastBytes = 0;
      let currentSpeed = 0;

      // Step 2: Upload each file with parallel chunk workers
      for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        if (this.isCancelled) throw new Error('Upload cancelled');

        const file = files[fileIdx];
        const meta = initData.files[fileIdx];
        const fileSize = file.size;
        const totalChunks = Math.max(1, Math.ceil(fileSize / serverChunkSize));

        // Queue of chunk indices to upload
        const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
        let activeWorkers = 0;
        let chunkIndexCursor = 0;

        const uploadChunkWorker = async (chunkIdx) => {
          if (this.isCancelled) return;

          const start = chunkIdx * serverChunkSize;
          const end = Math.min(start + serverChunkSize, fileSize);
          const chunkBlob = file.slice(start, end);

          const formData = new FormData();
          formData.append('fileId', meta.fileId);
          formData.append('chunkIndex', chunkIdx.toString());
          formData.append('totalChunks', totalChunks.toString());
          formData.append('chunk', chunkBlob);

          const res = await fetch(`/api/transfers/${transferId}/upload-chunk`, {
            method: 'POST',
            signal: this.abortController.signal,
            body: formData
          });

          if (!res.ok) {
            throw new Error(`Failed chunk ${chunkIdx} for ${meta.name}`);
          }

          const chunkBytes = end - start;
          uploadedBytesOverall += chunkBytes;

          // Speed & ETA calculations
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.3) {
            const delta = uploadedBytesOverall - lastBytes;
            currentSpeed = delta / elapsed;
            lastTime = now;
            lastBytes = uploadedBytesOverall;
          }

          const remainingBytes = Math.max(0, totalBytes - uploadedBytesOverall);
          const etaSeconds = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
          const overallPercent = Math.min(100, Math.round((uploadedBytesOverall / totalBytes) * 100));

          this.onProgress({
            overallPercent,
            uploadedBytes: uploadedBytesOverall,
            totalBytes,
            currentFileIndex: fileIdx + 1,
            totalFiles: files.length,
            currentFileName: meta.name,
            speedBytesPerSec: currentSpeed,
            etaSeconds
          });
        };

        // Run worker pool
        const promises = [];
        const poolConcurrency = Math.min(this.concurrency, totalChunks);

        for (let w = 0; w < poolConcurrency; w++) {
          const runWorker = async () => {
            while (chunkIndexCursor < totalChunks && !this.isCancelled) {
              const idx = chunkIndexCursor++;
              await uploadChunkWorker(idx);
            }
          };
          promises.push(runWorker());
        }

        await Promise.all(promises);

        if (this.isCancelled) throw new Error('Upload cancelled');

        // Step 2b: Assemble chunks for this file
        const assembleRes = await fetch(`/api/transfers/${transferId}/assemble-file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: this.abortController.signal,
          body: JSON.stringify({
            fileId: meta.fileId,
            totalChunks
          })
        });

        if (!assembleRes.ok) {
          throw new Error(`Failed to assemble file ${meta.name}`);
        }
      }

      // Step 3: Finalize Transfer
      const finalizeRes = await fetch(`/api/transfers/${transferId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: this.abortController.signal
      });

      if (!finalizeRes.ok) {
        throw new Error('Failed to finalize transfer');
      }

      const finalizeData = await finalizeRes.json();
      this.onComplete({
        transferId,
        transfer: finalizeData.transfer,
        shareUrl: `${window.location.origin}/#download/${transferId}`
      });

    } catch (err) {
      if (this.isCancelled) {
        console.log('Upload cancelled by user');
      } else {
        console.error('Upload error:', err);
        this.onError(err);
      }
    }
  }
}
