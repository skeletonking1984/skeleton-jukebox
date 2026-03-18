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
  "kXYiU_JCYtU",
  "hTWKbfoikeg",
  "XZuM4zFg-60",
  "XaiYxczjZ0U",
  "H-iPavAXQUk",
  "xGytDsqkQY8",
  "JnRw8bXVbPI",
  "49FB9hhoO6c",
  "_FrOQC-zEog",
  "7Y8VPQcPHhY",
  "1DoI5WTjd3w",
  "1zCOWHxrGs8",
  "bc0KhhjJP98",
  "y69gQtAdHKc",
  "jmhoOp2fUzg",
  "U3PFcV04ego",
  "Dy4HA3vUv2c",
  "Hlx4O20E-Fg",
  "jSPpbOGnFgk",
  "H-RBJNqdnoM",
  "HLUX0y4EptA",
  "HNBCVM4KbUM",
  "aOkiG53ituQ",
  "kbvpwnDeisk",
  "zG5FPc-qDv0",
  "wy709iNG6i8",
  "2jj-wO7L2V8",
  "bO28lB1uwp4",
  "Mb1ZvUDvLDY",
  "dLl4PZtxia8",
  "HKGjCPBSG38",
  "IYAXM9klOCE",
  "RBtlPT23PTM"
];

async function getVideoMetadata(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('No YOUTUBE_API_KEY - using fallback');
    return { title: 'Unknown Banger', artist: 'Unknown' };
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.items?.length > 0) {
      const snippet = data.items[0].snippet;
      return { title: snippet.title || 'Unknown Banger', artist: snippet.channelTitle || 'Unknown Artist' };
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
  } catch (e) { console.error('Failed to load state:', e); }
}

function addToHistory(song) {
  if (!song || !song.id) return;
  history = history.filter(h => h.id !== song.id);
  history.unshift(song);
  if (history.length > 12) history.pop();
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ nowPlaying, queue, history }, null, 2));
  } catch (e) { console.error('Failed to save state:', e); }
}

function extractVideoId(url) {
  const match = url.match(/(?:(?:youtu\.be\/|youtube\.com.*[?&]v=|youtube\.com\/embed\/)([^&]+))/);
  return match ? match[1] : null;
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

    const wasEmpty = queue.length === 0;
    queue.push({ id: info.id, title: info.title, artist: info.artist, requester });

    if (wasEmpty && nowPlaying?.requester?.includes("Random Skeleton Pick")) {
      if (nowPlaying) addToHistory(nowPlaying);
      nowPlaying = queue.shift();
    }
    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('nextSong', async () => {
    console.log('nextSong received');
    const now = Date.now();
    if (now - lastAdvanceTime < 1000) { console.log('nextSong ignored (too soon)'); return; }

    if (nowPlaying) addToHistory(nowPlaying);
    nowPlaying = queue.length > 0 ? queue.shift() : await getRandomSong();
    if (!nowPlaying) nowPlaying = await getRandomSong();

    lastAdvanceTime = now;
    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('reQueue', (index) => {
    if (index >= 0 && index < history.length) queue.push(history[index]);
    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🎧 Skeleton Jukebox running on port ${PORT}`));
