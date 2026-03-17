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

// 🔥 CLEAN RANDOM LIST (all these play reliably)
const fallbackSongs = [
  { id: "kXYiU_JCYtU", title: "Linkin Park - Numb (Official Music Video)" },
  { id: "hTWKbfoikeg", title: "Nirvana - Smells Like Teen Spirit (Official Music Video)" },
  { id: "XZuM4zFg-60", title: "Metallica - Enter Sandman (Official Music Video)" },
  { id: "XaiYxczjZ0U", title: "Godsmack - Voodoo" },
  { id: "H-iPavAXQUk", title: "Kavinsky - Nightcall" },
  { id: "xGytDsqkQY8", title: "Semisonic - Closing Time (Official Music Video)" },
  { id: "JnRw8bXVbPI", title: "The Verve - Bitter Sweet Symphony (Remastered 2016)" }
];

function getRandomSong() {
  const random = fallbackSongs[Math.floor(Math.random() * fallbackSongs.length)];
  return { ...random, requester: "Random Skeleton Pick 💀" };
}

let nowPlaying = getRandomSong();
let queue = [];
let history = [];

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
  socket.emit('state', { nowPlaying, queue, history });

  socket.on('addSong', async ({ url, requester }) => {
    const info = await getVideoInfo(url);
    if (!info.id) return socket.emit('error', 'Invalid YouTube URL');
    queue.push({ id: info.id, title: info.title, requester });
    if (!nowPlaying) nowPlaying = queue.shift();
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('nextSong', () => {
    if (nowPlaying) {
      history.unshift(nowPlaying);
      if (history.length > 12) history.pop();
    }
    if (queue.length > 0) {
      nowPlaying = queue.shift();
    } else {
      nowPlaying = getRandomSong();
    }
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('removeSong', (index) => {
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      io.emit('state', { nowPlaying, queue, history });
    }
  });

  socket.on('reQueue', (index) => {
    if (index >= 0 && index < history.length) {
      queue.push(history[index]);
      io.emit('state', { nowPlaying, queue, history });
    }
  });

  socket.on('clearQueue', () => {
    queue = [];
    io.emit('state', { nowPlaying, queue, history });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`💀 Skeleton Jukebox running on port ${PORT}`);
});
