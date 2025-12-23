// Sound playback disabled (react-native-sound incompatible with New Architecture)
// TODO: Implement with expo-av or react-native-track-player when needed

const SOUND_NAME = 'ankomst.mp3';
export const TRIP_REQUEST_AUTO_STOP_MS = 12000;

class TripRequestSoundManager {
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private isPlaying = false;

  play() {
    console.log('[TripRequestSound] 🔊 Would play trip request sound');
    this.startAutoStopTimer();
    this.isPlaying = true;
  }

  stop() {
    console.log('[TripRequestSound] 🔇 Stopping trip request sound');
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
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
}

export default new TripRequestSoundManager();
