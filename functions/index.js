"use strict";

process.env.DEBUG = "actions-on-google:*";

const App = require("actions-on-google").DialogflowApp;
const functions = require("firebase-functions");
const i18n = require("i18n");
const { sprintf } = require('sprintf-js');

const INPUT_WELCOME_ACTION = "input.welcome";
const INPUT_NUMBERS_ACTION = "input.numbers";
const QUIT_ACTION = "quit";
const PLAY_AGAIN_YES_ACTION = "play_again.yes";
const PLAY_AGAIN_NO_ACTION = "play_again.no";
const INPUT_UNKNOWN_GAME_ACTION = "input.unknown.game";
const INPUT_UNKNOWN_PLAY_AGAIN_ACTION = "input.unknown.play_again";
const HELP_RULE_ACTION = "help.rule";
const HELP_HINT_ACTION = "help.hint";

const GAME_CONTEXT = "game";
const PLAY_AGAIN_CONTEXT = "play_again";

const NUMBER1_PARAM = "number1";
const NUMBER2_PARAM = "number2";
const NUMBER3_PARAM = "number3";

exports.hitAndBlow = functions.https.onRequest((request, response) => {
    const app = new App({request, response});

    console.log("Request headers: " + JSON.stringify(request.headers));
    console.log("Request body: " + JSON.stringify(request.body));
    console.log("app.getUserLocale(): " + app.getUserLocale());

    i18n.configure({
        locales: ["en-US", "ja-JP"],
        directory: __dirname + "/locales",
        defaultLocale: "en-US"
    });

    i18n.setLocale(app.getUserLocale());

    const _sprintf = (message, params) => {
        if (params.length > 0) {
            return sprintf(message, ...params);
        } else {
            return message;
        }
    };

    const _i18n = (name, ...params) => {
        const message = i18n.__(name);
        if (Array.isArray(message)) {
            return _sprintf(message[Math.floor(Math.random() * message.length)], params);
        } else {
            return _sprintf(message, params);
        }
    };

    const _noInputGame = () => {
        return i18n.__("NO_INPUT_GAME");
    };

    const _noInputPlayAgain = () => {
        return i18n.__("NO_INPUT_PLAY_AGAIN");
    };

    const _generateAnswer = () => {
        const result = [];
        _addUniqueNumber(result);
        _addUniqueNumber(result);
        _addUniqueNumber(result);
        return result;
    };

    const _initializeGame = (app) => {
        const data = app.data;
        data.answer = _generateAnswer();
        data.hint = 0;
        data.hintIndexes = [0, 1, 2].sort(() => {
            return Math.random() - .5;
        });
    };

    const _addUniqueNumber = (result) => {
        let number = -1;
        do {
            number = Math.floor(Math.random() * 9) + 1;
        } while(result.includes(number));
        result.push(number);
    };

    const inputWelcome = (app) => {
        _initializeGame(app);
        app.ask(_i18n("WELCOME"), _noInputGame());
    };

    const _validateNumber = (n) => {
        return 1 <= n && n <= 9;
    };

    const _isNotSame = (n1, n2) => {
        return n1 !== n2;
    };

    const _isNotSameAll = (n1, n2, n3) => {
        return _isNotSame(n1, n2) && _isNotSame(n2, n3) && _isNotSame(n1, n3);
    };

    const _validateNumbers = (n1, n2, n3) => {
        if (_validateNumber(n1) && _validateNumber(n2) && _validateNumber(n3) && _isNotSameAll(n1, n2, n3)) {
            return {
                result: true,
                number1: n1,
                number2: n2,
                number3: n3
            }
        } else {
            return {
                result: false
            }
        }
    };

    const _parseNumbers = (n1, n2, n3) => {
        if (n1 !== null && n2 !== null && n3 !== null) {
            return _validateNumbers(Number(n1), Number(n2), Number(n3));
        } else if (n1 !== null && n2 === null && n3 === null) {
            if (123 <= Number(n1) && Number(n1) <= 987) {
                const n = String(n1);
                if (n.length === 2) {
                    n1 = 0;
                } else {
                    n1 = Number(n.charAt(0));
                }
                n2 = Number(n.charAt(1));
                n3 = Number(n.charAt(2));
                return _validateNumbers(n1, n2, n3);
            } else {
                return {
                    result: false
                };
            }
        }
    };

    const _judgeNumbers = (answer, numbers) => {
        let hit = 0;
        let blow = 0;

        if (answer[0] === numbers.number1) {
            hit++;
        } else if (answer.indexOf(numbers.number1) !== -1) {
            blow++;
        }
        if (answer[1] === numbers.number2) {
            hit++;
        } else if (answer.indexOf(numbers.number2) !== -1) {
            blow++;
        }
        if (answer[2] === numbers.number3) {
            hit++;
        } else if (answer.indexOf(numbers.number3) !== -1) {
            blow++;
        }
        return {
            hit: hit,
            blow: blow
        };
    };

    const inputNumbers = (app) => {
        const data = app.data;
        const answer = data.answer;
        const number1 = app.getArgument(NUMBER1_PARAM);
        const number2 = app.getArgument(NUMBER2_PARAM);
        const number3 = app.getArgument(NUMBER3_PARAM);
        const numbers = _parseNumbers(number1, number2, number3);
        console.log("answer: " + answer);
        if (numbers.result) {
            const result = _judgeNumbers(answer, numbers);
            if (result.hit === 3) {
                app.setContext(PLAY_AGAIN_CONTEXT);
                app.setContext(GAME_CONTEXT, 0);
                app.ask(_i18n("3HIT"), _noInputPlayAgain());
            } else {
                let hitAndBlow = _i18n("HIT_AND_BLOW", result.hit, result.blow);
                if (result.hit + result.blow === 3) {
                    hitAndBlow += _i18n("ALMOST");
                } else if (result.hit + result.blow === 0) {
                    hitAndBlow += _i18n("NOTHING");
                }
                app.ask(hitAndBlow, _noInputGame());
            }
        } else {
            app.ask(_i18n("INVALID_NUMBER"), _noInputGame());
        }
    };

    const playAgainYes = (app) => {
        _initializeGame(app);
        app.ask(_i18n("PLAY_AGAIN_YES"), _noInputGame());
    };

    const playAgainNo = (app) => {
        app.tell(_i18n("PLAY_AGAIN_NO"));
    };

    const quit = (app) => {
        const answer = app.data.answer;
        app.tell(_i18n("QUIT", ...answer));
    };

    const inputUnknownGame = (app) => {
        app.ask(_i18n("INPUT_UNKNOWN_GAME"), _noInputGame());
    };

    const inputUnknownPlayAgain = (app) => {
        app.ask(_i18n("INPUT_UNKNOWN_PLAY_AGAIN"), _noInputPlayAgain());
    };

    const helpRule = (app) => {
        app.ask(_i18n("RULE"), _noInputGame());
    };

    const helpHint = (app) => {
        const data = app.data;
        const answer = data.answer;
        const hint = data.hint;
        data.hint = hint + 1;
        if (4 <= data.hint) {
            data.hint = 0;
        }
        if (hint === 0) {
            const sum = answer[0] + answer[1] + answer[2];
            app.ask(_i18n("HINT1", sum), _noInputGame());
        } else {
            const hintIndexes = data.hintIndexes;
            const n = answer[hintIndexes[hint - 1]];
            app.ask(_i18n("HINT2", n), _noInputGame());
        }
    };

    let actionMap = new Map();
    actionMap.set(INPUT_WELCOME_ACTION, inputWelcome);
    actionMap.set(INPUT_NUMBERS_ACTION, inputNumbers);
    actionMap.set(PLAY_AGAIN_YES_ACTION, playAgainYes);
    actionMap.set(PLAY_AGAIN_NO_ACTION, playAgainNo);
    actionMap.set(QUIT_ACTION, quit);
    actionMap.set(INPUT_UNKNOWN_GAME_ACTION, inputUnknownGame);
    actionMap.set(INPUT_UNKNOWN_PLAY_AGAIN_ACTION, inputUnknownPlayAgain);
    actionMap.set(HELP_RULE_ACTION, helpRule);
    actionMap.set(HELP_HINT_ACTION, helpHint);

    app.handleRequest(actionMap);
});
