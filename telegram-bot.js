require('dotenv').config();
const { Telegraf } = require('telegraf');

// ==========================================
// НАСТРОЙКИ (берутся из .env)
// ==========================================
// TELEGRAM_BOT_TOKEN   — токен от @BotFather
// TELEGRAM_CHANNEL_ID  — куда пересылать: @имя_канала или -1001234567890
// TELEGRAM_FORWARD_MODE — forward (со ссылкой на автора) | copy (без пометки «Переслано»)
// TELEGRAM_ECHO_BACK   — 1, если бот должен ещё и присылать медиа обратно в чат
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const FORWARD_MODE = (process.env.TELEGRAM_FORWARD_MODE || 'forward').toLowerCase();
const ECHO_BACK = process.env.TELEGRAM_ECHO_BACK === '1';

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error('❌ Укажите TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID в файле .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ==========================================
// ОПРЕДЕЛЕНИЕ ТИПА СООБЩЕНИЯ
// ==========================================
// Порядок важен: у GIF есть поле document, у кружка — video_note.
const MESSAGE_TYPES = [
  ['photo', '🖼', 'фото'],
  ['animation', '🎞', 'GIF-анимацию'],
  ['video_note', '⭕️', 'видео-кружок'],
  ['video', '🎬', 'видео'],
  ['voice', '🎤', 'голосовое сообщение'],
  ['audio', '🎵', 'аудио'],
  ['document', '📎', 'файл'],
  ['sticker', '🌟', 'стикер'],
  ['location', '📍', 'локацию'],
  ['contact', '👤', 'контакт'],
  ['poll', '📊', 'опрос'],
  ['text', '💬', 'текст']
];

function describeMessage(msg) {
  for (const [key, emoji, label] of MESSAGE_TYPES) {
    if (msg[key]) return { key, emoji, label };
  }
  return { key: 'unknown', emoji: '📦', label: 'сообщение' };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function describeAuthor(from) {
  const name = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Без имени';
  const username = from.username ? ` (@${from.username})` : '';
  return `${escapeHtml(name)}${escapeHtml(username)} — ID <code>${from.id}</code>`;
}

// ==========================================
// ОТПРАВКА В КАНАЛ
// ==========================================
async function sendToChannel(ctx, { withHeader }) {
  const { message_id: messageId } = ctx.message;

  // В режиме copy пометки «Переслано от…» нет, поэтому автора подписываем сами.
  if (FORWARD_MODE === 'copy' && withHeader) {
    await ctx.telegram.sendMessage(
      CHANNEL_ID,
      `📨 Новое сообщение от ${describeAuthor(ctx.from)}`,
      { parse_mode: 'HTML' }
    );
  }

  if (FORWARD_MODE === 'copy') {
    await ctx.telegram.copyMessage(CHANNEL_ID, ctx.chat.id, messageId);
  } else {
    await ctx.telegram.forwardMessage(CHANNEL_ID, ctx.chat.id, messageId);
  }
}

// ==========================================
// АЛЬБОМЫ (несколько фото/видео одним сообщением)
// ==========================================
// Telegram присылает каждый элемент альбома отдельным апдейтом,
// поэтому ответ в чат собираем один — через короткую задержку.
const albums = new Map();

function scheduleAlbumReply(ctx, description) {
  const groupId = ctx.message.media_group_id;
  const album = albums.get(groupId) || { count: 0, timer: null };

  album.count += 1;
  if (album.timer) clearTimeout(album.timer);
  album.timer = setTimeout(() => {
    albums.delete(groupId);
    ctx.reply(
      `${description.emoji} Получил альбом: ${album.count} шт. (${description.label}) — переслал в канал.`
    ).catch(err => console.error('Ошибка ответа в чат:', err.message));
  }, 1500);

  albums.set(groupId, album);
}

// ==========================================
// КОМАНДЫ
// ==========================================
bot.start(ctx => ctx.reply(
  'Привет! 👋\n\n' +
  'Пришли мне текст, фото, видео или файл — я перешлю это в канал ' +
  'и напишу здесь, что именно получил.\n\n' +
  'Команда /id покажет ID текущего чата.'
));

bot.command('id', ctx => ctx.reply(`ID этого чата: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' }));

// ==========================================
// ОСНОВНОЙ ОБРАБОТЧИК СООБЩЕНИЙ
// ==========================================
bot.on('message', async ctx => {
  const msg = ctx.message;

  // Защита от петли, если бота добавили в сам канал-приёмник.
  if (String(ctx.chat.id) === String(CHANNEL_ID)) return;

  const description = describeMessage(msg);
  const isAlbumItem = Boolean(msg.media_group_id);

  // Заголовок с автором нужен один раз на сообщение (или на альбом),
  // поэтому альбом регистрируем до первой отправки.
  let withHeader = true;
  if (isAlbumItem) {
    withHeader = !albums.has(msg.media_group_id);
    if (withHeader) albums.set(msg.media_group_id, { count: 0, timer: null });
  }

  try {
    await sendToChannel(ctx, { withHeader });
  } catch (err) {
    console.error('Ошибка пересылки в канал:', err.message);
    await ctx.reply(
      '⚠️ Не смог переслать сообщение в канал.\n' +
      'Проверьте, что бот добавлен в канал администратором и TELEGRAM_CHANNEL_ID указан верно.'
    );
    return;
  }

  // Что написать в чат отправителю.
  if (isAlbumItem) {
    scheduleAlbumReply(ctx, description);
  } else {
    const caption = msg.text || msg.caption;
    const captionLine = caption && description.key !== 'text'
      ? `\nПодпись: «${caption}»`
      : '';
    const textLine = description.key === 'text' ? `\nТекст: «${msg.text}»` : '';

    await ctx.reply(
      `${description.emoji} Вы отправили ${description.label} — переслал в канал.${textLine}${captionLine}`
    );
  }

  // Опционально возвращаем то же самое медиа обратно в чат.
  if (ECHO_BACK && !isAlbumItem) {
    await ctx.telegram.copyMessage(ctx.chat.id, ctx.chat.id, msg.message_id)
      .catch(err => console.error('Ошибка echo:', err.message));
  }

  console.log(`📥 ${ctx.from.id} → ${description.label} → канал ${CHANNEL_ID}`);
});

bot.catch((err, ctx) => {
  console.error(`Ошибка обработки апдейта ${ctx.updateType}:`, err);
});

// ==========================================
// ЗАПУСК
// ==========================================
if (require.main === module) {
  bot.launch()
    .then(() => console.log(`🤖 Telegram-бот запущен. Режим: ${FORWARD_MODE}. Канал: ${CHANNEL_ID}`))
    .catch(err => {
      console.error('❌ Не удалось запустить бота:', err.message);
      process.exit(1);
    });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { bot, describeMessage };
