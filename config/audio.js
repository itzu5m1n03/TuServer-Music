const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Usamos un binario de ffmpeg incluido directamente en el proyecto (bin/)
// en vez del paquete npm "ffmpeg-static". Algunos hostings (como HidenCloud)
// bloquean los "install scripts" de npm por seguridad, y ese paquete necesita
// su script de instalación para DESCARGAR el binario real - si se bloquea,
// el paquete queda vacío y no suena nada. Llevando el binario ya listo dentro
// del zip nos aseguramos de que funcione sin depender de ningún script.
//
// IMPORTANTE: el binario tiene que coincidir con la arquitectura de CPU del
// servidor (x86_64 vs ARM64/aarch64). Si no coincide, el sistema no puede
// ejecutarlo y el intento de lanzarlo falla con un error raro tipo
// "Syntax error: "(" unexpected" (el SO intenta leer el binario como si
// fuera un script de texto). Muchos hostings "gratis" (HidenCloud entre
// ellos) usan servidores ARM64, así que aquí elegimos el binario según
// `os.arch()` en vez de asumir siempre x86_64.
const os = require('os');

const ARCH_TO_BINARY = {
    x64: 'ffmpeg',          // x86_64
    arm64: 'ffmpeg-arm64',  // ARM64 / aarch64
};

const binaryName = ARCH_TO_BINARY[os.arch()];
if (!binaryName) {
    console.error(`⚠️ Arquitectura de CPU no soportada (${os.arch()}). Añade un binario de ffmpeg compatible en bin/ y regístralo en ARCH_TO_BINARY dentro de config/audio.js.`);
}

const ffmpegPath = path.join(__dirname, '..', 'bin', binaryName || 'ffmpeg');

if (!fs.existsSync(ffmpegPath)) {
    console.error(`❌ No se encontró ${ffmpegPath}. Tu servidor usa CPU "${os.arch()}" y necesitas el binario de ffmpeg compilado para esa arquitectura dentro de bin/ (nombre esperado: "${binaryName}"). Descárgalo de https://www.johnvansickle.com/ffmpeg/ (build "arm64" o "amd64" según corresponda), renómbralo y súbelo a la carpeta bin/.`);
} else {
    try {
        fs.chmodSync(ffmpegPath, 0o755);
    } catch (err) {
        console.error('⚠️ No se pudo marcar el binario de ffmpeg como ejecutable:', err.message);
    }
}

// Convierte un archivo de audio local (mp3/wav/ogg/...) a Ogg/Opus al vuelo con ffmpeg.
// Esto es imprescindible: @discordjs/voice no puede enviar mp3 "en crudo" a Discord,
// necesita Opus.
function createTrackResource(filePath) {
    const ffmpeg = spawn(ffmpegPath, [
        '-i', filePath,
        '-vn',
        '-analyzeduration', '0',
        '-loglevel', 'error',
        '-f', 'ogg',
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    ffmpeg.stderr.on('data', (chunk) => {
        console.error(`[ffmpeg] ${chunk.toString().trim()}`);
    });

    ffmpeg.on('error', (err) => {
        console.error(`❌ No se pudo lanzar ffmpeg (${ffmpegPath}): ${err.message}`);
    });

    const resource = createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.OggOpus
    });

    return { resource, process: ffmpeg };
}

module.exports = { createTrackResource };
