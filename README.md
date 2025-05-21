# Offline-First Markdown Notes App

A React TypeScript application that allows users to create, edit, and manage Markdown notes with offline support and synchronization capabilities.

## Features

- **Offline-First**: Create and edit notes even when offline
- **Markdown Support**: Write notes in Markdown format with live preview
- **Auto-Save**: Changes are automatically saved with debounce (500ms)
- **Sync Status**: Visual indicators show sync status for each note
- **Search**: Filter notes by title or content
- **Responsive Design**: Works on both desktop and mobile devices

## Tech Stack

- React with TypeScript
- IndexedDB (via Dexie.js) for offline storage
- React Markdown for rendering Markdown content
- Axios for API requests
- JSON Server for mock backend API

## Setup Instructions

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Install dependencies

```bash
npm install
```

2. Start the mock API server

```bash
npm run server
```

3. In a new terminal, start the development server

```bash
npm run dev
```

4. Open your browser and navigate to http://localhost:5173

## Usage

- Click "New Note" to create a new note
- Click on a note in the sidebar to view or edit it
- Toggle between Edit and Preview modes using the button
- Notes are automatically saved as you type
- Search for notes using the search bar

## Offline Functionality

The app uses IndexedDB to store notes locally, allowing full functionality even when offline:

- Create, edit, and delete notes while offline
- Changes are automatically synced when online connectivity is restored
- Sync status indicators show the current state of each note:
  - 🔄 Unsynced: Changes haven't been synced to the server yet
  - ⏳ Syncing: Currently syncing with the server
  - ✅ Synced: Successfully synced with the server
  - ❌ Error: Failed to sync with the server

## Design Decisions and Tradeoffs

### Offline-First Architecture

The app prioritizes local storage and operations, treating the server as a secondary sync target. This ensures the app remains fully functional regardless of network conditions.

### Conflict Resolution

A simple "last-write-wins" strategy is implemented for conflict resolution. When syncing, the most recently updated version of a note (based on timestamp) takes precedence.

### Sync Strategy

The app uses a debounced sync approach to prevent excessive API calls during rapid edits. Changes are synced 500ms after the last edit when online, or queued for sync when connectivity is restored.

## Testing Offline Mode

To test offline functionality:

1. Open the app while online
2. Use browser DevTools to simulate offline mode (Network tab → Offline)
3. Create or edit notes
4. Switch back to online mode to observe synchronization
