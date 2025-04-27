# Cashify Price Tracker

A Chrome extension that tracks prices on cashify.in and stores them in a MongoDB database.

## Features

- Real-time price tracking on cashify.in
- Automatic price monitoring using MutationObserver
- Price history storage in MongoDB
- Simple popup interface
- Manual price check functionality

## Setup Instructions

### Server Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a .env file in the server directory with your MongoDB connection string:
```
MONGODB_URI=mongodb://localhost/price-tracker
PORT=3000
```

4. Start the server:
```bash
npm start
```

### Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension directory (containing manifest.json)
4. The extension icon should appear in your Chrome toolbar

## Usage

1. Visit any product page on cashify.in
2. The extension will automatically track price changes
3. Click the extension icon to see the current tracking status
4. Use the "Check Price Now" button for manual price checks
5. Price history is stored in MongoDB and can be accessed through the server API

## API Endpoints

- `POST /api/prices`: Save a new price record
- `GET /api/prices?url={url}`: Get price history for a specific URL

## Development

- Server uses Node.js with Express and Mongoose
- Extension uses Chrome Extension Manifest V3
- Real-time price tracking with MutationObserver
- CORS enabled for local development

## Requirements

- Node.js 14+
- MongoDB
- Chrome browser 