import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { differenceInCalendarDays, getHours } from 'date-fns';
import * as fs from 'fs';

const TelegramBot = require('node-telegram-bot-api');
let meta = {
  chatId: null,
  wateringToday: {
    user: null,
    date: 0,
  },
  users: {},
};
const getRandomUser = () =>
  Object.keys(meta.users)[
    Math.floor(Math.random() * Object.keys(meta.users).length)
  ];
@Injectable()
export class ReminderService {
  token = process.env.NODE_TELEGRAM;
  bot;
  constructor() {
    this.bot = new TelegramBot(this.token, { polling: true });

    try {
      meta = JSON.parse(fs.readFileSync('./meta.json', 'utf-8'));
    } catch (e) {}
    this.bot.onText(/\/reminder/, () => {
      this.reminder();
    });
    this.bot.onText(/\/agree/, (msg) => {
      this.agree(msg);
    });
    this.bot.onText(/\/disagree/, (msg) => {
      this.disagree(msg);
    });
    this.bot.onText(/\/set_group/, (msg, match) => {
      meta.chatId = msg.chat.id;
    });
    this.bot.onText(/\/stop/, (msg, match) => {
      const chatId = meta.users[msg.from.username].chatId;
      delete meta.users[msg.from.username];
      this.bot.sendMessage(
        chatId,
        `@${msg.from.username} отказался от помощи в поливе :( осталось ${
          Object.keys(meta.users).length
        } участников`,
      );
    });
    this.bot.onText(/\/start/, (msg, match) => {
      this.bot.sendMessage(
        meta.chatId,
        `@${msg.from.username} и еще ${
          Object.keys(meta.users).length
        } участников пом поливать туи`,
      );
      this.addUser(msg);
    });
  }

  @Cron('* * * * * *')
  saveData() {
    fs.writeFileSync('./meta.json', JSON.stringify(meta));
  }
  @Cron('* 1 * * * *')
  reminderWatering() {
    this.reminder();
  }
  reminder() {
    if (
      getHours(new Date()) > 10 &&
      getHours(new Date()) < 19 &&
      meta.chatId &&
      differenceInCalendarDays(new Date(), new Date(meta.wateringToday.date)) >
        1
    ) {
      const user = getRandomUser();
      if (user)
        this.bot.sendMessage(
          meta.users[user].chatId,
          `@${user} \n как насчет того, чтобы полить сегодня наши доблестные туи? \n просто нажмите на /agree если согластны \n или на /disagree если не сможете`,
        );
    }
  }
  disagree(user) {
    if (user.from.username === meta.wateringToday.user) {
      meta.wateringToday = {
        user: null,
        date: 0,
      };
      this.bot.sendMessage(
        meta.users[user.from.username].chatId,
        `Мы спросим кого-нибудь еще`,
      );
    }
    this.reminder();
  }
  agree(user) {
    if (
      differenceInCalendarDays(new Date(), new Date(meta.wateringToday.date)) >
      1
    ) {
      this.bot.sendMessage(user.chat.id, `Спасибо большое, за заботу`);
      if (!meta.users[user.from.username])
        this.bot.sendMessage(
          meta.chatId,
          `@${user.from.username} \n Согласился полить туи, как и ${meta.users[
            user.from.username
          ].counter++} раз до этого`,
        );
      meta.wateringToday = {
        date: Date.now(),
        user: user.from.username,
      };
    }
    if (!meta.users[user.from.username]) {
      this.addUser(user);
    }
  }
  addUser(user) {
    meta.users[user.from.username] = {
      counter: 0,
      last: null,
      chatId: user.chat.id,
    };
    this.bot.sendMessage(
      meta.users[user.from.username].chatId,
      `Мы записали вас, спасибо за помощь`,
    );
  }
}
