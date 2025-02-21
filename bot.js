require("dotenv").config();
const { Telegraf } = require("telegraf");
const express = require("express");
const { Pool } = require("pg");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Для работы на Railway
});

// 📌 Команда /start
bot.start((ctx) => {
  ctx.reply("Привет! Отправь фото товара, цену и описание для публикации.");
});

// 📌 Прием фото и текста от пользователя
bot.on("photo", async (ctx) => {
  const photo = ctx.message.photo.pop();
  const caption = ctx.message.caption || "Без описания";
  const userId = ctx.from.id;
  const username = ctx.from.username || "не указан";

  try {
    const result = await pool.query(
      "INSERT INTO ads (user_id, username, photo_id, caption) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, username, photo.file_id, caption]
    );
    ctx.reply(`✅ Объявление добавлено! Посмотреть: /list`);
  } catch (err) {
    console.error("Ошибка при сохранении в БД:", err);
    ctx.reply("❌ Ошибка при добавлении объявления.");
  }
});

// 📌 Команда /list (показ объявлений)
bot.command("list", async (ctx) => {
  try {
    const result = await pool.query("SELECT * FROM ads ORDER BY created_at DESC LIMIT 5");
    if (result.rows.length === 0) {
      ctx.reply("Объявлений пока нет.");
      return;
    }

    result.rows.forEach((ad) => {
      ctx.replyWithPhoto(ad.photo_id, {
        caption: `🛍 ${ad.caption}\n👤 @${ad.username}`,
      });
    });
  } catch (err) {
    console.error("Ошибка при получении объявлений:", err);
    ctx.reply("❌ Ошибка при загрузке объявлений.");
  }
});

// 📌 API для Web App (получение объявлений)
app.get("/ads", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ads ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при загрузке объявлений:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// 📌 Запуск бота
bot.launch();
console.log("🤖 Бот запущен!");

// 📌 Запуск сервера Express
app.listen(3000, () => {
  console.log("🚀 Сервер запущен на порту 3000");
});