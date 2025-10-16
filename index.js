import { Telegraf, Markup } from "telegraf";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

const BOT_TOKEN = "7352494667:AAE4ozNZdOSg-gYTWKZjt-eREoKsk4UmYfg";
const SHEET_ID = "1p0oYa-bzPXpk-wEixBNnIIGzCKrzWAALhlhX_nzDyo4";
const CREDENTIALS_PATH = "./google-credentials.json"; // JSON-файл от Google Cloud

const bot = new Telegraf(BOT_TOKEN);

// Авторизация Google
async function getVacancies() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "A2:D", // Пропускаем заголовки
  });

  const rows = res.data.values || [];
  return rows.map(([id, title, city, description]) => ({
    id,
    title,
    city,
    description,
  }));
}

// Команда /start
bot.start((ctx) =>
  ctx.reply(
    "👋 Привет! Я бот с вакансиями.\nНажми /jobs чтобы посмотреть список."
  )
);

// Команда /jobs
bot.command("jobs", async (ctx) => {
  const vacancies = await getVacancies();
  if (!vacancies.length) return ctx.reply("Пока нет активных вакансий 🙈");

  const buttons = vacancies.map((v) =>
    [Markup.button.callback(`${v.title} (${v.city})`, `job_${v.id}`)]
  );

  await ctx.reply("📋 Доступные вакансии:", Markup.inlineKeyboard(buttons));
});

// Нажатие на вакансию
bot.action(/job_(.+)/, async (ctx) => {
  const vid = ctx.match[1];
  const vacancies = await getVacancies();
  const v = vacancies.find((v) => v.id === vid);

  if (!v) return ctx.reply("Вакансия не найдена.");

  await ctx.reply(
    `💼 *${v.title}*\n📍 ${v.city}\n\n${v.description}\n\nХочешь откликнуться? Отправь мне свой файл-резюме.`,
    { parse_mode: "Markdown" }
  );

  // Сохраняем текущую вакансию, на которую откликается пользователь
  ctx.session = ctx.session || {};
  ctx.session.applyFor = v.id;
});

// Приём файла
bot.on("document", async (ctx) => {
  const fileId = ctx.message.document.file_id;
  const fileName = ctx.message.document.file_name;
  const user = ctx.from;

  const fileLink = await ctx.telegram.getFileLink(fileId);

  // Можно сохранить в БД или просто логировать
  console.log("Новый отклик:", {
    user: user.username || user.first_name,
    file: fileLink.href,
    vacancyId: ctx.session?.applyFor,
  });

  await ctx.reply("✅ Спасибо! Мы получили твоё резюме.");
});

// Запуск
bot.launch();
console.log("🤖 Бот запущен");
