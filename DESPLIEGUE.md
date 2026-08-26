# Publicación y despliegue de TuServer Music

Este documento separa dos tareas que conviene no confundir: **publicar el código** en GitHub y **mantener el bot en ejecución**. GitHub guarda y versiona el proyecto; para que TuServer Music permanezca en el canal de voz, también necesitas un entorno Linux que ejecute `npm start` de forma persistente.

> No publiques el archivo `.env`, el token de Discord ni tus archivos de música. El proyecto ya incluye reglas para ignorarlos y una plantilla `.env.example` sin datos privados.

## Alternativas de alojamiento

| Enfoque | Ventajas y límites | Coste | Complejidad de puesta en marcha |
| --- | --- | --- | --- |
| Repositorio privado en GitHub + servicio administrado compatible con Node.js y procesos persistentes | Evita administrar el sistema operativo y suele ofrecer despliegue desde GitHub. Debe permitir un proceso que no se detenga, variables de entorno privadas y ejecutar el binario de `ffmpeg` incluido. | Variable según el proveedor y el tiempo de actividad. | Media. |
| Repositorio privado en GitHub + servidor virtual Linux | Ofrece control completo sobre Node.js, permisos, archivos de música y `ffmpeg`. Requiere mantener actualizaciones, seguridad y reinicios del servidor. | Variable según el proveedor y los recursos contratados. | Media-alta. |

Ambas alternativas son válidas. La primera simplifica la administración; la segunda proporciona mayor control y compatibilidad cuando un proveedor administrado limita procesos o binarios.

## Publicar el código en GitHub

Crea un repositorio privado, coloca este proyecto en su raíz y revisa el contenido antes de enviar el primer cambio. Asegúrate de que `.env`, `node_modules/` y la música no aparezcan entre los archivos preparados para publicar.

```bash
git init
git add .
git status
git commit -m "Preparar TuServer Music"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO_PRIVADO
git push -u origin main
```

El comando `git status` debe mostrar `.env.example`, pero **nunca** `.env`. Si un token se hubiera compartido previamente dentro de un archivo `.env` o un archivo comprimido, restablécelo en el portal de desarrolladores de Discord antes de poner el bot en marcha.

## Configurar el entorno de ejecución

En el proveedor de alojamiento, crea estas variables privadas con los valores de tu servidor. No las añadas al repositorio.

| Variable | Valor que debes configurar |
| --- | --- |
| `DISCORD_TOKEN` | Token actual y privado de la aplicación de Discord. |
| `GUILD_ID` | ID del servidor autorizado. |
| `VOICE_CHANNEL_ID` | ID del canal de voz fijo. |
| `PREFIX` | `tuserver!` u otro prefijo que prefieras. |
| `ADMIN_ROL` | IDs de roles autorizados, separados por comas; opcional. |

Configura el comando de instalación como `npm ci` y el comando de inicio como `npm start`. Si el proveedor no admite `npm ci`, usa `npm install`. El proceso necesita almacenamiento donde puedas cargar tus archivos de audio en `music/`, permisos de ejecución para `bin/ffmpeg` o `bin/ffmpeg-arm64`, y una instancia que continúe activa tras el arranque.

## Comprobación antes de abrirlo al público

Primero, cambia el nombre y el avatar de la aplicación a **TuServer** en el portal de desarrolladores de Discord. Después, invita el bot al único servidor que has configurado, carga una pista de audio autorizada en `music/` y arranca el proceso. Confirma que aparece en el canal de voz, que el panel responde y que la reproducción funciona antes de compartir la invitación.

La configuración actual limita el funcionamiento a `GUILD_ID`. Si el bot recibe una invitación a otro servidor, abandonará ese servidor automáticamente.
