(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.emojify = factory();
    }
}(this, function () {
        'use strict';

        var emojify = (function () {
            /**
             * NB!
             * The namedEmojiString variable is updated automatically by the
             * "update" gulp task. Do not remove the comment as this will
             * cause the gulp task to stop working.
             */
            var namedEmojiString =
            /*##EMOJILIST*/"+1,-1,airplane,alien,angel,angry,anguished,baby,balloon,bear,bee,beer,beers,blush,bomb,boom,bowtie,broken_heart,bulb,calendar,cat,clap,clock,closed_lock_with_key,cloud,coffee,cold_sweat,computer,confetti_ball,confounded,confused,cookie,cool,cop,cow,crown,cry,crying_cat_face,dancers,dash,disappointed,disappointed_relieved,dizzy,dog,ear,expressionless,eyes,fearful,fire,fist,flushed,frowning,ghost,gift,godmode,grimacing,grin,grinning,gun,hamster,hand,hatched_chick,hatching_chick,hear_no_evil,heart,heart_eyes,heart_eyes_cat,heartpulse,helicopter,horse,hushed,innocent,joy,joy_cat,key,kiss,kissing,kissing_cat,kissing_closed_eyes,kissing_face,kissing_heart,kissing_smiling_eyes,koala,laughing,lips,lock,metal,moneybag,monkey,monkey_face,mouse,muscle,neutral_face,no_mouth,nose,octocat,ok,older_man,older_woman,open_mouth,panda_face,pensive,persevere,pig,plus1,point_down,point_left,point_right,point_up,point_up_2,poop,pouting_cat,pray,princess,punch,rabbit,rage,rainbow,raised_hand,raised_hands,rat,relaxed,relieved,rocket,running,santa,satisfied,scream,scream_cat,see_no_evil,shipit,skull,sleeping,sleepy,smile,smile_cat,smiley,smiley_cat,smirk,smirk_cat,sob,sound,sparkles,speak_no_evil,squirrel,star,stuck_out_tongue,stuck_out_tongue_closed_eyes,stuck_out_tongue_winking_eye,sunglasses,sunny,sweat,sweat_smile,tada,thumbsdown,thumbsup,tiger,tired_face,tongue,troll,tv,uk,unamused,unlock,us,v,walking,warning,watch,wave,weary,wink,worried,x,yum,zap,zzz";

            var namedEmoji = namedEmojiString.split(/,/);

            /* The key is the alias */
            var alias = {
              "+1": "plus1"
            };

            /* A hash with the named emoji as keys */
            var namedMatchHash = namedEmoji.reduce(function(memo, v) {
                memo[v] = true;
                return memo;
            }, {});

            var emoticonsProcessed;
            var emojiMegaRe;

            function initEmoticonsProcessed() {
                /* List of emoticons used in the regular expression */
                var emoticons = {
         /* :..: */ named: /:([a-z0-9A-Z_-]+):/,
         /* :-)  */ smile: /:-?\)/g,
         /* :o   */ open_mouth: /:o/gi,
         /* :-o  */ scream: /:-o/gi,
         /* :-]  */ smirk: /[:;]-?]/g,
         /* :-D  */ grinning: /[:;]-?d/gi,
         /* X-D  */ stuck_out_tongue_closed_eyes: /x-d/gi,
         /* ;-p  */ stuck_out_tongue_winking_eye: /[:;]-?p/gi,
   /* :-[ / :-@  */ rage: /:-?[\[@]/g,
         /* :-(  */ frowning: /:-?\(/g,
         /* :'-( */ sob: /:['’]-?\(|:&#x27;\(/g,
         /* :-*  */ kissing_heart: /:-?\*/g,
         /* ;-)  */ wink: /;-?\)/g,
         /* :-/  */ pensive: /:-?\//g,
         /* :-s  */ confounded: /:-?s/gi,
         /* :-|  */ flushed: /:-?\|/g,
         /* :-$  */ relaxed: /:-?\$/g,
         /* <3   */ heart: /<3|&lt;3/g,
         /* </3  */ broken_heart: /<\/3|&lt;&#x2F;3/g,
         /* :+1: */ thumbsup: /:\+1:/g,
         /* :-1: */ thumbsdown: /:\-1:/g
                };

                if (defaultConfig.ignore_emoticons) {
                    emoticons = {
             /* :..: */ named: /:([a-z0-9A-Z_-]+):/,
             /* :+1: */ thumbsup: /:\+1:/g,
             /* :-1: */ thumbsdown: /:\-1:/g
                    };
                }

                return Object.keys(emoticons).map(function(key) {
                    return [emoticons[key], key];
                });
            }

            function initMegaRe() {
                /* The source for our mega-regex */
                var mega = emoticonsProcessed
                        .map(function(v) {
                            var re = v[0];
                            var val = re.source || re;
                            val = val.replace(/(^|[^\[])\^/g, '$1');
                            return "(" + val + ")";
                        })
                        .join('|');

                /* The regex used to find emoji */
                return new RegExp(mega, "gi");
            }

            var defaultConfig = {
                blacklist: {
                    'ids': [],
                    'classes': ['no-emojify'],
                    'elements': ['script', 'textarea', 'a', 'pre', 'code']
                },
                tag_type: null,
                only_crawl_id: null,
                img_dir: 'images/emoji',
                ignore_emoticons: false,
                mode: 'img'
            };

            /* Returns true if the given char is whitespace */
            function isWhitespace(s) {
                return s === ' ' || s === '\t' || s === '\r' || s === '\n' || s === '' || s === String.fromCharCode(160);
            }

            var modeToElementTagType = {
                'img': 'img',
                'sprite': 'span',
                'data-uri': 'span'
            };

            /* Given a match in a node, replace the text with an image */
            function insertEmojicon(args) {
                var emojiElement = null;


                if(args.replacer){
                    emojiElement = args.replacer.apply({
                            config: defaultConfig
                        },
                        [':' + args.emojiName + ':', args.emojiName]
                    );
                }
                else {
                    var elementType = defaultConfig.tag_type || modeToElementTagType[defaultConfig.mode];
                    emojiElement = args.win.document.createElement(elementType);

                    if (elementType !== 'img') {
                        emojiElement.setAttribute('class', 'emoji emoji-' + args.emojiName);
                    } else {
                        emojiElement.setAttribute('align', 'absmiddle');
                        emojiElement.setAttribute('alt', ':' + args.emojiName + ':');
                        emojiElement.setAttribute('class', 'emoji');
                        emojiElement.setAttribute('src', defaultConfig.img_dir + '/' + args.emojiName + '.png');
                    }

                    emojiElement.setAttribute('title', ':' + args.emojiName + ':');
                }

                args.node.splitText(args.match.index);
                args.node.nextSibling.nodeValue = args.node.nextSibling.nodeValue.substr(
                    args.match[0].length,
                    args.node.nextSibling.nodeValue.length
                );
                emojiElement.appendChild(args.node.splitText(args.match.index));
                args.node.parentNode.insertBefore(emojiElement, args.node.nextSibling);
            }

            /* Given an regex match, return the name of the matching emoji */
            function getEmojiNameForMatch(match) {
                /* Special case for named emoji */
                if(match[1] && match[2]) {
                    var named = match[2];
                    if(namedMatchHash.hasOwnProperty(named)) { return alias.hasOwnProperty(named) ? alias[named] : named; }
                    return;
                }
                for(var i = 3; i < match.length - 1; i++) {
                    if(match[i]) {
                        return emoticonsProcessed[i - 2][1];
                    }
                }
            }

            function defaultReplacer(emoji, name) {
                return "<span class='grdme-emoji grdme-emoji-" + name + "' alt=':" + name + ":'></span>";
            }

            function Validator() {
                this.lastEmojiTerminatedAt = -1;
            }

            Validator.prototype = {
                validate: function(match, index, input) {
                    var self = this;

                    /* Validator */
                    var emojiName = getEmojiNameForMatch(match);
                    if(!emojiName) { return; }

                    var m = match[0];
                    var length = m.length;
                    // var index = match.index;
                    // var input = match.input;

                    function success() {
                        self.lastEmojiTerminatedAt = length + index;
                        return emojiName;
                    }

                    /* At the beginning? */
                    if(index === 0) { return success(); }

                    /* At the end? */
                    if(input.length === m.length + index) { return success(); }

                    var hasEmojiBefore = this.lastEmojiTerminatedAt === index;
                    if (hasEmojiBefore) { return success();}

                    /* Has a whitespace before? */
                    if(isWhitespace(input.charAt(index - 1))) { return success(); }

                    var hasWhitespaceAfter = isWhitespace(input.charAt(m.length + index));
                    /* Has a whitespace after? */
                    if(hasWhitespaceAfter && hasEmojiBefore) { return success(); }

                    return;
                }
            };

            function emojifyString (htmlString, replacer) {
                if(!htmlString) { return htmlString; }
                if(!replacer) { replacer = defaultReplacer; }

                emoticonsProcessed = initEmoticonsProcessed();
                emojiMegaRe = initMegaRe();

                var validator = new Validator();

                return htmlString.replace(emojiMegaRe, function() {
                    var matches = Array.prototype.slice.call(arguments, 0, -2);
                    var index = arguments[arguments.length - 2];
                    var input = arguments[arguments.length - 1];
                    var emojiName = validator.validate(matches, index, input);
                    if(emojiName) {
                        return replacer.apply({
                                config: defaultConfig
                            },
                            [arguments[0], emojiName]
                        );
                    }
                    /* Did not validate, return the original value */
                    return arguments[0];
                });

            }

            return {
                // Sane defaults
                defaultConfig: defaultConfig,
                emojiNames: namedEmoji,
                setConfig: function (newConfig) {
                    Object.keys(defaultConfig).forEach(function(f) {
                        if(f in newConfig) {
                            defaultConfig[f] = newConfig[f];
                        }
                    });
                },

                replace: emojifyString
            };
        })();

        return emojify;
    }
));
