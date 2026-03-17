const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: process.cwd() });
});
app.use(express.static(process.cwd()));

// 🔥 RANDOM FALLBACK SONGS (add/remove as many as you want)
const fallbackSongs = [
  { id: "kXYiU_JCYtU", title: "Linkin Park - In The End" },
  { id: "hTWKbfoikeg", title: "Nirvana - Smells Like Teen Spirit" },
  { id: "CD_8iYQh3lY", title: "Metallica - Enter Sandman" },
  { id: "v2AC41dglnM", title: "AC/DC - Thunderstruck" },
  { id: "1w7OgIMMRc4", title: "Guns N' Roses - Sweet Child O' Mine" },
  { id: "-tJYN-eG1zk", title: "Queen - We Will Rock You" },
  { id: "z5rRZdiu1zI", title: "Beastie Boys - Sabotage" },
  { id: "b8-tXG8KrWs", title: "Rage Against The Machine - Killing In The Name" },
  { id: "6mYxQ6s3dF4", title: "Foo Fighters - Everlong" },
  { id: "eJO5X2yW8i8", title: "Eminem - The Real Slim Shady" }
];

function getRandomSong() {
  const random = fallbackSongs[Math.floor(Math.random() * fallbackSongs.length)];
  return { ...random, requester: "Random Skeleton Pick 💀" };
}

let nowPlaying = null;
let queue = [];

// Auto-start a random song when server starts (so it's never silent)
nowPlaying = getRandomSong();

function extractVideoId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com.*[?&]v=|youtube\.com\/embed\/)([^&?]+)/);
  return match ? match[1] : null;
}

async function getVideoInfo(url) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    return { title: data.title || 'Unknown Banger', id: extractVideoId(url) };
  } catch (e) {
    return { title: 'Unknown Banger', id: extractVideoId(url) };
  }
}

io.on('connection', (socket) => {
  socket.emit('state', { nowPlaying, queue });

  socket.on('addSong', async ({ url, requester }) => {
    const info = await getVideoInfo(url);
    if (!info.id) {
      socket.emit('error', 'Invalid YouTube URL');
      return;
    }
    const song = { id: info.id, title: info.title, requester };
    queue.push(song);
    if (!nowPlaying) nowPlaying = queue.shift();
    io.emit('state', { nowPlaying, queue });
  });

  socket.on('nextSong', () => {
    if (queue.length > 0) {
      nowPlaying = queue.shift();
    } else {
      nowPlaying = getRandomSong();   // ← THIS IS THE MAGIC
    }
    io.emit('state', { nowPlaying, queue });
  });

  socket.on('removeSong', (index) => {
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      io.emit('state', { nowPlaying, queue });
    }
  });

  socket.on('clearQueue', () => {
    queue = [];
    io.emit('state', { nowPlaying, queue });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`💀 Skeleton Jukebox running on port ${PORT} (random mode ON)`);
});
