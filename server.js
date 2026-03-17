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

let nowPlaying = null;
let queue = [];

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
      nowPlaying = null;
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
  console.log(`💀 Skeleton Jukebox running on port ${PORT}`);
});
