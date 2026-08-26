const fs = require('fs');
const path = require('path');

const MUSIC_DIR = path.join(__dirname, '..', 'music');
const SUPPORTED_EXT = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];

function listTracks() {
    if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
    return fs.readdirSync(MUSIC_DIR)
        .filter(f => SUPPORTED_EXT.includes(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'es'));
}

function trackLabel(fileName) {
    return path.parse(fileName).name;
}

class Playlist {
    constructor() {
        this.index = 0;
        this.repeatMode = 'none'; // 'none' | 'count' | 'infinite'
        this.repeatRemaining = 0;
    }

    get tracks() {
        return listTracks();
    }

    current() {
        const tracks = this.tracks;
        if (tracks.length === 0) return null;
        if (this.index >= tracks.length) this.index = 0;
        return tracks[this.index];
    }

    currentPath() {
        const t = this.current();
        return t ? path.join(MUSIC_DIR, t) : null;
    }

    currentLabel() {
        const t = this.current();
        return t ? trackLabel(t) : null;
    }

    // Se llama cuando una pista termina sola (idle) - respeta el modo de repeticion
    advance() {
        if (this.repeatMode === 'infinite') return this.current();

        if (this.repeatMode === 'count') {
            if (this.repeatRemaining > 0) {
                this.repeatRemaining--;
                return this.current();
            }
            this.repeatMode = 'none';
        }

        const tracks = this.tracks;
        if (tracks.length === 0) return null;
        this.index = (this.index + 1) % tracks.length;
        return this.current();
    }

    // /skip: siempre corta cualquier repeticion y pasa a la siguiente
    skip() {
        this.repeatMode = 'none';
        this.repeatRemaining = 0;
        const tracks = this.tracks;
        if (tracks.length === 0) return null;
        this.index = (this.index + 1) % tracks.length;
        return this.current();
    }

    // /play <cancion>: salta directamente a una pista por nombre de archivo o por su nombre visible
    selectByName(name) {
        const tracks = this.tracks;
        const idx = tracks.findIndex(f => f === name || trackLabel(f) === name);
        if (idx === -1) return null;
        this.index = idx;
        this.repeatMode = 'none';
        this.repeatRemaining = 0;
        return this.current();
    }

    // mode: 'none' | 'count' | 'infinite'; times = numero total de veces a sonar (incluyendo la actual)
    setRepeat(mode, times = 1) {
        this.repeatMode = mode;
        this.repeatRemaining = mode === 'count' ? Math.max(0, times - 1) : 0;
    }

    repeatDescription() {
        if (this.repeatMode === 'infinite') return 'Repitiendo hasta /skip';
        if (this.repeatMode === 'count') return `Repitiendo (quedan ${this.repeatRemaining + 1} veces)`;
        return 'Sin repeticion';
    }
}

module.exports = { Playlist, listTracks, trackLabel, MUSIC_DIR };
