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

const fallbackSongs = [
  { id: "kXYiU_JCYtU", title: "Linkin Park - Numb (Official Music Video)" },
  { id: "hTWKbfoikeg", title: "Nirvana - Smells Like Teen Spirit (Official Music Video)" },
  { id: "XZuM4zFg-60", title: "Metallica - Enter Sandman (Official Music Video)" },
  { id: "XaiYxczjZ0U", title: "Godsmack - Voodoo (Official Music Video)" },
  { id: "H-iPavAXQUk", title: "Kavinsky - Nightcall (Official Video)" },
  { id: "xGytDsqkQY8", title: "Semisonic - Closing Time (Official Music Video)" },
  { id: "JnRw8bXVbPI", title: "The Verve - Bitter Sweet Symphony (Remastered 2016)" },
  { id: "49FB9hhoO6c", title: "Pixies - Where is My Mind?" },
  { id: "_FrOQC-zEog", title: "Pink Floyd - Comfortably Numb" },
  { id: "7Y8VPQcPHhY", title: "Notorious B.I.G - Juicy" },
  { id: "1DoI5WTjd3w", title: "Imagine Dragons - Follow You (Lyric Video)" },
  { id: "1zCOWHxrGs8", title: "Virtual Riot & Panda Eyes - Superheroes" },
  { id: "bc0KhhjJP98", title: "Redbone - Come and Get Your Love" },
  { id: "y69gQtAdHKc", title: "Scott Pilgrim Vs. The World - Black Sheep" },
  { id: "jmhoOp2fUzg", title: "Harry Chapin - Cat's in the Cradle" },
  { id: "U3PFcV04ego", title: "DMX - The Convo" },
  { id: "Dy4HA3vUv2c", title: "Blue Oyster Cult - (Don't Fear) The Reaper" },
  { id: "Hlx4O20E-Fg", title: "Crazy Town - Butterfly" },
  { id: "jSPpbOGnFgk", title: "The Ronettes - Be My Baby (Official Audio)" },
  { id: "H-RBJNqdnoM", title: "The Fugees - Killing Me Softly" },
  { id: "HLUX0y4EptA", title: "Flobots - Handlebars" }
];

function getRandomSong() {
  const random = fallbackSongs[Math.floor(Math.random() * fallbackSongs.length)];
  return { ...random, requester: "Random Skeleton Pick 💀" };
}

let nowPlaying = getRandomSong();
let queue = [];
let history = [];
let lastAdvanceTime = 0;

if (fs.existsSync(STATE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (data.nowPlaying) nowPlaying = data.nowPlaying;
    if (data.queue) queue = data.queue;
    if (data.history) history = data.history;
  } catch (e) {}
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ nowPlaying, queue, history }));
}

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

    const wasEmpty = queue.length === 0;

    queue.push({ id: info.id, title: info.title, requester });

    // If queue was empty → interrupt current random song and play the new one immediately
    if (wasEmpty && nowPlaying?.requester.includes("Random Skeleton Pick")) {
      if (nowPlaying) {
        history.unshift(nowPlaying);
        if (history.length > 12) history.pop();
      }
      nowPlaying = queue.shift(); // Play the newly added song right now
    }

    saveState();
    io.emit('state', { nowPlaying, queue, history });
  });

  socket.on('nextSong', () => {
    console.log('nextSong received');

    const now = Date.now();
    if (now - lastAdvanceTime < 1000) {
      console.log('nextSong ignored (too soon)');
      return;
    }

    if (nowPlaying) {
      history.unshift(nowPlaying);
      if (history.length > 12) history.pop();
    }

    nowPlaying = queue.length > 0 ? queue.shift() : getRandomSong();
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
httpServer.listen(PORT, () => console.log(`💀 Skeleton Jukebox running on port ${PORT}`));
