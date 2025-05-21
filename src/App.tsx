import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Dexie from 'dexie';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import './App.css';


interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  synced: number;
  deleted :number
  syncStatus?: 'unsynced' | 'syncing' | 'synced' | 'error';
}


const db = new Dexie('NotesDatabase');
db.version(1).stores({
  notes: 'id, title, updatedAt, synced, content, syncStatus, deleted'
});



// const API_URL = 'https://682d6d634fae18894755e51f.mockapi.io/api/note';
const API_URL = 'http://localhost:3001/notes';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  // const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [searchQuery, setSearchQuery] = useState<string>('');  
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [syncInProgress, setSyncInProgress] = useState<boolean>(false);
  

  const debounceTimeoutRef = useRef<number | null>(null);
  
  const loadNotes = useCallback(async () => {
    try {
      const allNotes = await db.table('notes').where('deleted').equals(0).toArray();
      const sortedNotes = allNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      console.log('Loaded notes:', sortedNotes);
      setNotes(sortedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  }, []);

 
  useEffect(() => {
    loadNotes();

    if(navigator.onLine) {
      syncNotes();
    }

    const handleOnline = () => {
      setIsOnline(true);

      syncNotes();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
     
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [loadNotes]);


  const syncNotes = async () => {
  if (!isOnline || syncInProgress) return;

  setSyncInProgress(true);
  console.log('Starting sync...');

  try {
 
    const unsyncedLocalNotes = await db.table('notes').where('synced').equals(0).toArray();

    const response = await axios.get(API_URL);
    const serverNotes: Note[] = response.data;
    console.log('Server notes received:', serverNotes.length);

    const serverNotesMap = new Map(serverNotes.map(note => [note.id, note]));
    const localNotesMap = new Map((await db.table('notes').toArray()).map(note => [note.id, note]));
    console.log(localNotesMap)
    console.log(serverNotesMap)

    for (const localNote of unsyncedLocalNotes) {
      const { syncStatus, deleted,synced, ...data } = localNote; 
      const serverNote = serverNotesMap.get(localNote.id);

      try {
        if (deleted === 1) {

          if (serverNote) {
  
            await axios.delete(`${API_URL}/${localNote.id}`);
          }
  
          await db.table('notes').delete(localNote.id);
          loadNotes()

        } else {
    
          if (serverNote) {
 
            if (new Date(localNote.updatedAt) > new Date(serverNote.updatedAt)) {
          
              await axios.put(`${API_URL}/${localNote.id}`, data);
              await db.table('notes').update(localNote.id, { synced: 1, syncStatus: 'synced' });
              console.log(`Updated note ${localNote.id} on server.`);
            } else {
               // Server version is newer or same, mark local as synced
               await db.table('notes').update(localNote.id, { synced: 1, syncStatus: 'synced' });
               console.log(`Server version of note ${localNote.id} is newer or same, marked local as synced.`);
            }
          } else {
         
            await axios.post(API_URL, data);
            await db.table('notes').update(localNote.id, { synced: 1, syncStatus: 'synced' });
            console.log(`Created note ${localNote.id} on server.`);
          }
        }
      } catch (error) {
        console.error(`Failed to sync local note ${localNote.id}:`, error);
        await db.table('notes').update(localNote.id, { syncStatus: 'error' });
      }
    }


    for (const serverNote of serverNotes) {
        const localNote = localNotesMap.get(serverNote.id);

        if (!localNote) {
         
            await db.table('notes').put({
                ...serverNote,
                synced: 1, 
                syncStatus: 'synced',
                deleted: 0 
            });
            loadNotes()
            console.log(`Created note ${serverNote.id} locally from server.`);
        } else if (new Date(serverNote.updatedAt) > new Date(localNote.updatedAt)) {
         
             await db.table('notes').put({
                ...serverNote,
                synced: 1, 
                syncStatus: 'synced',
                deleted: 0 
            });
            loadNotes() 
            console.log(`Updated local note ${serverNote.id} from server.`);
        }

    }

   
    const allLocalNotesAfterPhase1 = await db.table('notes').toArray();
    for (const localNote of allLocalNotesAfterPhase1) {
        if (localNote.deleted !== 1 && !serverNotesMap.has(localNote.id)) {
    
            await db.table('notes').delete(localNote.id);
            console.log(`Deleted local note ${localNote.id} as it was missing from server.`);
        }
    }


    console.log('Sync complete.');

  } catch (error) {
    console.error('Sync failed:', error);
 
  } finally {
    setSyncInProgress(false);
    loadNotes(); 
  }
};
    


  const updateNote = useCallback(async (id: string, changes: Partial<Note>) => {
      if (!id) return;
  
      try {
   
        const currentNote = await db.table('notes').get(id);
        if (!currentNote) return;
        
        const updatedNote = {
          ...currentNote,  
          ...changes,      
          updatedAt: new Date().toISOString(),
          synced: 0,
          syncStatus: 'unsynced'
        };
  
        await db.table('notes').update(id, updatedNote);
        loadNotes();
  

        if (selectedNote && selectedNote.id === id) {
          const updated = await db.table('notes').get(id);
          if (updated){
             setSelectedNote(updated);
            loadNotes()
          }
        }

        if (isOnline) {

          if (debounceTimeoutRef.current) {
            window.clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
          }
          

          debounceTimeoutRef.current = window.setTimeout(async () => {
            syncNotes();
          }, 1000);
        }
      } catch (error) { 
        console.error('Failed to update note:', error);
      }
    },
    [selectedNote, isOnline, loadNotes]);


  const deleteNote = async (id: string) => {
    try {
      await db.table('notes').update(id, { deleted: 1 });
      

      if (isOnline) {
        try {
          await axios.delete(`${API_URL}/${id}`);
          await db.table('notes').delete(id);
          syncNotes();
        } catch (error) {
          console.error('Failed to delete note from server:', error);
        }
      }
      
      loadNotes();
      if (selectedNote && selectedNote.id === id) {
        setSelectedNote(null);
        setIsEditing(false);
      }
    } catch (error) {
    console.error('Failed to delete note:', error);
    }
  };

  const createNote = async () => {
    try {
      const newNote: Note = {
        id: uuidv4(),
        title: 'New Note',
        content: '',
        updatedAt: new Date().toISOString(),
        synced: 0,
        deleted: 0,
        syncStatus: 'unsynced'
      };
      const {synced,syncStatus,deleted,...data}  = newNote
      await db.table('notes').add(newNote);
      setSelectedNote(newNote);
      setIsEditing(true);
      loadNotes();
      if(isOnline){
        await axios.post(API_URL, data);
        syncNotes(); 
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };


  const filteredNotes = notes.filter(note => {
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  });

  // Get sync status indicator
  const getSyncStatusIndicator = (status?: string) => {
    switch (status) {
      case 'unsynced':
        return '🔄';
      case 'syncing':
        return '⏳';
      case 'synced':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '';
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Markdown Notes</h1>
        <div className="connection-status">
          {isOnline ? (
            <span className="online">Online</span>
          ) : (
            <span className="offline">Offline</span>
          )}
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-header">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button onClick={createNote} className="new-note-btn">
              New Note
            </button>
          </div>

          <div className="notes-list">
            {filteredNotes.length === 0 ? (
              <p className="no-notes">No notes found</p>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedNote(note);
                    setIsEditing(false);
                  }}
                >
                  <div className="note-title">
                    {note.title || 'Untitled'}
                    <span className="sync-status">
                      {getSyncStatusIndicator(note.syncStatus)}
                    </span>
                  </div>
                  <div className="note-preview">
                    {note.content.substring(0, 50)}
                    {note.content.length > 50 ? '...' : ''}
                  </div>
                  <div className="note-date">
                    {new Date(note.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="note-editor">
          {selectedNote ? (
            <div className="editor-container">
              <div className="editor-header">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) =>
                    updateNote(selectedNote.id, { title: e.target.value })
                  }
                  placeholder="Note title"
                  className="title-input"
                />
                <div className="editor-actions">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="toggle-view-btn"
                  >
                    {isEditing ? 'Preview' : 'Edit'}
                  </button>
                  <button
                    onClick={() => deleteNote(selectedNote.id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isEditing ? (
                <textarea
                  value={selectedNote.content}
                  onChange={(e) =>
                    updateNote(selectedNote.id, { content: e.target.value })
                  }
                  placeholder="Write your note in Markdown..."
                  className="content-editor"
                />
              ) : (
                <div className="markdown-preview">
                  {selectedNote.content ? (
                    <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                  ) : (
                    <p className="empty-content">No content</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="no-note-selected">
              <p>Select a note or create a new one</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
