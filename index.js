var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var g_all_users = [];
var g_socket_to_id = { };
var g_serial = 1;

var g_card_uid = 0;

var DECK_CARD_LIMIT = 10; // 公共牌池展示的牌数
var INIT_HAND_COUNT = 10; // 初始手牌数

// https://stackoverflow.com/questions/3954438/how-to-remove-item-from-array-by-value
Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

function Card(label, season) {
	this.label	= label;
	this.season = season;
	this.uid		= g_card_uid;
	g_card_uid += 1;
}
function CardToString(card) {
	return "【" + card.label + "・" + card.season + "】";
}
function ComputeMatchPairs(d, h) {
	var ret = [{}, {}];
	if (d == undefined || h == undefined) {
		// Nothing to do here
	} else {
		// 先是公共牌到手牌，然后是手牌到公共牌
		// 
		for (var i=0; i<d.length; i++) {
			if (i >= DECK_CARD_LIMIT) break;
			for (var j=0; j<h.length; j++) {
				if (d[i].season == h[j].season) {
					if (ret[0][i] == undefined) {
						ret[0][i] = [];
					}
					ret[0][i].push(j);

					if (ret[1][j] == undefined) {
						ret[1][j] = [];
					}
					ret[1][j].push(i);
				}
			}
		}
	}
	return ret;
}

var AllCards =
[
	new Card("百里屠苏","冬"),
	new Card("风晴雪","春"),
	new Card("方兰生","春"),
	new Card("陵越","冬"),
	new Card("尹千觞","秋"),
	new Card("乐无异","夏"),
	new Card("谢衣","夏"),
	new Card("沈夜","冬"),
	new Card("沈曦","春"),
	new Card("华月","冬"),
	new Card("禺期","夏"),
	new Card("闻人羽","秋"),
	new Card("夏夷则","冬"),
	new Card("清和真人","秋"),
	new Card("阿阮","春"),
	new Card("红玉","秋"),
	new Card("欧阳少恭","秋"),
	new Card("巽芳","春"),
	new Card("悭臾","夏"),
 
	new Card("长安","春"),
	new Card("静水湖","春"),
	new Card("忘川","冬"),
	new Card("流月城","冬"),
	new Card("百草谷","夏"),
	new Card("太华山","冬"),
	new Card("巫山","夏"),
	new Card("神女墓","冬"),
	new Card("青玉坛","秋"),
	new Card("榣山","秋"),
	new Card("蓬莱","夏"),
	new Card("琴川","春"),
	new Card("安陆","秋"),
	new Card("紫榕林","秋"),
	new Card("桃花谷","春"),
	new Card("天墉城","夏"),
	new Card("幽都","冬"),

	new Card("通天之器","秋"),
	new Card("兔子抱枕","秋"),
	new Card("华月的箜篌","冬"),
	new Card("焦炭","夏"),
	new Card("古剑晗光","冬"),
	new Card("金麒麟","秋"),
	new Card("露草","春"),
	new Card("昭明","春"),
	new Card("无名之剑","秋"),
	new Card("古剑红玉","夏"),
	new Card("古剑焚寂","夏"),
	new Card("凤来","春"),
	new Card("黑龙鳞片","夏"),
	new Card("青玉司南佩","春"),
	new Card("百胜刀","冬"),
];

// [牌面], [称呼, 积分]
var AllCombos = [
	[ [ "风晴雪", "焦炭", "谢衣" ], [ "厨房功夫", 10 ] ],
	[ [ "谢衣", "乐无异"], [ "春风雨", 4 ] ],
	[ [ "谢衣", "静水湖"], ["重山隐", 4 ] ] ,
	[ [ "谢衣", "沈夜"], ["孤月寒灯", 4] ] ,
	[ [ "谢衣", "忘川"], ["别破军", 4] ] ,
	[ [ "谢衣", "通天之器"], ["空留忆", 4] ] ,
	[ [ "流月城", "谢衣"], ["胡不归", 4] ] ,
	[ [ "流月城", "沈夜"], ["永夜寒沉", 4] ] ,
	[ [ "沈曦", "沈夜"], ["三日遥", 4] ] ,
	[ [ "流月城", "沈曦"], ["月中生", 4] ] ,
	[ [ "兔子抱枕", "沈曦"], ["伴长眠", 4] ] ,
	[ [ "华月的箜篌", "华月"], ["廉贞曲", 4] ] ,
	[ [ "流月城", "华月"], ["月之殇", 4] ] ,
	[ [ "华月", "沈夜"], ["护孤城", 4] ] ,
	[ [ "谢衣", "沈夜", "沈曦", "华月"], ["烈山遗族", 20] ] ,
	[ [ "谢衣", "沈夜", "沈曦", "流月城", "华月"], ["红月", 40] ] ,

	[ ["古剑晗光", "乐无异"], ["家传宝贝", 5] ],
	[ ["禺期", "古剑晗光", "乐无异"], ["剑主之谊", 10] ],
	[ ["长安", "乐无异"], ["玉京游", 4] ],
	[ ["闻人羽", "乐无异"], ["比肩行", 5] ],
	[ ["金麒麟", "闻人羽", "乐无异"], ["长相忆", 10] ],
	[ ["百草谷", "闻人羽"],[ "星海天罡", 5] ],
	[ ["夏夷则", "太华山"], ["逸尘", 5] ],
	[ ["夏夷则", "露草"], ["待佳期", 4] ],
	[ ["太华山", "清和真人"], ["太华山人", 4] ],
	[ ["夏夷则", "清和真人"], ["严师胜父", 4] ],
	[ ["夏夷则", "阿阮"], ["光逐影", 5] ],
	[ ["夏夷则", "太华山", "清和真人"], ["温茶相待", 10] ],
	[ ["露草", "阿阮"], ["共株生", 4] ],
	[ ["昭明", "阿阮"], ["芳草心", 4] ],
	[ ["巫山", "阿阮"], ["山鬼", 5] ],
	[ ["神女墓", "巫山"], ["神女静眠", 4] ],
	[ ["巫山", "露草", "阿阮"], ["露草流萤", 10] ],
	[ ["巫山", "露草", "阿阮", "神女墓"], ["巫山神女", 20] ],
	[ ["禺期", "红玉"], ["古剑剑灵", 4] ],
	[ ["禺期", "昭明"], ["铸剑仙师", 4] ],
	[ ["禺期", "无名之剑"], ["历劫重生", 4] ],
	[ ["禺期", "古剑晗光"], ["未成之剑", 4] ],
	[ ["昭明", "无名之剑", "古剑晗光"], ["千年一器", 10] ],
	[ ["昭明", "无名之剑", "古剑晗光", "禺期"], ["天地熔炉", 20] ],
	[ ["昭明", "无名之剑", "古剑焚寂", "古剑红玉", "古剑晗光"], ["古剑奇谭", 40] ],
	[ ["夏夷则", "阿阮", "闻人羽", "乐无异"], ["蓝衫偃师记", 20] ],

	[ ["欧阳少恭", "青玉坛"], ["丹芷长老", 4] ],
	[ ["欧阳少恭", "凤来"], ["揽琴独照", 4] ],
	[ ["巽芳", "欧阳少恭"], ["仙山眷侣", 4] ],
	[ ["榣山", "欧阳少恭"], ["故地重回", 4] ],
	[ ["悭臾", "欧阳少恭"], ["榣山遗韵", 4] ],
	[ ["欧阳少恭", "蓬莱"], ["栖身之所", 4] ],
	[ ["巽芳", "蓬莱"], ["蓬莱公主", 4] ],
	[ ["巽芳", "蓬莱", "欧阳少恭"], ["芳华如梦", 10] ],
	[ ["黑龙鳞片", "悭臾"], ["应龙信物", 4] ],
	[ ["榣山", "悭臾"], ["水虺醉琴", 4] ],
	[ ["欧阳少恭", "方兰生"], ["琴川友", 4] ],
	[ ["琴川", "方兰生"], ["望乡", 4] ],
	[ ["方兰生", "青玉司南佩"], ["永相随", 4] ],
	[ ["百胜刀", "方兰生"], ["无情客", 4] ],
	[ ["安陆", "红玉"], ["明月青霜", 4] ],
	[ ["古剑红玉", "红玉"], ["剑舞红袖", 4] ],
	[ ["天墉城", "红玉"], ["千古剑灵", 4] ],
	[ ["紫榕林", "襄铃"], ["故林栖", 4] ],
	[ ["风晴雪", "百里屠苏", "桃花谷"], ["桃花幻梦", 10] ],
	[ ["风晴雪", "百里屠苏"], ["与子成说", 3] ],
	[ ["百里屠苏", "悭臾"], ["乘龙归", 3] ],
	[ ["百里屠苏", "天墉城"], ["云涌昆仑", 3] ],
	[ ["天墉城", "陵越"], ["天墉掌门", 4] ],
	[ ["百里屠苏", "陵越", "天墉城"], ["天墉旧事", 10] ],
	[ ["百里屠苏", "古剑焚寂"], ["焚焰血戮", 3] ],
	[ ["黑龙鳞片", "百里屠苏"], ["故友赠礼", 3] ],
	[ ["百里屠苏", "欧阳少恭"], ["琴心剑魄", 3] ],
	[ ["尹千觞", "欧阳少恭"], ["醉梦江湖", 4] ],
	[ ["尹千觞", "幽都"], ["幽都巫咸", 4] ],
	[ ["风晴雪", "尹千觞", "幽都"], ["永夜苍茫", 10] ],
	[ ["风晴雪", "尹千觞"], ["陌相逢", 4] ],
	[ ["风晴雪", "幽都"], ["幽都灵女", 4] ],
	[ ["风晴雪", "方兰生", "百里屠苏", "红玉", "尹千觞", "襄铃"], ["黑衣少侠传", 60] ],
];
function GetDeltaCombos(hand, curr_combos) {
	var ret = []; // 新增的组合
	for (var ci = 0; ci < AllCombos.length; ci ++) {
		var c = AllCombos[ci];
		var matched = true;
		for (var j=0; j<c[0].length; j++) {
			var found = false;
			for (var hh=0; hh<hand.length; hh++) {
				if (hand[hh].label == c[0][j]) {
					found = true; break;
				}
			}
			if (found == false) {
				matched = false;
				break;
			}
		}
		if (matched) {
			if (curr_combos.indexOf(ci) == -1) {
				curr_combos.push(ci);
				ret.push([c[1], ci]);
			}
		}
	}
	return ret;
}
function GetComboDescription(cidx) {
	var x = "组合 [", c = AllCombos[cidx];
	x = x + c[1][0] + "] = ";
	for (var i=0; i<c[0].length; i++) {
		if (i > 0) x += " + ";
		x += c[0][i];
	}
	x += "，" + c[1][1] + " 分";
	return x;
}
function TEST() {
	var h = [ AllCards[19], AllCards[48], AllCards[5], AllCards[46], AllCards[11] ];
	console.log(h);
	console.log(GetDeltaCombos(h, []));
}

function ShuffleArray(x) {
	var N = x.length;
	for (var i=0; i<N-1; i++) {
		var rem = N-(i+1), i1 = parseInt(Math.random() * rem) + i+1;
		var temp = x[i];
		x[i] = x[i1];
		x[i1] = temp;
	}
}

function Game(socket1, socket2) {
	this.socket1 = socket1;
	this.socket2 = socket2;
	this.socket2hand = { };
	this.hand1 = []; // 手牌
	this.hand2 = [];
	this.deck = [];  // 牌桌上的牌
	this.used1 = []; // 回收区的牌
	this.used2 = [];
	this.state = 'running'; 
	this.score1 = 0; // 当前得分
	this.score2 = 0;
	this.combos1 = []; // 已经出现过的组合
	this.combos2 = [];

	// 将随机一张手牌与牌桌上的牌对换
	this.ExchangeOneCard = function(socket) {
		var h;
		if (socket == this.socket1) { h = this.hand1; }
		else { h = this.hand2; }

		if (h.length < 1 || this.deck.length < 1) return;
		
		// 可以与隐藏起来的牌交换
		var idx_h = parseInt(Math.random() % h.length);
		var idx_d = parseInt(Math.random() % this.deck.length);
		var tmp = h[idx_h];
		h[idx_h] = this.deck[idx_d];
		this.deck[idx_d] = tmp;
	}

	// 是否可能行动
	this.HasMoves = function (socket) {
		var h;
		if (socket == this.socket1) {
			h = this.hand1;
		} else { h = this.hand2; }
		for (var i=0; i<h.length; i++) {
			for (var j=0; j<this.deck.length; j++) {
				if (j >= DECK_CARD_LIMIT) break;
				if (this.deck[j].season == h[i].season) return true;
			}
		}
		return false;
	}

	this.EmitGameStats = function(socket) {
		if (socket == undefined) return;
		if (socket == this.socket1) {
			this.socket1.emit('update game stats', this.deck, this.hand1,
			ComputeMatchPairs(this.deck, this.hand1), this.used1,
			this.used2, this.hand2,
			this.score1, this.score2);
		} else {
			this.socket2.emit('update game stats', this.deck, this.hand2,
			ComputeMatchPairs(this.deck, this.hand2), this.used2,
			this.used1, this.hand1,
			this.score2, this.score1);
		}

	}

	// 为socket所代表的玩家走一步棋
	this.MakeAMove = function(socket) {
		var other = this.GetOtherPlayer(socket);
		var h, u;
		if (socket == this.socket1) {
			h = this.hand1;
			u = this.used1;
		} else {
			h = this.hand2;
			u = this.used2;
		}

		// 这是最基本的round-robin策略
		var done = false;
		var LIMIT = 5, attempt = 0;
		while (done == false) {
			for (var i=0; i<h.length; i++) {
				for (var j=0; j<this.deck.length; j++) {
					if (h[i].season == this.deck[j].season) {
						other.emit('chat message', '人工智障打出了' + CardToString(h[i]) + " 和 " + CardToString(this.deck[j]));
						u.push(h[i]);   u.push(this.deck[j]);
						h.remove(h[i]); this.deck.remove(this.deck[j]);
						this.IncrementScore(socket, 4);
						done = true;
					}
					if (done) break;
				}
				if (done) break;
			}

			if (done == false) {
				// 给对方进行随机置换
				this.ExchangeOneCard(socket);
				attempt = attempt + 1;
				if (attempt > LIMIT) {
					this.EndGame();
					other.emit('chat message', '人工智障无法继续行动，游戏结束');
					return false;
				}
			} else {
				return true;
			}
		}
	}

	// 给指定玩家加上delta的得分，然后看满足了多少组合
	this.IncrementScore = function(socket, delta) {
		var u, h, cc, new_combos;
		if (socket == this.socket1) {
			h = this.hand1;
			cc = this.combos1;
		} else {
			h = this.hand2;
			cc = this.combos2;
		}

		var other = undefined;
		if (socket == this.socket1) {
			other = this.socket2;
			u = this.used1;
			this.score1 += 4;
			new_combos = GetDeltaCombos(u, cc);
			for (var i=0; i<new_combos.length; i++) {
				this.score1 += new_combos[i][0][1];
				var desc = GetComboDescription(new_combos[i][1]);
				if (socket != undefined) {
					socket.emit('chat message', desc);
					console.log(socket.my_serial + "'s score incremented to " + this.score1);
				}
				if (other != undefined) {
					other.emit('chat message', '对方获得 ' + desc);
					console.log("baaaaaaa");
				}
			}
		} else {
			other = this.socket1;
			u = this.used2;
			this.score2 += 4;
			new_combos = GetDeltaCombos(u, cc);
			for (var i=0; i<new_combos.length; i++) {
				this.score2 += new_combos[i][0][1];
				var desc = GetComboDescription(new_combos[i][1]);
				if (socket != undefined) {
					socket.emit('chat message', desc);
					console.log(socket.my_serial + "'s score incremented to " + this.score2);
				}
				if (other != undefined) {
					other.emit('chat message', '对方获得 ' + desc);
				}
			}
		}
	}

	// helper
	this.GetOtherPlayer = function(socket) {
		if (this.socket1 == socket) return this.socket2;
		else if (this.socket2 == socket) return this.socket1;
		else return undefined;
	}

	this.IsPossibleToMove = function(socket) {
		var h;
		if (socket == this.socket1) {
			h = this.hand1;
		} else { h = this.hand2; }
		if (h.length > 0) return true;
		return false;
	}

	// 会处理 玩家vs玩家 与 玩家vs人工智障 两种情况
	this.SwitchToOtherPlayer = function(curr, other, card_h, card_d) {
		if (other == undefined) {
			if (this.IsPossibleToMove(other)) {
				curr.emit('chat message', '人工智障正在行动中・・・');
				setTimeout(function(game) {
					var moved = game.MakeAMove(other);
					game.EmitGameStats(curr);
				}, 1000, this);

				setTimeout(function(game) {
					game.EmitHasMovesOrNot(curr);
				}, 2000, this);
			} else {
				curr.emit('chat message', '人工智障无法行动，游戏结束');
				this.EndGame();
			}
		} else {
			this.SetCurrentPlayer(other);
			this.EmitHasMovesOrNot(other);
		}
	}

	// socket的玩家是否能够走动
	this.EmitHasMovesOrNot = function(curr) {
		var other = undefined, curr_score = 0, other_score = 0;
		if (curr == this.socket1) { curr_score = this.score1; other_score = this.score2; other = this.socket2; }
		else { curr_score = this.score2; other_score = this.score1; other = this.socket1; }
		if (this.HasMoves(curr)) {
			curr.emit('chat message', '请从手牌与牌堆中分别选一张同季节的牌');
			curr.emit('game state change', 'pick two cards');
		} else {
			// 这里可能导致游戏结束
			if (this.ShouldEndGame(curr)) { 
				curr.emit('chat message', '游戏结束了！');
				if (curr_score > other_score) {
					curr.emit('chat message', '赢得此局！');
				} else if (curr_score == other_score) {
					curr.emit('chat message', '平局！');
				} else {
					curr.emit('chat message', '输掉了此局！');
				}
				if (other != undefined) {
					if (curr_score < other_score) {
						other.emit('chat message', '赢得此局！');
					} else if (curr_score == other_score) {
						other.emit('chat message', '平局！');
					} else {
						other.emit('chat message', '输掉了此局！');
					}
				}
				this.EndGame(); 
			} else {
				curr.emit('chat message', '没有配对的牌，需要置换一张');
				curr.emit('game state change', 'pick one card');
			}
		}
	}

	// 是不是双方都没法走了导致游戏必须结束
	this.ShouldEndGame = function(socket) {
		var h = this.socket2hand[socket];
		if (h.length < 1) return true;
		if (this.deck.length < 1) return true;
	}

	this.EndGame = function() {
		if (this.socket1 != undefined) {
			this.socket1.emit('game state change', 'game ended');
		}
		if (this.socket2 != undefined) {
			this.socket2.emit('game state change', 'game ended');
		}
		this.state = "ended";
	}

	this.Ended = function() { return this.state == "ended"; }

	this.CalculateCombo = function(socket) {
		var c, u;
		if (socket = this.socket1) { c = this.combos1; u = this.used1; }
	}

	this.SetCurrentPlayer = function(socket) {
		var other = undefined;
		this.current_player = socket;
		if (socket == this.socket1) { other = this.socket2; }
		else if (socket == this.socket2) { other = this.socket1; }

		if (!this.Ended()) {
			if (other != undefined)
				other.emit('game state change',  'other players move');
		} else {
		}
	}

	this.IsCurrentPlayer = function(socket) {
		return socket == this.current_player;
	}
};

var g_match_pool = []; // 配对池
var g_match_waitforconfirm = []; // 配对到了等待确认的玩家 { socket1: true/false, socket2: true/false }
function StartNewGame(socket1, socket2) {
	var g = new Game(socket1, socket2);
	if (socket1 != undefined) {
		socket1.game = g;
		socket1.emit('game state change', 'game started');
	}
	if (socket2 != undefined) {
		socket2.game = g;
		socket2.emit('game state change', 'game started');
	}

	// 洗牌
	var temp = [];
	for (var i=0; i<AllCards.length; i++) temp.push(AllCards[i]);
	ShuffleArray(temp);

	// 初始牌数
	var N = INIT_HAND_COUNT;
	g.hand1 = temp.splice(0, N);
	g.hand2 = temp.splice(0, N);
	g.deck =  temp.splice(0);
	g.socket2hand[socket1] = g.hand1;
	g.socket2hand[socket2] = g.hand2;
	return g;
}

app.get('/', function(req, res){
	res.sendFile(__dirname + "/index.html");
});

OnPlayerCancelsMatch = function(socket) {
	var x = g_match_waitforconfirm;
	for (var i=0; i<x.length; i++) {
		var other = undefined;
		if (x[i][0] == socket) {
			other = x[i][1];
		} else if (x[i][1] == socket) {
			other = x[i][0];
		}
		if (other != undefined) {
			other.match_confirmed = false;
			socket.match_confirmed = false;
			x.pop(i);
			other.emit('match cancelled', '匹配到的对方玩家取消了匹配');
			socket.emit('match cancelled', '你取消了匹配');
			break;
		}
	}
}

io.on('connection', function(socket){
	g_all_users.push(socket);
	g_serial += 1;
	g_socket_to_id[socket] = g_serial;
	socket.my_serial = g_serial
	console.log('user #' + g_serial + '(' + g_socket_to_id[socket] + ') connected; total ' + g_all_users.length + ' users');

	// 告诉他一共有几人现在
	socket.emit('total user count', g_all_users.length);

	socket.on('disconnect', function() {
		g_all_users.remove(socket);
		delete g_socket_to_id[socket];

		// 如果在等待匹配确认过程中则移除
		OnPlayerCancelsMatch(socket);
		g_match_pool.remove(socket);

		console.log('user disconnected; total ' + g_all_users.length + ' users');
	});

	socket.on('chat message', function(msg) {
		console.log('message: ' + msg);
	});

	// 准备匹配
	socket.on('ready', function() {
		console.log('Player ' + socket.my_serial + ' readies');
		socket.emit('chat message', '配对中・・・');

		if (g_match_pool.length > 0) {
			var x = g_match_pool[0];
			g_match_pool.remove(x);
			var wait_for_confirm_pair = [ socket, x ]
			g_match_waitforconfirm.push(wait_for_confirm_pair);
			console.log("找到了");
			socket.emit('chat message', '找到了匹配玩家，请确认匹配');
			x.emit(     'chat message', '找到了匹配玩家，请确认匹配');
			socket.emit('match found');
			x.emit(     'match found');
		} else {
			g_match_pool.push(socket);
		}
	});

	// 匹配到的玩家确定了匹配
	socket.on('confirm match', function() {
		socket.match_confirmed = true;
		console.log('Player ' + socket.my_serial + ' confirms');
		var x = g_match_waitforconfirm, other = undefined;
		for (var i=0; i<x.length; i++) {
			if (x[i][0] == socket) { other = x[i][1]; }
			else if (x[i][1] == socket) { other = x[i][0]; }
			if (other != undefined) {
				if (other.match_confirmed == true) {
					var g = StartNewGame(socket, other);
					socket.game = g;
					g.EmitGameStats(socket);
					g.EmitGameStats(other);
					g.SetCurrentPlayer(socket);
					g.EmitHasMovesOrNot(socket); // 只对当前玩家调用这个
				} else {
					other.emit('chat message', '对方已经确认匹配');
					socket.emit('chat message', '请等待对方确认匹配');
				}
				break;
			}
		}
	});

	// 匹配到了的玩家取消了匹配
	socket.on('cancel match', function() {
		OnPlayerCancelsMatch(socket);
	});

	// 玩家选择与人工智障进行游戏
	socket.on('play singleplayer', function() {
		g_match_pool.remove(socket);
		socket.emit('chat message', '玩家选择与人工智障一同游戏');
		socket.emit('found match', '');
		var g = StartNewGame(socket, undefined);
		socket.game = g;
		g.EmitGameStats(socket);
		g.EmitHasMovesOrNot(socket);
		g.SetCurrentPlayer(socket);
	});

	// 玩家选了两张配对的牌
	// pair[0]是手上的牌的idx，pair[1]是牌堆里的牌的idx
	socket.on('chosen two cards', function(idx_h, idx_d) {
		// 不能选第10张或以后的牌
		if (idx_d >= 10) return;
		var g = socket.game;
		if (g == undefined) return;
		if (g.IsCurrentPlayer(socket) == false) { return; }

		if (g.Ended()) return;
		var is_player1 = (g.socket1 == socket);
		var is_player2 = (g.socket2 == socket);
		console.log("Chosen 2 cards");
		var card_h, card_d;
		var other;
		if (is_player1) { 
			card_h = g.hand1[idx_h];
			other = g.socket2;
			if (other == undefined) console.log("P1 [single]");
			else console.log("P1 [dual]")
		} else if( is_player2) { 
			console.log("P2");
			card_h = g.hand2[idx_h]; 
			other = g.socket1;
		} else { return; }

		card_d = g.deck[idx_d];

		if (card_h.season == card_d.season) {
			if (is_player1) {
				g.hand1.remove(card_h);
				g.deck.remove(card_d);
				g.used1.push(card_h);
				g.used1.push(card_d);
			} else {
				g.hand2.remove(card_h);
				g.deck.remove(card_d);
				g.used2.push(card_h);
				g.used2.push(card_d);
			}
			g.IncrementScore(socket, 4);
			g.EmitGameStats(socket);
			g.EmitGameStats(other);

			// 双人模式下，告知对方打出了什么牌
			if (other != undefined) {
				other.emit('chat message', 
					   '对方玩家(' + other.my_serial + ')打出了' + CardToString(card_h) + " 和 " + CardToString(card_d));
			}
		} else {
			// 两张牌季节不同，这是不合法的情况
		}

		// 该函数可能终止游戏
		g.SwitchToOtherPlayer(socket, other, card_h, card_d);

	});

	socket.on('chosen one card', function(idx_h) {
		var g = socket.game;
		if (g == undefined) return;
		if (g.Ended()) return;

		var rand_pool = g.deck;
		var new_card_idx = parseInt(Math.random() * rand_pool.length);
		var new_card = rand_pool[new_card_idx];
		if (g.socket1 == socket) {
			rand_pool[new_card_idx] = g.hand1[idx_h];
			g.hand1[idx_h] = new_card;

		} else {
			rand_pool[new_card_idx] = g.hand2[idx_h];
			g.hand2[idx_h] = new_card;
		}

		g.EmitGameStats(socket);
		g.EmitHasMovesOrNot(socket);
	});

});

http.listen(3000, function(){
	console.log('listening on *:3000');
});
