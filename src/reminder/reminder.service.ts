import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { differenceInHours, getHours } from 'date-fns';
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

const getUsername = (user) =>
  user.from.username
    ? '@' + user.from.username
    : user.from.first_name + ' ' + user.from.last_name;
@Injectable()
export class ReminderService {
  token = process.env.NODE_TELEGRAM;
  bot;
  constructor() {
    this.bot = new TelegramBot(this.token, { polling: true });
    this.bot.setMyCommands([
      //   { command: '/start', description: 'Помочь в поливе' },
      //   { command: '/stop', description: 'Отказаться от помощи' },
      //   { command: '/agree', description: 'Я сегодня буду поливать' },
      //   { command: '/disagree', description: 'Я сегодня не смогу' },
    ]);
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
      const chatId = meta.users[msg.chat.id].user.chat.id;
      delete meta.users[msg.chat.id];
      this.bot.sendMessage(
        chatId,
        `${getUsername(msg)} отказался от помощи в поливе :( осталось ${
          Object.keys(meta.users).length
        } участников`,
      );
    });

    this.bot.onText(/\/start/, (msg, match) => {
      this.addUser(msg);
    });
  }

  @Cron('* * * * * *')
  saveData() {
    fs.writeFileSync('./meta.json', JSON.stringify(meta));
  }
  @Cron('0 */20 * * * *')
  reminderWatering() {
    this.reminder();
  }
  reminder() {
    console.log(
      new Date().toString() + ' Reminder ',
      getHours(new Date()),
      differenceInHours(new Date(), new Date(meta.wateringToday.date)),
    );
    if (
      getHours(new Date()) > 8 &&
      getHours(new Date()) < 17 &&
      meta.chatId &&
      differenceInHours(new Date(), new Date(meta.wateringToday.date)) > 12
    ) {
      const user = getRandomUser();
      console.log('Ask ' + getUsername(meta.users[user].user), Date.now());
      if (user)
        this.bot.sendMessage(
          meta.users[user].user.chat.id,
          `${getUsername(
            meta.users[user].user,
          )} \n как насчет того, чтобы полить сегодня наши доблестные туи? \n просто нажмите на /agree если согластны \n или на /disagree если не сможете`,
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
        meta.chatId,
        `${getUsername(user)} \n Отказался поливуать туи`,
      );
      this.bot.sendMessage(user.chat.id, `Мы попросим кого-нибудь еще`);
    }
    this.reminder();
  }
  agree(user) {
    if (!meta.users[user.chat.id]) {
      this.addUser(user);
    }
    if (differenceInHours(new Date(), new Date(meta.wateringToday.date)) > 12) {
      this.bot.sendMessage(user.chat.id, `Спасибо большое, за заботу`);
      this.bot.sendMessage(
        meta.chatId,
        `${getUsername(user)} \n Согласился полить туи, как и ${meta.users[
          user.chat.id
        ].counter++} раз до этого`,
      );
      meta.wateringToday = {
        date: Date.now(),
        user: user.from.username,
      };
    } else {
      this.bot.sendMessage(
        user.chat.id,
        `Спасибо но уже другой пользователь согласился полить их.`,
      );
    }
  }
  addUser(user) {
    this.bot.sendMessage(
      user.chat.id,
      `Мы записали вас в очередь на полив туй, программа время от времени будет спрашивать вас об этой возможности, спасибо за помощь :D`,
    );
    if (!meta.users[user.chat.id] && meta.chatId) {
      this.bot.sendMessage(
        meta.chatId,
        `${getUsername(user)} поможет поливать. Всего участников: ${
          Object.keys(meta.users).length + 1
        }`,
      );
    }
    meta.users[user.chat.id] = {
      counter: 0,
      last: null,
      user: user,
    };
  }
}
