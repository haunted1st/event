require('dotenv').config();
const express = require('express');
const { 
  Client, GatewayIntentBits, Events,
  EmbedBuilder, ModalBuilder, TextInputBuilder, 
  TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  AttachmentBuilder
} = require('discord.js');

const app = express();
app.get('/', (_, res) => res.send('✅ Бот работает!'));
app.listen(3000, () => console.log('🌐 Express-сервер запущен на порту 3000'));

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages
  ] 
});

// ==========================================
// НАСТРОЙКИ РОЛЕЙ И АДМИН-КАНАЛА
// ==========================================
const ADMIN_CHANNEL_ID = '801357350068944916'; 

const LEADER_ROLE_ID = '801351610449002576';
const DEPUTY_ROLE_ID = '801355032900403201';
const HIGH_ROLE_ID = '801351828963852350';

// ==========================================
// НАСТРОЙКИ КАНАЛОВ ДЛЯ СЕРВЕРОВ (Впиши свои ID)
// ==========================================
const CHANNELS = {
  '6': {
    main: '1475196179368116427', 
    capt: '1475196197269405926'      
  },
  '15': {
    main: '1475210360725438777',   
    capt: '1475210400047038665'    
  }
};

const MAP_FILES = {
  'Ghetto': './maps/ghetto.png',
  'Industrial Area': './maps/industrial.png',
  'Vinewood': './maps/vinewood.png',
  'Sandy Shores': './maps/sandy.png',
  'Farm': './maps/farm.png',
  'City': './maps/city.png',
  'Mirror': './maps/mirror.png',
  'Redwood': './maps/redwood.png',
  'Windmill': './maps/windmill.png',
  'CAPT_IMAGE': './maps/capt.png'
};

const activeEvents = new Map();

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

function parseTimeInput(input) {
  if (!input) return 15;
  const str = input.toLowerCase().replace(/\s+/g, '');
  if (str === '+час' || str === 'час') return 60;
  if (str.includes('ч')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 60 : Math.round(num * 60);
  }
  const num = parseInt(str.replace(/\D/g, ''));
  return isNaN(num) ? 15 : num;
}

function getAdminPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🛠 Панель управления мероприятиями')
    .setDescription('Нажмите кнопку ниже, чтобы запустить новый сбор игроков.')
    .setColor(0x2B2D31);

  const startBtn = new ButtonBuilder()
    .setCustomId('start_setup')
    .setLabel('Создать сбор')
    .setEmoji('🚀')
    .setStyle(ButtonStyle.Success);
    
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(startBtn)] };
}

// ==========================================
// 1. ЗАПУСК БОТА
// ==========================================
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Бот вошел как ${client.user.tag}`);
  
  setTimeout(async () => {
    try {
      const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID);
      if (!adminChannel) return console.error('❌ Канал админов не найден!');

      const messages = await adminChannel.messages.fetch({ limit: 10 });
      await adminChannel.bulkDelete(messages).catch(() => {});

      await adminChannel.send(getAdminPanel());
      console.log(`✅ Панель управления создана!`);
    } catch (error) {
      console.error('❌ Ошибка при запуске:', error.message);
    }
  }, 2000);
});

// ==========================================
// 2. ОБРАБОТКА ИНТЕРАКЦИЙ (КНОПКИ И МЕНЮ)
// ==========================================
client.on(Events.InteractionCreate, async (interaction) => {
  const isAdmin = interaction.member?.roles.cache.has(LEADER_ROLE_ID) || 
                  interaction.member?.roles.cache.has(DEPUTY_ROLE_ID) || 
                  interaction.member?.roles.cache.has(HIGH_ROLE_ID);

  if (interaction.isButton() && interaction.customId === 'start_setup') {
    if (!isAdmin) return interaction.reply({ content: 'У вас нет прав!', ephemeral: true });
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('server_6').setLabel('6 Сервер').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('server_15').setLabel('15 Сервер').setStyle(ButtonStyle.Primary)
    );
    return interaction.reply({ content: 'Шаг 1: Выберите сервер', components: [row], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith('server_')) {
    if (!isAdmin) return;
    const serverId = interaction.customId.split('_')[1]; 
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup_mcl_${serverId}`).setLabel('MCL').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`setup_vzz_${serverId}`).setLabel('VZZ').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`setup_capt_${serverId}`).setLabel('CAPT').setStyle(ButtonStyle.Secondary)
    );
    return interaction.update({ content: `Шаг 2: Мероприятие (Сервер ${serverId})`, components: [row] });
  }

  if (interaction.isButton() && interaction.customId.startsWith('setup_')) {
    if (!isAdmin) return;
    const [_, type, serverId] = interaction.customId.split('_');
    
    if (type === 'capt') {
      const modal = new ModalBuilder().setCustomId(`modal_capt_${serverId}`).setTitle(`Настройка CAPT (Сервер ${serverId})`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('capt_square').setLabel('Квадрат').setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('capt_family').setLabel('Семья (Нападавшие)').setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('capt_time').setLabel('Время (цифрами - минуты)').setStyle(TextInputStyle.Short))
      );
      return interaction.showModal(modal);
    } 
    
    let options = [];
    if (type === 'mcl') options = ['Ghetto', 'Industrial Area', 'Vinewood', 'Sandy Shores', 'Farm', 'City', 'Mirror'].map(m => ({ label: m, value: `map_mcl_${serverId}_${m}` }));
    else if (type === 'vzz') options = ['Redwood', 'Windmill'].map(m => ({ label: m, value: `map_vzz_${serverId}_${m}` }));
    
    const mapMenu = new StringSelectMenuBuilder().setCustomId('select_map').setPlaceholder('Выберите карту').addOptions(options);
    return interaction.update({ content: `Шаг 3: Выберите карту`, components: [new ActionRowBuilder().addComponents(mapMenu)] });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_map') {
    if (!isAdmin) return;
    await interaction.deferUpdate();

    const parts = interaction.values[0].split('_'); 
    const eventRaw = parts[1];
    const serverId = parts[2];
    const mapName = parts.slice(3).join('_'); 
    const eventName = eventRaw.toUpperCase();
    
    await createEventMessage(interaction, eventName, mapName, eventName === 'MCL' ? 25 : 35, eventName === 'MCL' ? 5 : 5, mapName, null, serverId);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_capt_')) {
    await interaction.deferReply({ ephemeral: true });

    const serverId = interaction.customId.split('_')[2]; 
    const square = interaction.fields.getTextInputValue('capt_square');
    const family = interaction.fields.getTextInputValue('capt_family');
    const timeInput = interaction.fields.getTextInputValue('capt_time');
    
    const timeMinutes = parseTimeInput(timeInput);
    const details = `Квадрат: ${square} | Семья: ${family}`;
    
    await createEventMessage(interaction, 'CAPT', details, 35, 10, 'CAPT_IMAGE', timeMinutes, serverId);
  }

  // ==========================================
  // АДМИН-МЕНЮ РЕДАКТИРОВАНИЯ ИГРОКА (НОВОЕ)
  // ==========================================
  // Шаг 1: Админ выбрал пользователя из выпадающего списка
  if (interaction.isUserSelectMenu() && interaction.customId.startsWith('select_edit_')) {
    if (!isAdmin) return;
    const eventId = interaction.customId.replace('select_edit_', '');
    const data = activeEvents.get(eventId);
    
    if (!data) return interaction.update({ content: 'Сбор больше неактивен.', components: [] });

    const targetUserId = interaction.values[0];
    const targetMention = `<@${targetUserId}>`;

    const inMain = data.pluses.includes(targetMention);
    const inSub = data.subs.includes(targetMention);

    if (!inMain && !inSub) {
      return interaction.update({ content: `❌ Пользователь ${targetMention} не участвует в этом сборе.`, components: [] });
    }

    const row = new ActionRowBuilder();
    
    if (inMain) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`adm_tosub_${eventId}_${targetUserId}`).setLabel('В замену').setEmoji('🔄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`adm_rem_${eventId}_${targetUserId}`).setLabel('Удалить из списка').setEmoji('❌').setStyle(ButtonStyle.Danger)
      );
    } else if (inSub) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`adm_tomain_${eventId}_${targetUserId}`).setLabel('В основу').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`adm_rem_${eventId}_${targetUserId}`).setLabel('Удалить из списка').setEmoji('❌').setStyle(ButtonStyle.Danger)
      );
    }

    const status = inMain ? 'Основе' : 'Замене';
    return interaction.update({ content: `Игрок ${targetMention} сейчас находится в **${status}**.\nВыберите действие:`, components: [row] });
  }

  // Шаг 2: Обработка нажатия на кнопку "Переместить" или "Удалить"
  if (interaction.isButton() && interaction.customId.startsWith('adm_')) {
    if (!isAdmin) return;
    
    const parts = interaction.customId.split('_');
    const action = parts[1]; // tosub, tomain, rem
    const eventId = parts[2];
    const targetUserId = parts[3];
    const targetMention = `<@${targetUserId}>`;

    const data = activeEvents.get(eventId);
    if (!data) return interaction.update({ content: 'Сбор больше неактивен.', components: [] });

    const removeUser = (arr, val) => { const idx = arr.indexOf(val); if (idx > -1) { arr.splice(idx, 1); return true; } return false; };
    let actionText = '';
    
    if (action === 'tosub') {
      if (data.subs.length >= data.maxSubs) return interaction.reply({ content: 'В замене нет мест!', ephemeral: true });
      removeUser(data.pluses, targetMention);
      if (!data.subs.includes(targetMention)) data.subs.push(targetMention);
      actionText = `переместил ${targetMention} в замену 🔄`;
    } else if (action === 'tomain') {
      if (data.pluses.length >= data.maxPlayers) return interaction.reply({ content: 'В основе нет мест!', ephemeral: true });
      removeUser(data.subs, targetMention);
      if (!data.pluses.includes(targetMention)) data.pluses.push(targetMention);
      actionText = `переместил ${targetMention} в основу ✅`;
    } else if (action === 'rem') {
      removeUser(data.pluses, targetMention);
      removeUser(data.subs, targetMention);
      actionText = `удалил ${targetMention} из списка ❌`;
    }

    // Записываем в логи, что это сделал Админ
    const timeNow = `<t:${Math.floor(Date.now() / 1000)}:T>`;
    data.logs.unshift(`${timeNow} - 👑 Админ ${actionText}`);
    if (data.logs.length > 7) data.logs.pop(); 

    // Обновляем публичное сообщение сбора
    try {
      const targetChannelId = data.eventName === 'CAPT' ? CHANNELS[data.serverId].capt : CHANNELS[data.serverId].main;
      const channel = await interaction.client.channels.fetch(targetChannelId);
      const mainMsg = await channel.messages.fetch(eventId);
      await mainMsg.edit({ embeds: [buildEventEmbed(data)] });
    } catch (err) {
      console.error("Ошибка обновления главного сообщения:", err);
    }

    // Закрываем менюшку у админа
    return interaction.update({ content: `✅ Вы успешно выполнили действие над ${targetMention}.`, components: [] });
  }

  // ==========================================
  // ОБРАБОТКА ОСНОВНЫХ КНОПОК ИГРОКОВ
  // ==========================================
  const playerButtons = ['btn_plus', 'btn_minus', 'btn_sub', 'btn_unsub', 'btn_publish', 'btn_edit_list'];
  if (interaction.isButton() && playerButtons.includes(interaction.customId)) {
    const data = activeEvents.get(interaction.message.id);
    if (!data) return interaction.reply({ content: 'Сбор больше неактивен.', ephemeral: true });

    // Обработка кнопки "Редактировать список"
    if (interaction.customId === 'btn_edit_list') {
      if (!isAdmin) return interaction.reply({ content: 'Только руководство может редактировать список!', ephemeral: true });

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`select_edit_${interaction.message.id}`)
        .setPlaceholder('Выберите игрока для редактирования...');

      const row = new ActionRowBuilder().addComponents(userSelect);
      return interaction.reply({ 
        content: '⚙️ **Управление игроками**\nКликните по меню ниже и выберите нужного участника из списка сбора:', 
        components: [row], 
        ephemeral: true 
      });
    }

    // Обработка кнопки "Опубликовать"
if (interaction.customId === 'btn_publish') {
      if (!isAdmin) return interaction.reply({ content: 'Только руководство может публиковать список!', ephemeral: true });

      // Формируем красивый текст с разделителями
      let publishedText = `📢 **Итоговый список на ${data.eventName} сформирован!**\n\n`;

      if (data.pluses.length === 0 && data.subs.length === 0) {
        publishedText += '*Никто не записался 😔*\n\n';
      } else {
        if (data.pluses.length > 0) {
          publishedText += `🛡️ **Основа:**\n${data.pluses.join(' ')}\n\n`;
        }
        if (data.subs.length > 0) {
          publishedText += `🔄 **Замена:**\n${data.subs.join(' ')}\n\n`;
        }
      }

      publishedText += `**Всем быть готовыми! Заходите в канал!**`;

      await interaction.channel.send({
        content: publishedText
      });

      const finalEmbed = buildEventEmbed(data);
      finalEmbed.setDescription(`**Инфо:** ${data.mapName}\n\n🛑 **СБОР ЗАКРЫТ (Опубликован вручную)**`);
      await interaction.message.edit({ embeds: [finalEmbed], components: buildPlayerButtons(true) });
      activeEvents.delete(interaction.message.id);

      return interaction.reply({ content: '✅ Список успешно опубликован!', ephemeral: true });
    }

    // Обработка кнопок записи игроков
    const userMention = `<@${interaction.user.id}>`;
    let changed = false;
    let actionText = '';
    const removeUser = (arr, val) => { const idx = arr.indexOf(val); if (idx > -1) { arr.splice(idx, 1); return true; } return false; };

    switch (interaction.customId) {
      case 'btn_plus':
        if (!data.pluses.includes(userMention)) {
          if (data.pluses.length >= data.maxPlayers) return interaction.reply({ content: 'Нет мест!', ephemeral: true });
          data.pluses.push(userMention); removeUser(data.subs, userMention); actionText = 'встал в основу [+]'; changed = true;
        } break;
      case 'btn_minus': if (removeUser(data.pluses, userMention)) { actionText = 'вышел [-]'; changed = true; } break;
      case 'btn_sub':
        if (!data.subs.includes(userMention)) {
          if (data.subs.length >= data.maxSubs) return interaction.reply({ content: 'Нет мест в замене!', ephemeral: true });
          data.subs.push(userMention); removeUser(data.pluses, userMention); actionText = 'в замену [🔄]'; changed = true;
        } break;
      case 'btn_unsub': if (removeUser(data.subs, userMention)) { actionText = 'убрал замену [❌]'; changed = true; } break;
    }

    if (changed) {
      const timeNow = `<t:${Math.floor(Date.now() / 1000)}:T>`;
      data.logs.unshift(`${timeNow} - ${userMention} ${actionText}`);
      if (data.logs.length > 7) data.logs.pop(); 
      return interaction.update({ embeds: [buildEventEmbed(data)] });
    }
    return interaction.deferUpdate();
  }
});

// ==========================================
// 3. ОСНОВНЫЕ ФУНКЦИИ ФОРМИРОВАНИЯ
// ==========================================

async function createEventMessage(interaction, eventName, mapName, maxPlayers, maxSubs, mapKey, timeMinutes = null, serverId) {
  const targetChannelId = eventName === 'CAPT' ? CHANNELS[serverId].capt : CHANNELS[serverId].main;
  const playerChannel = await interaction.client.channels.fetch(targetChannelId);
  
  const filePath = MAP_FILES[mapKey] || MAP_FILES['CAPT_IMAGE'];
  const file = new AttachmentBuilder(filePath);
  const fileName = filePath.split('/').pop();

  let targetTimestamp = null;
  if (timeMinutes) {
    targetTimestamp = Math.floor(Date.now() / 1000) + (timeMinutes * 60);
  }

  const eventData = { 
    eventName, mapName, maxPlayers, maxSubs, serverId,
    imageName: `attachment://${fileName}`, pluses: [], subs: [], logs: [], targetTimestamp 
  };
  
  const playerMsg = await playerChannel.send({ embeds: [buildEventEmbed(eventData)], components: buildPlayerButtons(), files: [file] });
  activeEvents.set(playerMsg.id, eventData);

  if (timeMinutes) {
    setTimeout(async () => {
      const data = activeEvents.get(playerMsg.id);
      if (!data) return; 

      const adminChannel = await interaction.client.channels.fetch(ADMIN_CHANNEL_ID);
      const formatList = (arr) => arr.length > 0 ? arr.map((p, i) => `**${i + 1}.** ${p}`).join('\n') : '*Никого*';
      
      const resultEmbed = new EmbedBuilder()
        .setTitle(`🏁 Итоги сбора: ${data.eventName} (Сервер ${data.serverId})`)
        .setDescription(`Сбор завершен!`)
        .setColor(0x00FF00)
        .addFields(
          { name: `Основа (${data.pluses.length})`, value: formatList(data.pluses), inline: true },
          { name: `Замена (${data.subs.length})`, value: formatList(data.subs), inline: true }
        )
        .setTimestamp();

      await adminChannel.send({ content: `<@&${LEADER_ROLE_ID}>, сбор окончен!`, embeds: [resultEmbed] });

      try {
        const finalEmbed = buildEventEmbed(data);
        finalEmbed.setDescription(`**Инфо:** ${data.mapName}\n\n🛑 **СБОР ЗАКРЫТ (Время вышло)**`);
        await playerMsg.edit({ embeds: [finalEmbed], components: buildPlayerButtons(true) }); 
      } catch (e) { console.error(e); }

      activeEvents.delete(playerMsg.id);
    }, timeMinutes * 60 * 1000); 
  }

  if (interaction.isStringSelectMenu()) {
    await interaction.editReply(getAdminPanel());
  } else {
    await interaction.editReply({ content: `✅ Сбор создан на сервере ${serverId}!` });
    const adminChannel = await interaction.client.channels.fetch(ADMIN_CHANNEL_ID);
    await adminChannel.send(getAdminPanel());
  }
}

function buildEventEmbed(data) {
  const formatList = (arr) => arr.length > 0 ? arr.map((p, i) => `**${i + 1}.** ${p}`).join('\n') : 'Пусто';
  const timeString = data.targetTimestamp ? `\n\n⏳ **Сбор закончится:** <t:${data.targetTimestamp}:R>` : '';

  let embedColor = 0x2B2D31;
  if (data.eventName === 'MCL') embedColor = 0xE74C3C; 
  else if (data.eventName === 'VZZ') embedColor = 0x3498DB; 
  else if (data.eventName === 'CAPT') embedColor = 0xF1C40F;

  const embed = new EmbedBuilder()
    .setTitle(`🔥 Сбор на ${data.eventName}`)
    .setDescription(`**Инфо:** ${data.mapName}${timeString}`)
    .setColor(embedColor)
    .addFields(
      { name: `Основа (${data.pluses.length}/${data.maxPlayers})`, value: formatList(data.pluses), inline: true },
      { name: `Замена (${data.subs.length}/${data.maxSubs})`, value: formatList(data.subs), inline: true },
      { name: 'Логи', value: data.logs.length > 0 ? data.logs.join('\n') : '...', inline: true }
    );

  if (data.imageName) {
    embed.setImage(data.imageName); 
  }

  return embed;
}

// НОВОЕ: Мы разбиваем кнопки на 2 ряда, так как в одном ряду Discord разрешает максимум 5 штук
function buildPlayerButtons(isDisabled = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_plus').setLabel('В основу').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(isDisabled),
    new ButtonBuilder().setCustomId('btn_minus').setLabel('Выйти').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(isDisabled),
    new ButtonBuilder().setCustomId('btn_sub').setLabel('В замену').setEmoji('🔄').setStyle(ButtonStyle.Primary).setDisabled(isDisabled),
    new ButtonBuilder().setCustomId('btn_unsub').setLabel('Убрать').setEmoji('➖').setStyle(ButtonStyle.Secondary).setDisabled(isDisabled),
    new ButtonBuilder().setCustomId('btn_publish').setLabel('Опубликовать').setEmoji('📢').setStyle(ButtonStyle.Success).setDisabled(isDisabled)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_edit_list').setLabel('Редактировать список').setEmoji('⚙️').setStyle(ButtonStyle.Secondary).setDisabled(isDisabled)
  );

  return [row1, row2]; // Возвращаем оба ряда
}

client.login(process.env.TOKEN);