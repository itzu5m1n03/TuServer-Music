require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    EmbedBuilder,
    ActivityType
} = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    VoiceConnectionStatus,
    getVoiceConnection,
    entersState,
    generateDependencyReport
} = require('@discordjs/voice');

// Diagnostico: imprime que librerias de voz/cifrado/DAVE estan realmente
// disponibles en este servidor. Si el audio no suena, revisa este bloque
// en el log - sobre todo "Encryption Libraries" y "DAVE Protocol".
console.log(generateDependencyReport());

const { Playlist, listTracks, trackLabel } = require('./config/playlist');
const { createTrackResource } = require('./config/audio');
const { commands, helpText, buildControlRows, buildPanelContent } = require('./config/commands');

const PREFIX = process.env.PREFIX || 'tuserver!';
const ALLOWED_GUILD_ID = process.env.GUILD_ID;
const FIXED_VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const ADMIN_ROLE_IDS = (process.env.ADMIN_ROL || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

// Si no se configura ADMIN_ROL en el .env, el panel queda libre para todos
// (comportamiento de antes). Si se configura, solo miembros con al menos
// uno de esos roles pueden usar los botones/menus del panel.
function isAdmin(member) {
    if (ADMIN_ROLE_IDS.length === 0) return true;
    if (!member) return false;
    return ADMIN_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.startsWith('PON_AQUI')) {
    console.error('❌ Falta DISCORD_TOKEN en el .env. Rellénalo y vuelve a arrancar el bot.');
    process.exit(1);
}
if (!ALLOWED_GUILD_ID || !FIXED_VOICE_CHANNEL_ID) {
    console.error('❌ Faltan GUILD_ID o VOICE_CHANNEL_ID en el .env. Rellénalos y vuelve a arrancar el bot.');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const playlist = new Playlist();
playlist.__paused = false;

let currentPlayer = null;
let currentConnection = null;
let currentFfmpeg = null;

process.on('unhandledRejection', (err) => console.error('⚠️ unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('⚠️ uncaughtException:', err));

function getPlayer() {
    if (!currentPlayer) {
        currentPlayer = createAudioPlayer({
            behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });
    }
    return currentPlayer;
}

function killFfmpeg() {
    if (currentFfmpeg && !currentFfmpeg.killed) {
        currentFfmpeg.kill('SIGKILL');
    }
    currentFfmpeg = null;
}

// Reproduce la pista actual de la playlist. onEnded decide que pasa cuando termina sola.
function playCurrentTrack() {
    const player = getPlayer();
    killFfmpeg();
    playlist.__paused = false;

    const filePath = playlist.currentPath();
    if (!filePath) {
        console.warn('⚠️ La carpeta music/ está vacía. Sube al menos un archivo de audio.');
        return player;
    }

    console.log(`🎵 Reproduciendo: ${playlist.currentLabel()}`);

    const { resource, process: ffmpeg } = createTrackResource(filePath);
    currentFfmpeg = ffmpeg;

    ffmpeg.once('error', (err) => {
        console.error('⚠️ Error lanzando ffmpeg:', err.message);
    });

    player.play(resource);

    player.removeAllListeners('error');
    player.on('error', (error) => {
        console.error('⚠️ Error de audio:', error.message);
        killFfmpeg();
        if (!playlist.__paused) setTimeout(advanceAndPlay, 2000);
    });

    player.removeAllListeners(AudioPlayerStatus.Idle);
    player.on(AudioPlayerStatus.Idle, () => {
        if (!playlist.__paused) advanceAndPlay();
    });

    return player;
}

function advanceAndPlay() {
    const next = playlist.advance();
    if (!next) return;
    playCurrentTrack();
}

async function sendPanel(channel) {
    // Borra paneles viejos que el propio bot haya dejado en reinicios anteriores,
    // para no ir acumulando uno nuevo cada vez que se reinicia el proceso.
    try {
        const recent = await channel.messages.fetch({ limit: 20 });
        const ownMessages = recent.filter(m => m.author.id === client.user.id);
        for (const msg of ownMessages.values()) {
            await msg.delete().catch(() => {});
        }
    } catch (err) {
        console.error('⚠️ No se pudieron limpiar paneles anteriores:', err.message);
    }

    try {
        await channel.send({
            content: buildPanelContent(playlist),
            components: buildControlRows(playlist)
        });
        console.log('🎛️ Panel enviado al chat del canal de voz.');
    } catch (err) {
        console.error('⚠️ No se pudo enviar el panel al canal de voz:', err.message);
    }
}

async function joinFixedChannel(guild) {
    const channel = guild.channels.cache.get(FIXED_VOICE_CHANNEL_ID)
        || await guild.channels.fetch(FIXED_VOICE_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.error(`❌ No se encuentra el canal de voz ${FIXED_VOICE_CHANNEL_ID} en el servidor.`);
        return null;
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true
    });

    currentConnection = connection;
    setupReconnect(connection, guild);

    const player = playCurrentTrack();
    connection.subscribe(player);
    return { connection, channel };
}

function setupReconnect(connection, guild) {
    connection.removeAllListeners(VoiceConnectionStatus.Disconnected);
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000)
            ]);
        } catch {
            try { connection.destroy(); } catch (_) {}
            setTimeout(() => rejoin(guild), 3000);
        }
    });

    connection.removeAllListeners(VoiceConnectionStatus.Destroyed);
    connection.on(VoiceConnectionStatus.Destroyed, () => {
        setTimeout(() => rejoin(guild), 3000);
    });
}

async function rejoin(guild) {
    console.log(`🔄 Reconectando al canal fijo en ${guild.name}...`);
    await joinFixedChannel(guild);
}

// ===== Presencia =====
function setPermanentPresence() {
    client.user.setPresence({
        status: 'dnd',
        activities: [{ name: 'Música de TuServer', type: ActivityType.Playing }]
    });
}

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const appId = client.user.id;
    const body = commands.map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(appId), { body: [] });
    await rest.put(Routes.applicationGuildCommands(appId, ALLOWED_GUILD_ID), { body: [] });
    await rest.put(Routes.applicationGuildCommands(appId, ALLOWED_GUILD_ID), { body });
    console.log('✅ Slash commands actualizados al instante en el servidor autorizado.');
}

client.once('ready', async () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);

    await registerCommands();
    setPermanentPresence();
    setInterval(setPermanentPresence, 10 * 60 * 1000);

    const guild = client.guilds.cache.get(ALLOWED_GUILD_ID);
    if (!guild) {
        console.error('❌ El bot no está en el servidor indicado en GUILD_ID.');
        return;
    }

    const tracks = listTracks();
    console.log(`🎶 ${tracks.length} cancion(es) encontradas en music/: ${tracks.join(', ') || '(ninguna)'}`);

    const joined = await joinFixedChannel(guild);
    if (joined) await sendPanel(joined.channel);
});

client.on('shardResume', setPermanentPresence);

client.on('guildCreate', async (guild) => {
    if (guild.id !== ALLOWED_GUILD_ID) {
        console.log(`🚪 Añadido a un servidor no autorizado (${guild.name}), saliendo...`);
        await guild.leave().catch(() => {});
    }
});

// ===== Acciones compartidas entre slash commands y botones =====

function doSkip() {
    const next = playlist.skip();
    if (next) playCurrentTrack();
    return next;
}

function doStop() {
    playlist.__paused = true;
    getPlayer().pause(true);
}

function doResume() {
    const player = getPlayer();
    if (player.state.status === AudioPlayerStatus.Paused) {
        playlist.__paused = false;
        player.unpause();
    } else {
        // No habia nada cargado todavia (o se habia matado el stream): arrancamos de cero
        playCurrentTrack();
    }
}

function doSelectTrack(fileName) {
    const track = playlist.selectByName(fileName);
    if (track) playCurrentTrack();
    return track;
}

function doSetRepeat(veces) {
    if (veces === 'infinito') {
        playlist.setRepeat('infinite');
    } else {
        const n = parseInt(veces, 10) || 1;
        playlist.setRepeat(n > 1 ? 'count' : 'none', n);
    }
}

// ================= SLASH COMMANDS =================
client.on('interactionCreate', async (interaction) => {
    if (interaction.guildId !== ALLOWED_GUILD_ID) {
        if (interaction.isRepliable()) {
            return interaction.reply({ content: 'Este bot no está autorizado para funcionar en este servidor.', ephemeral: true }).catch(() => {});
        }
        return;
    }

    try {
        // --- Autocomplete para /play cancion ---
        if (interaction.isAutocomplete()) {
            const focused = interaction.options.getFocused().toLowerCase();
            const options = listTracks()
                .filter(f => trackLabel(f).toLowerCase().includes(focused))
                .slice(0, 25)
                .map(f => ({ name: trackLabel(f), value: f }));
            return interaction.respond(options);
        }

        // --- Botones ---
        if (interaction.isButton()) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '⛔ No tienes permiso para usar el panel.', ephemeral: true }).catch(() => {});
            }
            if (interaction.customId === 'music_toggle') {
                if (playlist.__paused) doResume(); else doStop();
            } else if (interaction.customId === 'music_skip') {
                doSkip();
            }
            return interaction.update({
                content: buildPanelContent(playlist),
                components: buildControlRows(playlist)
            });
        }

        // --- Menus desplegables ---
        if (interaction.isStringSelectMenu()) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '⛔ No tienes permiso para usar el panel.', ephemeral: true }).catch(() => {});
            }
            if (interaction.customId === 'music_select_track') {
                const value = interaction.values[0];
                if (value !== 'none') doSelectTrack(value);
            } else if (interaction.customId === 'music_select_repeat') {
                doSetRepeat(interaction.values[0]);
            }
            return interaction.update({
                content: buildPanelContent(playlist),
                components: buildControlRows(playlist)
            });
        }

        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'play') {
            const cancion = interaction.options.getString('cancion');
            if (cancion) {
                const track = doSelectTrack(cancion);
                if (!track) return interaction.reply({ content: 'No encuentro esa canción en la carpeta `music/`.', ephemeral: true });
                return interaction.reply(`▶️ Reproduciendo **${trackLabel(track)}**.`);
            }
            doResume();
            return interaction.reply(`▶️ Reanudando **${playlist.currentLabel() || 'la música'}**.`);
        }

        if (interaction.commandName === 'skip') {
            const next = doSkip();
            if (!next) return interaction.reply({ content: 'No hay canciones en la carpeta `music/`.', ephemeral: true });
            return interaction.reply(`⏭️ Ahora suena **${trackLabel(next)}**.`);
        }

        if (interaction.commandName === 'stop') {
            doStop();
            return interaction.reply('⏹️ Música parada. El bot sigue en el canal — usa `/play` para reanudar.');
        }

        if (interaction.commandName === 'repit') {
            const veces = interaction.options.getString('veces');
            doSetRepeat(veces);
            return interaction.reply(`🔁 ${playlist.repeatDescription()}.`);
        }

        if (interaction.commandName === 'panel') {
            return interaction.reply({
                content: buildPanelContent(playlist),
                components: buildControlRows(playlist)
            });
        }

        if (interaction.commandName === 'help') {
            const embed = new EmbedBuilder().setColor(0x5865F2).setDescription(helpText(PREFIX));
            return interaction.reply({ embeds: [embed] });
        }
    } catch (err) {
        console.error(`❌ Error manejando la interacción:`, err);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            interaction.reply({ content: 'Ha ocurrido un error ejecutando la acción.', ephemeral: true }).catch(() => {});
        }
    }
});

// ============== COMANDOS CON PREFIJO (tuserver!comando) ==============
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    if (message.guild?.id !== ALLOWED_GUILD_ID) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        if (command === 'play') {
            const cancion = args.join(' ');
            if (cancion) {
                const track = doSelectTrack(cancion) || doSelectTrack(listTracks().find(f => trackLabel(f).toLowerCase() === cancion.toLowerCase()));
                if (!track) return message.reply('No encuentro esa canción en la carpeta `music/`.');
                return message.reply(`▶️ Reproduciendo **${trackLabel(track)}**.`);
            }
            doResume();
            message.reply(`▶️ Reanudando **${playlist.currentLabel() || 'la música'}**.`);
        }

        if (command === 'skip') {
            const next = doSkip();
            message.reply(next ? `⏭️ Ahora suena **${trackLabel(next)}**.` : 'No hay canciones en la carpeta `music/`.');
        }

        if (command === 'stop') {
            doStop();
            message.reply('⏹️ Música parada. El bot sigue en el canal.');
        }

        if (command === 'repit') {
            const veces = args[0] === 'infinito' ? 'infinito' : (args[0] || '1');
            doSetRepeat(veces);
            message.reply(`🔁 ${playlist.repeatDescription()}.`);
        }

        if (command === 'panel') {
            message.reply({ content: buildPanelContent(playlist), components: buildControlRows(playlist) });
        }

        if (command === 'help') {
            message.reply(helpText(PREFIX));
        }
    } catch (err) {
        console.error(`❌ Error manejando ${PREFIX}${command}:`, err);
        message.reply('Ha ocurrido un error ejecutando el comando.').catch(() => {});
    }
});

client.on('error', (err) => console.error('⚠️ Client error:', err));
client.on('shardError', (err) => console.error('⚠️ Shard error:', err));

client.login(process.env.DISCORD_TOKEN);
