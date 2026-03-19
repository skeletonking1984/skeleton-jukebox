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

// Fallback songs in case queue is empty
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
    console.warn('No YOUTUBE_API_KEY set - using fallback metadata');
    return { title: 'Unknown Banger', artist: 'Unknown', embeddable: true };
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();

    if (data.items?.length > 0) {
      const snippet = data.items[0].snippet;
      const status = data.items[0].status || {};
      return {
        title: snippet.title || 'Unknown Banger',
        artist: snippet.channelTitle || 'Unknown Artist',
        embeddable: status.embeddable !== false
      };
    }
  } catch (e) {
    console.error('YouTube API error for', videoId, ':', e.message);
  }
  return { title: 'Unknown Banger', artist: 'Unknown', embeddable: true };
}

async function getRandomSong() {
  const id = fallbackSongIds[Math.floor(Math.random() * fallbackSongIds.length)];
  const meta = await getVideoMetadata(id);
  return {
    id,
    title: meta.title,
    artist: meta.artist,
    requester: "Random Skeleton Pick 👻",
    embeddable: meta.embeddable
  };
}

let nowPlaying;
(async () => {
  nowPlaying = await getRandomSong();
})();

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

// ────────────────────── IMPROVED URL PARSER ──────────────────────
function extractVideoId(url) {
  if (!url) return null;
  url = url.trim();

  const patterns = [
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=))([a-zA-Z0-9_-]{11})/i,
    /shorts\/([a-zA-Z0-9_-]{11})/i,
    /music\.youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/i,
    /\/v\/([a-zA-Z0-9_-]{11})/i,
    /[?&]v=([a-zA-Z0-9_-]{11})/i,              // catch stray ?v= or &v=
    /youtu\.be\/([a-zA-Z0-9_-]{11})/i          // direct youtu.be short link
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log('Extracted video ID:', match[1], 'from:', url);
      return match[1];
    }
  }
  console.log('Failed to extract video ID from:', url);
  return null;
}

async function getVideoInfo(url) {
  const id = extractVideoId(url);
  if (!id) return { title: 'Unknown Banger', artist: 'Unknown', id: null, embeddable: false };
  const meta = await getVideoMetadata(id);
  return { title: meta.title, artist: meta.artist, id, embeddable: meta.embeddable };
}

// ────────────────────── SOCKET LOGIC ──────────────────────
io.on('connection', (socket) => {
  socket.emit('state', { nowPlaying, queue, history });

  socket.on('addSong', async ({ url, requester }) => {
    const info = await getVideoInfo(url);
    if (!info.id) {
      return socket.emit('error', 'Invalid YouTube URL – make sure it contains a video ID');
    }
    if (!info.embeddable) {
      return socket.emit('error', '❌ This video cannot be embedded (copyright / rights holder restriction)');
    }

    const wasEmpty = queue.length === 0;
    queue.push({
      id: info.id,
      title: info.title,
      artist: info.artist,
      requester: requester || "Skeleton Fan"
    });

    // If queue was empty and current song is random → replace it
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
    const now = Date.now();
    if (now - lastAdvanceTime < 1000) return; // rate limit

    console.log('Advancing to next song');

    if (nowPlaying) {
      history.unshift(nowPlaying);
      if (history.length > 12) history.pop();
    }

    nowPlaying = queue.length > 0 ? queue.shift() : await getRandomSong();
    if (!nowPlaying) nowPlaying = await getRandomSong();

    lastAdvanceTime = now;
    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('reQueue', (index) => {
    if (index >= 0 && index < history.length) {
      queue.push(history[index]);
      saveState();
      io.emit('state', { nowPlaying, queue, history });
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🎧 Skeleton Jukebox running on port ${PORT}`);
});
