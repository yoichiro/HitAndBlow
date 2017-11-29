"use strict";

process.env.DEBUG = "actions-on-google:*";
const App = require("actions-on-google").DialogflowApp;
const functions = require("firebase-functions");

const INPUT_WELCOME_ACTION = "input.welcome";
const INPUT_NUMBERS_ACTION = "input.numbers";
const QUIT_YES_ACTION = "quit.yes";
const PLAY_AGAIN_YES_ACTION = "play_again.yes";

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

    const _generateAnswer = () => {
        const result = [];
        _addUniqueNumber(result);
        _addUniqueNumber(result);
        _addUniqueNumber(result);
        return result;
    };

    const _addUniqueNumber = (result) => {
        let number = -1;
        do {
            number = Math.floor(Math.random() * 9) + 1;
        } while(result.includes(number));
        result.push(number);
    };

    const inputWelcome = (app) => {
        const data = app.data;
        data.answer = _generateAnswer();
        app.setContext(GAME_CONTEXT);
        app.ask("ヒットアンドブローへようこそ。全て異なる3桁の数字を当てるゲームです。0は含みません。最初の3桁の数字を言ってください。");
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
        console.log("numbers: ", number1, number2, number3);
        const numbers = _parseNumbers(number1, number2, number3);
        console.log("numbers: ", numbers);
        console.log("answer: " + answer);
        if (numbers.result) {
            const result = _judgeNumbers(answer, numbers);
            console.log(result);
            if (result.hit === 3) {
                app.setContext(PLAY_AGAIN_CONTEXT, 5);
                app.ask("おめでとうございます。3ヒットです！もう一度遊びますか？");
            } else {
                app.ask("" + result.hit + "ヒット" + result.blow + "ブローです");
            }
        } else {
            app.ask("0を含まない全て異なる3桁の数字を言ってください");
        }
    };

    const quitYes = (app) => {
        app.tell("ヒットアンドブローを終わります。また遊びましょう。");
    };

    let actionMap = new Map();
    actionMap.set(INPUT_WELCOME_ACTION, inputWelcome);
    actionMap.set(INPUT_NUMBERS_ACTION, inputNumbers);
    actionMap.set(QUIT_YES_ACTION, quitYes);

    app.handleRequest(actionMap);
});
