import Sound from 'react-native-sound';

const SOUND_NAME = 'ankomst.mp3';
export const TRIP_REQUEST_AUTO_STOP_MS = 12000;

Sound.setCategory('Playback');

class TripRequestSoundManager {
  private sound: Sound | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private isLoading = false;
  private isPlaying = false;

  play() {
    this.startAutoStopTimer();

    if (this.isLoading) {
      return;
    }

    if (this.sound && this.isPlaying) {
      return;
    }

    if (this.sound) {
      this.releaseSound(this.sound);
      this.sound = null;
    }

    this.isLoading = true;

    const soundInstance = new Sound(SOUND_NAME, Sound.MAIN_BUNDLE, (error) => {
      this.isLoading = false;

      if (error) {
        console.log('Kunde inte ladda ljud', error);
        soundInstance.release();
        return;
      }

      this.sound = soundInstance;
      soundInstance.setNumberOfLoops(-1);
      soundInstance.play((success) => {
        this.isPlaying = success;
        if (!success) {
          console.log('Uppspelning av ljud misslyckades');
          this.stop();
        }
      });

      this.isPlaying = true;
    });

    this.sound = soundInstance;
    this.isPlaying = false;
  }

  stop() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    if (this.sound) {
      this.releaseSound(this.sound);
      this.sound = null;
    }

    this.isLoading = false;
    this.isPlaying = false;
  }

  private startAutoStopTimer() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
    }

    this.stopTimer = setTimeout(() => {
      this.stop();
    }, TRIP_REQUEST_AUTO_STOP_MS);
  }

  private releaseSound(sound: Sound) {
    try {
      sound.stop(() => {
        sound.release();
      });
    } catch (error) {
      sound.release();
    }
  }
}

export default new TripRequestSoundManager();
