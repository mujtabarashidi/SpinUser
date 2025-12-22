import Sound from 'react-native-sound';

// Ensure category allows playback even in silent (app decides)
try { Sound.setCategory('Playback'); } catch { }

let current: Sound | null = null;

export function playArrivalChime() {
    // stop any existing
    if (current) {
        try { current.stop(() => current?.release()); } catch { }
        current = null;
    }

    const s = new Sound('ankomst.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
            console.log('[ArrivalChime] load failed', error);
            try { s.release(); } catch { }
            return;
        }
        current = s;
        s.setNumberOfLoops(0);
        s.play((success) => {
            if (!success) {
                console.log('[ArrivalChime] play failed');
            }
            try { s.release(); } catch { }
            current = null;
        });
    });
}

export function stopArrivalChime() {
    if (current) {
        try { current.stop(() => current?.release()); } catch { try { current.release(); } catch { } }
        current = null;
    }
}
