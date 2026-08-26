# TuServer Music

**TuServer Music** es un bot de Discord que permanece en un canal de voz configurado y reproduce, en orden, los archivos de audio guardados en `music/`. Al terminar la última pista, vuelve a la primera. Incluye comandos de barra, comandos con prefijo y un panel de control para pausar, reanudar, saltar pistas y elegir el modo de repetición.

> **Seguridad:** el archivo `.env` contiene el token de Discord y otros identificadores privados. No debe añadirse al control de versiones ni compartirse. El repositorio incluye `.env.example`, una plantilla segura que debes copiar y completar localmente.

## Configuración inicial

Instala una versión de Node.js compatible (el proyecto requiere Node.js 22.12.0 o superior), instala las dependencias y crea tu archivo de configuración a partir de la plantilla.

```bash
npm install
cp .env.example .env
```

Completa los valores de `.env` con el token de tu aplicación de Discord, el ID del servidor autorizado y el ID del canal de voz donde se conectará el bot. Si quieres restringir el panel a determinados roles, añade uno o más IDs de roles separados por comas en `ADMIN_ROL`. Deja esa variable vacía si todas las personas del servidor podrán utilizarlo.

| Variable | Uso |
| --- | --- |
| `DISCORD_TOKEN` | Token privado de la aplicación de Discord. |
| `GUILD_ID` | ID del único servidor donde el bot podrá funcionar. |
| `VOICE_CHANNEL_ID` | ID del canal de voz al que se conectará al arrancar. |
| `PREFIX` | Prefijo de los comandos de texto. El valor recomendado es `tuserver!`. |
| `ADMIN_ROL` | IDs de roles autorizados a usar el panel, separados por comas. |

Cuando la configuración esté completa, inicia el bot:

```bash
npm start
```

## Música y comandos

Añade archivos `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac` o `.aac` a la carpeta `music/`. El bot carga las pistas desde esa carpeta; después de añadir o retirar archivos, reinícialo para que la lista se actualice.

| Comando | Descripción |
| --- | --- |
| `/play [cancion]` o `tuserver!play [cancion]` | Reanuda la música o selecciona una pista concreta. |
| `/skip` o `tuserver!skip` | Salta a la siguiente canción. |
| `/stop` o `tuserver!stop` | Pausa la música sin abandonar el canal de voz. |
| `/repit <veces>` o `tuserver!repit <veces>` | Repite la pista actual una, dos o tres veces, o hasta que se salte. |
| `/panel` o `tuserver!panel` | Muestra el panel con botones y menús de control. |
| `/help` o `tuserver!help` | Muestra la ayuda integrada. |

## Identidad del bot

La presencia, el panel, la ayuda y el paquete se han adaptado a **TuServer**. El nombre y el avatar que Discord muestra en la lista de miembros pertenecen a la aplicación de Discord, por lo que debes configurarlos desde el portal de desarrolladores de Discord antes de invitar el bot al servidor.

## Despliegue

Para un host de Node.js, sube los archivos del proyecto **sin** `.env` y define las mismas variables de entorno de manera privada en el panel del proveedor. La instancia debe mantenerse en ejecución de forma continua para que el bot siga conectado al canal de voz. El proyecto incluye binarios de `ffmpeg` en `bin/`; verifica que el host use Linux y una arquitectura compatible antes de iniciar el servicio.

## Licencia y contenido

Antes de distribuir música o ejecutar el bot en un servidor público, confirma que tienes autorización para utilizar los archivos de audio y que cumples las reglas de Discord y del proveedor de alojamiento.
