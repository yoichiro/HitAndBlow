"use strict";

const { dialogflow } = require("actions-on-google");
const functions = require("firebase-functions");
const i18n = require("i18n");
const { sprintf } = require('sprintf-js');
const { ConversationAnalytics, AssistantType } = require('conversation-analytics-client');

const GAME_CONTEXT = "game";
const PLAY_AGAIN_CONTEXT = "play_again";
const HEAR_HINT_CONTEXT = "hear_hint";

const analytics = new ConversationAnalytics({
    assistantType: AssistantType.ACTIONS_ON_GOOGLE,
    token: `${functions.config().analytics.token}`
});

const app = dialogflow();

i18n.configure({
    locales: ["en-US", "ja-JP"],
    directory: __dirname + "/locales",
    defaultLocale: "en-US"
});

const _setupLocale = conv => {
    i18n.setLocale(conv.user.locale);
};

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

const _initializeGame = (conv) => {
    const data = conv.data;
    data.answer = _generateAnswer();
    _clearHint(data);
};

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

const _clearHint = (data) => {
    data.hint = 0;
    data.hintIndexes = [0, 1, 2].sort(() => {
        return Math.random() - .5;
    });
    data.mistakeCountForHint = 0;
};

const _parseNumbers = (n1, n2, n3) => {
    console.log("number types", typeof n1, typeof n2, typeof n3);
    console.log("number null?", n1 !== null, n2 !== null, n3 != null);
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
    } else {
        return {
            result: false
        };
    }
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

const _validateNumber = (n) => {
    return 1 <= n && n <= 9;
};

const _isNotSame = (n1, n2) => {
    return n1 !== n2;
};

const _isNotSameAll = (n1, n2, n3) => {
    return _isNotSame(n1, n2) && _isNotSame(n2, n3) && _isNotSame(n1, n3);
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

const _initializeGameWithAnswer = (conv, answer) => {
    const data = conv.data;
    data.answer = answer;
    _clearHint(data);
};

const _treatNumber = n => {
    if (n == null) {
        return null;
    } else if (typeof n === "string") {
        if (n.length > 0) {
            return n;
        } else {
            return null;
        }
    } else {
        return n;
    }
};

app.intent("input_welcome", async (conv) => {
    _setupLocale(conv);
    _initializeGame(conv);
    conv.ask(_i18n("WELCOME"));
    await analytics.trace(conv);
});

app.intent(["input_numbers - context: game", "hear_hint_numbers - context: hear_hint"], async (conv, { number1, number2, number3 }) => {
    _setupLocale(conv);
    const data = conv.data;
    const answer = data.answer;
    const numbers = _parseNumbers(_treatNumber(number1), _treatNumber(number2), _treatNumber(number3));
    console.log("input numbers", number1, number2, number3);
    console.log("answer", answer, "challenge", numbers);
    if (numbers.result) {
        const result = _judgeNumbers(answer, numbers);
        if (result.hit === 3) {
            conv.contexts.set(PLAY_AGAIN_CONTEXT, 1);
            conv.contexts.delete(GAME_CONTEXT);
            conv.ask(_i18n("3HIT"));
        } else {
            let hitAndBlow = _i18n("HIT_AND_BLOW", result.hit, result.blow);
            if (result.hit + result.blow === 3) {
                hitAndBlow += _i18n("ALMOST") + _i18n("NEXT");
                conv.contexts.set(GAME_CONTEXT, 1);
                conv.ask(hitAndBlow);
            } else if (result.hit + result.blow === 0) {
                hitAndBlow += _i18n("NOTHING") + _i18n("NEXT");
                conv.contexts.set(GAME_CONTEXT, 1);
                conv.ask(hitAndBlow);
            } else {
                let mistakeCountForHint = data.mistakeCountForHint + 1;
                data.mistakeCountForHint = mistakeCountForHint;
                console.log("mistakeCountForHint", mistakeCountForHint);
                if (mistakeCountForHint % 3 === 0) {
                    hitAndBlow += _i18n("SUGGEST_HINT");
                    conv.contexts.delete(GAME_CONTEXT);
                    conv.contexts.set(HEAR_HINT_CONTEXT, 1);
                    conv.ask(hitAndBlow);
                } else {
                    conv.contexts.set(GAME_CONTEXT, 1);
                    conv.ask(hitAndBlow + _i18n("NEXT"));
                }
            }
        }
    } else {
        conv.contexts.set(GAME_CONTEXT, 1);
        conv.ask(_i18n("INVALID_NUMBER"));
    }
    await analytics.trace(conv);
});

app.intent("play_again_yes - context: play_again", async (conv) => {
    _setupLocale(conv);
    _initializeGame(conv);
    conv.ask(_i18n("PLAY_AGAIN_YES"));
    await analytics.trace(conv);
});

app.intent("play_again_no - context: play_again", async (conv) => {
    _setupLocale(conv);
    conv.close(_i18n("PLAY_AGAIN_NO"));
    await analytics.trace(conv);
});

app.intent("quit - context: game", async (conv) => {
    _setupLocale(conv);
    const answer = conv.data.answer;
    conv.close(_i18n("QUIT", ...answer));
    await analytics.trace(conv);
});

app.intent("input_unknown - context: game", async (conv) => {
    _setupLocale(conv);
    conv.ask(_i18n("INPUT_UNKNOWN_GAME"));
    await analytics.trace(conv);
});

app.intent("input_unknown - context: play_again", async (conv) => {
    _setupLocale(conv);
    conv.ask(_i18n("INPUT_UNKNOWN_PLAY_AGAIN"));
    await analytics.trace(conv);
});

app.intent("help_rule - context: game", async (conv) => {
    _setupLocale(conv);
    conv.ask(_i18n("RULE"));
    await analytics.trace(conv);
});

app.intent(["help_hint - context: game", "hear_hint_yes - context: hear_hint"], async (conv) => {
    _setupLocale(conv);
    const data = conv.data;
    const answer = data.answer;
    const hint = data.hint;
    data.hint = hint + 1;
    if (4 <= data.hint) {
        data.hint = 0;
    }
    if (hint === 0) {
        const sum = answer[0] + answer[1] + answer[2];
        conv.ask(_i18n("HINT1", sum) + _i18n("NEXT"));
    } else {
        const hintIndexes = data.hintIndexes;
        const n = answer[hintIndexes[hint - 1]];
        conv.ask(_i18n("HINT2", n) + _i18n("NEXT"));
    }
    conv.contexts.delete(HEAR_HINT_CONTEXT);
    await analytics.trace(conv);
});

app.intent("update_answer - context: game", async (conv, { number1 }) => {
    _setupLocale(conv);
    const numbers = _parseNumbers(_treatNumber(number1), null, null);
    _initializeGameWithAnswer(conv, [numbers.number1, numbers.number2, numbers.number3]);
    conv.ask(_i18n("UPDATE_ANSWER"));
    await analytics.trace(conv);
});

app.intent("hear_hint_no - context: hear_hint", async (conv) => {
    _setupLocale(conv);
    conv.contexts.delete(HEAR_HINT_CONTEXT);
    conv.ask(_i18n("HEAR_HINT_NO"));
    await analytics.trace(conv);
});

app.intent("hear_hint_unknown - context: hear_hint", async (conv) => {
    _setupLocale(conv);
    conv.contexts.delete(HEAR_HINT_CONTEXT);
    conv.ask(_i18n("INPUT_UNKNOWN_GAME"));
    await analytics.trace(conv);
});

app.intent("no_input - context: game", async (conv) => {
    _setupLocale(conv);
    conv.contexts.set(GAME_CONTEXT, 1);
    conv.ask(_i18n("NO_INPUT_GAME"));
    await analytics.trace(conv);
});

app.intent("no_input - context: play_again", async (conv) => {
    _setupLocale(conv);
    conv.contexts.set(PLAY_AGAIN_CONTEXT, 1);
    conv.ask(_i18n("NO_INPUT_PLAY_AGAIN"));
    await analytics.trace(conv);
});

exports.hitAndBlow = functions.https.onRequest(app);
