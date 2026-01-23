const socket = io('/');

/*
  Signaling block
  ******************************************************************************************************************************
*/
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');

myVideo.muted = true;

const user = prompt('Enter your name:');

const peer = new Peer({
  path: '/peerjs',
  host: '/',
  port: '3030',
});

let myVideoStream;

navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true,
})
.then(stream => {
  myVideoStream = stream;
  addVideoStream(myVideo, stream);

  peer.on('call', call => {
    console.log('Someone call me');
    call.answer(stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream);
    });
  });

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream);
  });
});

const connectToNewUser = (userId, stream) => {
  console.log('I call someone ' + userId);
  const call = peer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
};

const addVideoStream = (video, stream) => {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
    videoGrid.append(video);
  });
}

peer.on('open', id => {
  console.log('My id is ' + id);
  socket.emit('join-room', ROOM_ID, id, user);
});
/*
  ******************************************************************************************************************************
*/
/*
  Chat block
  ******************************************************************************************************************************
*/
const text = document.querySelector('#chatMessage');
const send = document.getElementById('send');
const messages = document.querySelector('.messages');

send.addEventListener('click', e =>{
  if (text.value.length !== 0) {
    socket.emit('message', text.value);
    text.value = '';
  }
});

text.addEventListener('keydown', e => {
  if (e.key === 'Enter' && text.value.length !== 0) {
    socket.emit('message', text.value);
    text.value = '';
  }
});

socket.on('createMessage', (message, userName) => {
  messages.innerHTML = messages.innerHTML + 
    `<div class="message">
        <b><i class="far fa-user-circle"></i> <span> ${userName === user ? "me" : userName}</span> </b>
        <p class="message__time">${new Date().toLocaleTimeString()}</p>
        <span>${message}</span>
    </div>`;
});
/*
  ******************************************************************************************************************************
*/
