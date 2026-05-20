import {
  publishScreenTrack,
  stopScreenTrack,
  startVideoTrack,
  stopVideoTrack,
  videoProducer,
  videoMainContainer,
} from './webrtc.js';

// Инициализация UI модуля
export function initUI(localStream) {
  const showChat = document.querySelector('#showChat');
  const backBtn = document.querySelector('.header__back');
  const inviteButton = document.querySelector('#inviteButton');
  const muteButton = document.querySelector('#muteButton');
  const stopVideo = document.querySelector('#stopVideo');
  const screenShareButton = document.querySelector('#screenShareButton');
  const fullscreenButton = document.querySelector('#fullscreenButton');

  let isChatExpanded = true;
  let screenStream = null;
  let screenVideoTrack = null;
  let isScreenSharing = false;
  let isFullscreen = false;

  backBtn.addEventListener('click', () => {
    document.querySelector('.main__left').style.display = 'flex';
    document.querySelector('.main__left').style.flex = '1';
    document.querySelector('.main__right').style.display = 'none';
    document.querySelector('.header__back').style.display = 'none';
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

  function updateVideoButton() {
    if (videoProducer) {
      stopVideo.innerHTML = '<i class="fas fa-video"></i>';
      stopVideo.classList.remove('background__red');
    } else {
      stopVideo.innerHTML = '<i class="fas fa-video-slash"></i>';
      stopVideo.classList.add('background__red');
    }
  }

  // Инициализируем кнопку в соответствии с текущим состоянием
  updateVideoButton();

  stopVideo.addEventListener('click', async () => {
    if (!localStream) return;

    try {
      if (videoProducer) {
        await stopVideoTrack();
      } else {
        await startVideoTrack();
      }
    } catch (error) {
      console.error('Ошибка переключения видео:', error);
      return;
    }

    updateVideoButton();
  });

  screenShareButton.addEventListener('click', async () => {
    if (!isScreenSharing) {
      // Запуск демонстрации экрана
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false, // можно включить аудио системного звука
        });

        screenVideoTrack = screenStream.getVideoTracks()[0];

        if (!screenVideoTrack) {
          throw new Error('Не удалось получить видеодорожку экрана');
        }

        // Обновляем состояние
        isScreenSharing = true;
        screenShareButton.innerHTML = '<i class="fas fa-stop"></i>';
        screenShareButton.classList.add('background__red');

        // Обработка остановки демонстрации через браузер
        screenVideoTrack.onended = () => {
          stopScreenSharing();
        };

        // Публикация трека экрана в WebRTC
        publishScreenTrack(screenVideoTrack);
      } catch (error) {
        console.error('Ошибка захвата экрана:', error);
        alert('Не удалось начать демонстрацию экрана. Проверьте разрешения.');
      }
    } else {
      stopScreenSharing();
    }
  });

  function stopScreenSharing() {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      screenStream = null;
      screenVideoTrack = null;
    }

    isScreenSharing = false;
    screenShareButton.innerHTML = '<i class="fa fa-desktop"></i>';
    screenShareButton.classList.remove('background__red');

    // Остановка публикации трека экрана
    stopScreenTrack();
  }

  // Обработчик полноэкранного режима
  fullscreenButton.addEventListener('click', () => {
    if (!videoMainContainer) return;

    const isFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (!isFullscreen) {
      // Вход в полноэкранный режим
      if (videoMainContainer.requestFullscreen) {
        videoMainContainer.requestFullscreen();
      } else if (videoMainContainer.webkitRequestFullscreen) {
        videoMainContainer.webkitRequestFullscreen();
      } else if (videoMainContainer.mozRequestFullScreen) {
        videoMainContainer.mozRequestFullScreen();
      } else if (videoMainContainer.msRequestFullscreen) {
        videoMainContainer.msRequestFullscreen();
      }
    } else {
      // Выход из полноэкранного режима
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  });
}
