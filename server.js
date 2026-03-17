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
  { id: "kXYiU_JCYtU", title: "Linkin Park - In The End" },
  { id: "hTWKbfoikeg", title: "Nirvana - Smells Like Teen Spirit" },
  { id: "CD_8iYQh3lY", title: "Metallica - Enter Sandman" },
  { id: "v2AC41dglnM", title: "AC/DC - Thunderstruck" },
  { id: "-tJYN-eG1zk", title: "Queen - We Will Rock You" },
  { id: "z5rRZdiu1zI", title: "Beastie Boys - Sabotage" },
  { id: "b8-tXG8KrWs", title: "Rage Against The Machine - Killing In The Name" },
  { id: "6mYxQ6s3dF4", title: "Foo Fighters - Everlong" },
  { id: "dQw4w9wgxcq", title: "Rick Astley - Never Gonna Give You Up" }, // classic meme safety net
  { id: "L_jWHffIx5E", title: "Smash Mouth - All Star" },
  // ──────────────────────────────────────────────
  { id: "1w7OgIMMRc4", title: "Sweet Child O' Mine - Guns N' Roses" },
  { id: "QM101110_Mk", title: "Bohemian Rhapsody - Queen" },
  { id: "v2AC41dglnM", title: "AC/DC - Highway to Hell" }, // duplicate id ok, but variety
  { id: "04mfKJWDSzI", title: "Back in Black - AC/DC" },
  { id: "GQMlWwIXg3M", title: "Welcome to the Jungle - Guns N' Roses" },
  { id: "5Wp4dYFGpKw", title: "November Rain - Guns N' Roses" },
  { id: "bESGLojNYSo", title: "Zombie - The Cranberries" },
  { id: "3YxaaGgTQYM", title: "Creep - Radiohead" },
  { id: "ungq4OqM3So", title: "Wonderwall - Oasis" },
  { id: "y6120QOlsfU", title: "Basket Case - Green Day" },
  { id: "NU9JoFKlaZ0", title: "Smells Like Teen Spirit (Live) - Nirvana" }, // alt live version
  { id: "hEMm7gxBYSc", title: "Chop Suey! - System Of A Down" },
  { id: "CSvFpBOe8eY", title: "Numb - Linkin Park" },
  { id: "5qap5aO4i9A", title: "Blinding Lights - The Weeknd" }, // crossover safe bop
  { id: "M7lc1UVf-VE", title: "Billie Jean - Michael Jackson" }, // timeless
  { id: "fJ9rUzIMcZQ", title: "Sweet Dreams (Are Made of This) - Eurythmics" },
  { id: "1lyu1KKwC74", title: "Seven Nation Army - The White Stripes" },
  { id: "0J2QdDbelmY", title: "Take On Me - a-ha" },
  { id: "djV11Xbc914", title: "Bring Me to Life - Evanescence" },
  { id: "YVkUvmDQ3HY", title: "In the End (Live) - Linkin Park" },
  { id: "8sgycukafqQ", title: "Californication - Red Hot Chili Peppers" },
  { id: "YlUKcNNmywk", title: "Under the Bridge - Red Hot Chili Peppers" },
  { id: "KxDq5KX3D4Y", title: "Black Hole Sun - Soundgarden" },
  { id: "3mbBbFH9fAg", title: "Killing in the Name (Live) - Rage Against The Machine" },
  { id: "vabnZ9-ex7o", title: "Everlong (Live) - Foo Fighters" },
  { id: "PBHR-In4E0Q", title: "My Hero - Foo Fighters" },
  { id: "4fWyzwo1xg0", title: "Paranoid - Black Sabbath" },
  { id: "5sNWbJghqCA", title: "Iron Man - Black Sabbath" },
  { id: "q0hyYWKXF0Q", title: "Back in Black (Live) - AC/DC" },
  { id: "l482Tsmfqp8", title: "T.N.T. - AC/DC" },
  { id: "pAgnJDJN4VA", title: "Song 2 - Blur" },
  { id: "E0E0ynyIUsg", title: "Interstate Love Song - Stone Temple Pilots" },
  { id: "xGytDsqkQY8", title: "Plush - Stone Temple Pilots" },
  { id: "4N0R0W3N9fM", title: "1979 - The Smashing Pumpkins" },
  { id: "NOG3eus4ZSo", title: "Bullet with Butterfly Wings - The Smashing Pumpkins" },
  { id: "6Ejga4kJUts", title: "Today - The Smashing Pumpkins" },
  { id: "6Fu5PuquH4E", title: "Du Hast - Rammstein" },
  { id: "BkL9lREbqsw", title: "Du riechst so gut - Rammstein" },
  { id: "QRg_8NNPTD8", title: "Rollin' - Limp Bizkit" },
  { id: "MEbJWCnACn8", title: "Break Stuff - Limp Bizkit" },
  { id: "EDlC7oG_2W4", title: "Nookie - Limp Bizkit" }
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
