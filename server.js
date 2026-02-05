const express = require("express");
const app = express();
const fs = require('fs');
const https = require('https');
const io = require('socket.io');

const { ExpressPeerServer } = require('peer');
const { v4: uuidv4 } = require('uuid');

// Загружаем SSL сертификаты
const options = {
  key: fs.readFileSync('certs/localhost+2-key.pem'),
  cert: fs.readFileSync('certs/localhost+2.pem'),
};

// Создаем HTTPS сервер
const server = https.createServer(options, app);

// Инициализируем Socket.IO с HTTPS сервером
const socketIO = io(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Настраиваем PeerServer
const peerServer = ExpressPeerServer(server, { 
  debug: true,
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/peerjs', peerServer);

app.get('/', (_, res) => {
  res.redirect(`/${uuidv4()}`);
});

app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room });
});

socketIO.on('connection', socket => {
  socket.on('join-room', (roomId, userId, userName) => {
    socket.join(roomId);
    socket.broadcast.to(roomId).emit('user-connected', userId);
    
    socket.on('message', message => {
      socketIO.to(roomId).emit('createMessage', message, userName);
    });
  });
});

server.listen(3030, () => {
  console.log('https://localhost:3030');
});