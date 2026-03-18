const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const STATE_FILE = path.join(process.cwd(), 'jukebox-state.json');

app.get('/', (req, res) => res.sendFile('index.html', { root: process.cwd() }));
app.use(express.static(process.cwd()));

const fallbackSongIds = [
  "kXYiU_JcYtU", "hTwKbfloikeg", "XZuM4zFg-60", "Xa1YxczjZ0U", "H-iPavAXQuK",
  "x6ytDsqkQY8", "JnRw8bXVbPI", "49FB9hhoO6c", "_Fr0QC-zE0g", "7Y8VPQcPHhY",
  "1DoI5WTjd3w", "lzC0WHxrGs8", "bc0KhhjJP98", "y69gQtAdHKc", "jmhoOp2fluzg",
  "U3PFcV04ego", "Dy4HA3vUv2c", "H1x4020E-Fg", "jSRpb0GnFgK", "H-RBJNqdnoM",
  "HLUX0y4EptA", "HNBCVM4KbUM"
];

async function getVideoMetadata(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ No YOUTUBE_API_KEY - using fallback');
    return { title: 'Unknown Banger', artist: 'Unknown' };
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.items?.length > 0) {
      const snippet = data.items[0].snippet;
      return { 
        title: snippet.title || 'Unknown Banger', 
        artist: snippet.channelTitle || 'Unknown Artist' 
      };
    }
    return { title: 'Unknown Banger', artist: 'Unknown' };
  } catch (e) {
    console.error('YouTube API error for', videoId, ':', e.message);
    return { title: 'Unknown Banger', artist: 'Unknown' };
  }
}

async function getRandomSong() {
  const id = fallbackSongIds[Math.floor(Math.random() * fallbackSongIds.length)];
  const { title, artist } = await getVideoMetadata(id);
  return { id, title, artist, requester: "Random Skeleton Pick 👻" };
}

let nowPlaying;
(async () => { nowPlaying = await getRandomSong(); })();

let queue = [];
let history = [];
let lastAdvanceTime = 0;

if (fs.existsSync(STATE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (data.nowPlaying) nowPlaying = data.nowPlaying;
    if (data.queue) queue = data.queue;
    if (data.history) history = data.history;
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ nowPlaying, queue, history }, null, 2));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

function extractVideoId(url) {
  if (!url) return null;
  url = url.trim();
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^&\n?#]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&\n?#]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^&\n?#]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^&\n?#]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*[?&]v=([^&\n?#]+)/i
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1].split(/[?&]/)[0];
  }
  return null;
}

async function getVideoInfo(url) {
  const id = extractVideoId(url);
  if (!id) return { title: 'Unknown Banger', artist: 'Unknown', id: null };
  const { title, artist } = await getVideoMetadata(id);
  return { title, artist, id };
}

io.on('connection', (socket) => {
  socket.emit('state', { nowPlaying, queue, history });

  socket.on('addSong', async ({ url, requester }) => {
    const info = await getVideoInfo(url);
    if (!info.id) return socket.emit('error', 'Invalid YouTube URL');

    const existingIndex = queue.findIndex(s => s.id === info.id);
    if (existingIndex !== -1) {
      socket.emit('duplicate', { title: info.title, position: existingIndex + 1 });
      return;
    }
    if (nowPlaying && nowPlaying.id === info.id) {
      socket.emit('duplicate', { title: info.title, position: "currently playing" });
      return;
    }

    const wasEmpty = queue.length === 0;
    queue.push({ id: info.id, title: info.title, artist: info.artist, requester });

    if (wasEmpty && nowPlaying?.requester?.includes("Random Skeleton Pick")) {
      if (nowPlaying) {
        history.unshift(nowPlaying);
        if (history.length > 12) history.pop();
      }
      nowPlaying = queue.shift();
    }
    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('nextSong', async () => {
    console.log('🔄 [SERVER] nextSong event received');
    const now = Date.now();
    if (now - lastAdvanceTime < 1000) {
      console.log('⏳ [SERVER] Ignored - too soon');
      return;
    }

    if (nowPlaying) {
      console.log(`📜 [SERVER] Moving "${nowPlaying.title}" to history`);
      history.unshift(nowPlaying);
      if (history.length > 12) history.pop();
    }

    if (queue.length > 0) {
      nowPlaying = queue.shift();
      console.log(`✅ [SERVER] Playing next queued song: ${nowPlaying.title}`);
    } else {
      nowPlaying = await getRandomSong();
      console.log(`🎲 [SERVER] Queue empty - playing random: ${nowPlaying.title}`);
    }

    lastAdvanceTime = now;
    saveState();
    console.log('📡 [SERVER] Broadcasting new state');
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('reQueue', (index) => {
    if (index >= 0 && index < history.length) {
      const song = history[index];
      queue.push(song);
      console.log(`🔄 [SERVER] Re-queued: ${song.title}`);
    }
    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🎧 Skeleton Jukebox running on port ${PORT}`));
