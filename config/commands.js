const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const { listTracks, trackLabel } = require('./playlist');

const REPEAT_CHOICES = [
    { name: '1 vez (sin repetir)', value: '1' },
    { name: '2 veces', value: '2' },
    { name: '3 veces', value: '3' },
    { name: 'Repetir hasta /skip', value: 'infinito' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Reanuda la musica, o salta directamente a una cancion de la lista')
        .addStringOption(option =>
            option.setName('cancion')
                .setDescription('Cancion a reproducir (opcional, deja vacio para reanudar)')
                .setRequired(false)
                .setAutocomplete(true)
        ),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Pasa a la siguiente cancion de la lista'),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Para la musica (el bot NO sale del canal)'),
    new SlashCommandBuilder()
        .setName('repit')
        .setDescription('Repite la cancion actual')
        .addStringOption(option =>
            option.setName('veces')
                .setDescription('Cuantas veces repetir la cancion actual')
                .setRequired(true)
                .addChoices(...REPEAT_CHOICES)
        ),
    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Muestra el panel con botones para controlar la musica'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra todos los comandos disponibles')
];

const helpText = (prefix) => [
    '**TuServer Music - Comandos disponibles** (funcionan como `/comando` o `' + prefix + 'comando`)',
    '',
    '`play [cancion]` -> Reanuda la musica, o si indicas una cancion, salta a ella y sigue la lista desde ahi.',
    '`skip` -> Pasa a la siguiente cancion.',
    '`stop` -> Para la musica (el bot se queda en el canal).',
    '`repit <veces>` -> Repite la cancion actual 1, 2, 3 veces o hasta que uses `/skip`.',
    '`panel` -> Muestra un panel con botones y menus para controlar todo sin escribir comandos.',
    '`help` -> Muestra esta ayuda.',
    '',
    'El bot vive fijo en su canal de voz 24/7, reproduce las canciones de la carpeta `music/` en orden y, al llegar a la ultima, vuelve a empezar desde el principio.'
].join('\n');

// ===== Componentes reutilizables para el panel de botones =====

function buildControlRows(playlist) {
    const isPaused = playlist.__paused === true;

    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('music_toggle')
            .setLabel(isPaused ? 'Reanudar' : 'Parar')
            .setEmoji(isPaused ? '▶️' : '⏹️')
            .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('music_skip')
            .setLabel('Saltar')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Primary)
    );

    const tracks = listTracks().slice(0, 25);
    const trackSelect = new StringSelectMenuBuilder()
        .setCustomId('music_select_track')
        .setPlaceholder('Elegir cancion...')
        .addOptions(
            tracks.length > 0
                ? tracks.map(f => ({ label: trackLabel(f).slice(0, 100), value: f }))
                : [{ label: 'No hay canciones en la carpeta music/', value: 'none' }]
        )
        .setDisabled(tracks.length === 0);
    const trackRow = new ActionRowBuilder().addComponents(trackSelect);

    const repeatSelect = new StringSelectMenuBuilder()
        .setCustomId('music_select_repeat')
        .setPlaceholder('Modo de repeticion...')
        .addOptions(REPEAT_CHOICES.map(c => ({ label: c.name, value: c.value })));
    const repeatRow = new ActionRowBuilder().addComponents(repeatSelect);

    return [buttonsRow, trackRow, repeatRow];
}

function buildPanelContent(playlist) {
    const current = playlist.currentLabel() || 'Sin canciones';
    const estado = playlist.__paused ? 'Pausado' : 'Reproduciendo';
    return [
        '**Panel de control - TuServer Music**',
        `Sonando ahora: **${current}**`,
        `Estado: ${estado}  |  ${playlist.repeatDescription()}`
    ].join('\n');
}

module.exports = { commands, helpText, REPEAT_CHOICES, buildControlRows, buildPanelContent };
