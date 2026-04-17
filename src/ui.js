// Инициализация UI модуля
export function initUI(localStream) {
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
    document.querySelector('.main__right').style.display = isChatExpanded
      ? 'none'
      : 'flex';
    document.querySelector('.main__left').style.flex = isChatExpanded
      ? '1.3'
      : '0.7';
    showChat.innerHTML = isChatExpanded
      ? '<i class="fas fa-comment"></i>'
      : '<i class="fa fa-comment-slash"></i>';
    isChatExpanded = !isChatExpanded;
  });

  inviteButton.addEventListener('click', () => {
    prompt('Скопируйте ссылку и отправьте ее другу:', window.location.href);
  });

  muteButton.addEventListener('click', () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        muteButton.innerHTML = audioTrack.enabled
          ? '<i class="fas fa-microphone"></i>'
          : '<i class="fas fa-microphone-slash"></i>';
        muteButton.classList.toggle('background__red');
      }
    }
  });

  stopVideo.addEventListener('click', () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) return;
    const videoTrack = videoTracks[0];
    const isEnabled = videoTrack.enabled;
    videoTrack.enabled = !isEnabled;
    stopVideo.innerHTML = isEnabled
      ? '<i class="fas fa-video-slash"></i>'
      : '<i class="fas fa-video"></i>';
    stopVideo.classList.toggle('background__red');
  });
}
