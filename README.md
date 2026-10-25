# WeShare

A high-performance, self-hosted file-sharing platform inspired by WeTransfer, engineered for high-capacity transfers (up to 10GB) with client vaults and automated retention management.

![WeShare Platform Preview](client/public/art/ceramic.jpg)

## Features

- **WeTransfer-Style UI/UX**: Clean editorial design with floating creative assets, smooth micro-animations, and minimal card-based transfer interface.
- **Up to 10GB Upload Capacity**: Multi-worker chunked streaming architecture slices large files into 10MB chunks directly to disk with resume capability.
- **Folder Upload Support**: Preserves complete directory trees and folder structures with recursive traversal (`webkitdirectory`).
- **Flexible Share Modes**: Toggle between **Send email** transfer and **Get link** transfer.
- **Streaming ZIP Downloads**: On-the-fly streaming ZIP generation (`archiver`) allows multi-gigabyte folder downloads with near-zero server memory overhead.
- **Media Previews**: In-browser preview lightbox for images, video, audio, PDFs, and code files.
- **Client Vaults & Retention Policies**:
  - Super admin can configure clients with **Permanent Storage Vaults** (files never auto-delete) or **Limited Expiry** (e.g. 7, 14, 30 days).
  - Background auto-purge worker cleans up expired transfers automatically.
- **Client Sign In**: Clients can sign in directly to route files straight to their destination vault.
- **Super Admin Portal**: Master dashboard with storage metrics, active transfers table, client retention controls, and manual purge triggers.

## Quick Start

### 1. Install Dependencies
```bash
# Install root, backend, and frontend packages
npm run install:all
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Run Platform
```bash
npm start
```
The server will start at `http://localhost:4000`.

### Development Mode
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

## Tech Stack
- **Frontend**: React 18, Vite, Lucide Icons, Canvas Confetti, QRCode
- **Backend**: Node.js, Express, Multer, Archiver, Mime-Types
- **Storage**: Chunked disk streaming with JSON metadata store
- **Styling**: Vanilla CSS design system with responsive layouts
