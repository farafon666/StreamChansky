const socket = io('/');

/*
  WebRTC block
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
  config: {
    // Free public STUN servers provided by Google.
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
  },
  debug: 1 // 0 - без логов, 1 - ошибки, 2 - предупреждения, 3 - подробная информация.
});

let myVideoStream;

navigator.mediaDevices && navigator.mediaDevices.getUserMedia({
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
/*
  Button-functionality block
  ******************************************************************************************************************************
*/
const showChat = document.querySelector('#showChat');
const backBtn = document.querySelector('.header__back');

const inviteButton = document.querySelector('#inviteButton');
const muteButton = document.querySelector('#muteButton');
const stopVideo = document.querySelector('#stopVideo');

let isChatExpanded = true;

backBtn.addEventListener('click', () => {
  document.querySelector('.main__left').style.display = 'flex';
  document.querySelector('.main__left').style.flex = '1';
  document.querySelector('.main__right').style.display = 'none';
  document.querySelector('.header_back').style.display = 'none';
});

showChat.addEventListener('click', () => {
  document.querySelector('.main__right').style.display = isChatExpanded ? 'none' : 'flex';
  document.querySelector('.main__left').style.flex = isChatExpanded ? '1.3' : '0.7';
  showChat.innerHTML = isChatExpanded ? '<i class="fas fa-comment"></i>' : '<i class="fa fa-comment-slash"></i>';
  isChatExpanded = !isChatExpanded;
});

inviteButton.addEventListener('click', () => {
  prompt('Copy this link and sent it to people you want to invite:', window.location.href);
});

muteButton.addEventListener('click', () => {
  const isEnabled = myVideoStream.getAudioTracks()[0].enabled;
  myVideoStream.getAudioTracks()[0].enabled = !isEnabled;
  muteButton.innerHTML = isEnabled ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
  muteButton.classList.toggle('background__red');
});

stopVideo.addEventListener('click', () => {
  const isEnabled = myVideoStream.getVideoTracks()[0].enabled;
  myVideoStream.getVideoTracks()[0].enabled = !isEnabled;
  stopVideo.innerHTML = isEnabled ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
  stopVideo.classList.toggle('background__red');
});
/*
  ******************************************************************************************************************************
*/
