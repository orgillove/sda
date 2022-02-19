const https = require("https"),
      bodyParser = require("body-parser"),
	  MongoClient = require("mongodb").MongoClient,
	  ObjectId = require('mongodb').ObjectId,
	  path = require("path"),
	  admin = require("firebase-admin")
	  request = require("request"),
	  serviceAccount = require('./accountKey.json'),
	  express = require("express");
	  
var app = express()
var http = require("http").Server(app);
var io = require("socket.io")(http);
var db;

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(express.static("public"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://kenpoker-461cd.firebaseio.com"
});

var port = process.env.PORT || 3000;
var connectedUsers = {}
var deck = []
for (var i = 0; i < 52; i++){
	deck[i] = i
}
shuffleArray(deck)
var suits = ['S', 'D', 'H', 'C']
var ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
/*app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});*/

function shuffleArray(array) {
	for (var i = array.length - 1; i > 0; i--) {
    	var j = Math.floor(Math.random() * (i + 1));
    	var temp = array[i];
    	array[i] = array[j];
    	array[j] = temp;
  	}
}

function numToCard(n){
	return ranks[n%13] + suits[Math.floor(n/13)]
}

function determineHand(hand){
	//high card: 0, pair: 1, 2 pair: 2, three of a kind: 3, straight: 4, flush: 5,
	//full house: 6, quads: 7, straight flush: 8
	var myRanks = hand.map(x =>ranks.indexOf(x.slice(0, x.length-1)));
	myRanks.sort(function(a, b){return b-a})
	var mySuits = hand.map(x => x[x.length-1])
	var isFlush = mySuits[0] === mySuits[1] &&
		  		  mySuits[1] === mySuits[2] &&
		  		  mySuits[2] === mySuits[3] &&
		  		  mySuits[3] === mySuits[4]
	var isStraight = (myRanks[0] === myRanks[1] + 1 &&
		myRanks[1] === myRanks[2] + 1 &&
		myRanks[2] === myRanks[3] + 1 &&
		myRanks[3] === myRanks[4] + 1) || 
		(myRanks[0] === 12 && 
		 myRanks[1] === 3 && 
		 myRanks[2] === 2 && 
		 myRanks[3] === 1 && 
		 myRanks[4] === 0)
	var counts = Array(13).fill(0)
	for (var rank of myRanks){
		counts[rank] += 1
	}
	var maxCount = Math.max(...counts)
	if (isFlush && isStraight){
		return [8, myRanks[0]]
	}

	if (maxCount === 4){
		return [7, counts.indexOf(4), counts.indexOf(1)]
	}
	if (maxCount === 3 && counts.includes(2)){
		return [6, counts.indexOf(3), counts.indexOf(2)]
	}
	if (isFlush){
		return [5, myRanks]
	}
	if (isStraight){
		return [4, myRanks[0]]
	}
	if (maxCount === 3){
		return [3, counts.indexOf(3), counts.lastIndexOf(1), counts.indexOf(1)]
	}
	if (maxCount === 2){
		var higherPair = counts.lastIndexOf(2)
		var lowerPair = counts.indexOf(2)
		if (higherPair !== lowerPair){
			return [2, higherPair, lowerPair, counts.indexOf(1)]
		}
		return [1, higherPair, myRanks]
	}
	return [0, myRanks]
}

function compareHands(ranking1, ranking2){
	if (ranking1[0] !== ranking2[0]){
		return ranking1[0] - ranking2[0]
	}
	var handType = ranking1[0]
	if (handType === 8 || handType === 4){
		return ranking1[1] - ranking2[1]
	}
	if (handType === 7 || handType === 6 ){
		if (ranking1[1] !== ranking2[1]){
			return ranking1[1] - ranking2[1]
		}
		return ranking1[2] - ranking2[2]
	}
	if (handType === 5 || handType === 0){
		for (var i = 0; i < 5; i++){
			if (ranking1[1][i] !== ranking2[1][i]){
				return ranking1[1][i] - ranking2[1][i]
			}
		}
		return 0;
	}
	if (handType === 3 || handType === 2){
		if (ranking1[1] !== ranking2[1]){
			return ranking1[1] - ranking2[1]
		}
		if (ranking1[2] !== ranking2[2]){
			return ranking1[2] - ranking2[2]
		}
		return ranking1[3]
	}
	if (handType === 1){
		if (ranking1[1] !== ranking2[1]){
			return ranking1[1] - ranking2[1]
		}
		for (var i = 0; i < 5; i++){
			if (ranking1[2][i] !== ranking2[2][i]){
				return ranking1[2][i] - ranking2[2][i]
			}
		}
		return 0
	}
}
function subset(arra, arra_size)
 {
    var result_set = [], 
        result;
    
   
for(var x = 0; x < Math.pow(2, arra.length); x++)
  {
    result = [];
    i = arra.length - 1; 
     do
      {
      if( (x & (1 << i)) !== 0)
          {
             result.push(arra[i]);
           }
        }  while(i--);

    if( result.length === arra_size)
       {
          result_set.push(result);
        }
    }

    return result_set; 
}

function myBestHand(cards){
	var possibleHands = subset(cards, 5)
	var bestHand = possibleHands[0]
	console.log(bestHand)
	var bestRanking = determineHand(bestHand)
	var nextRanking;
	for (var i = 1; i < 21; i++){
		nextRanking = determineHand(possibleHands[i])
		if (compareHands(nextRanking, bestRanking) > 0){
			bestRanking = nextRanking
			bestHand = possibleHands[i]
		}
	}
	return [bestHand, bestRanking]
}

function isFolded(result, uid){
	var seats = result.seats
	for (var i = 0; i < seats.length; i++){
		if (seats[i] !== null && seats[i].uid === uid){
			return seats[i].folded
		}
	}
	return true
}

//players is an array of the uids of the players eligible to win the hand
function determineWinners(result, cards, players){
	var community = result.community
	//var winners = [cards.players[seats[0]].uid]
	//var bestRanking = myBestHand(community.concat(cards.players[seats[0]].cards))[1]
	var winners = []
	var bestRanking;
	var nextRanking;
	var comparison;
	var seat;
	for (var i = 0; i < cards.players.length; i++){
		//seat = seats[i];
		//console.log(seat)
		//console.log(cards.players)
		//console.log(cards.players[i].uid)
		if (players.includes(cards.players[i].uid) ){
			if (winners.length === 0){
				winners.push(cards.players[i].uid)
				bestRanking = myBestHand(community.concat(cards.players[i].cards))[1]
			}
			else{
				nextRanking = myBestHand(community.concat(cards.players[i].cards))[1]
				comparison = compareHands(nextRanking, bestRanking)
				if (comparison > 0){
					bestRanking = nextRanking
					winners = [cards.players[i].uid]
				}
				else if (comparison === 0){
					winners.push(cards.players[i].uid)
				}
			}
			
		}
	}
	return winners;
}

//players is an array of userids
function dealCards(players){
	shuffleArray(deck)
	var i = 0;
	var result = [];
	var cards;
 	for (var player of players){
 		cards = [numToCard(deck[i]), numToCard(deck[i+1])];
		result.push({uid:player, cards:cards});
		i += 2
		if (connectedUsers[player]){
			connectedUsers[player].emit('cards', cards)
		}
		var community = [numToCard(deck[i]), numToCard(deck[i+1]), numToCard(deck[i+2]), numToCard(deck[i+3]), numToCard(deck[i+4])]
	}
	db.collection("cards").update({}, {players:result, community:community}, function(err, result){
		if (err) throw err;
	})

}

function getSeatNums(seats){
	var seatNums = []
	for (var i = 0; i < 4; i++){
		if (seats[i] !== null){
			seatNums.push(i)
		}
	}
	return seatNums;
}

function getPlayersInHand(seats){
	var players = []
	for (var i = 0; i < 4; i++){
		if (seats[i] !== null && !seats[i].folded){
			players.push(i)
		}
	}
	return players;
}

function findNextPlayer(result, i){
	var temp = i + 1;
	temp = temp % 4;
	var seats = result.seats
	while (temp != i && (seats[temp] == null || seats[temp].folded)){
		temp += 1;
		temp %= 4;
	}
	return temp;
}

function findLastPlayer(result){
	var temp = result.button + 1;
	temp = temp % 4;
	var lastPlayer;
	var seats = result.seats
	while(true){
		if (!(seats[temp] == null || seats[temp].folded)){
			lastPlayer = temp;
		}
		if (temp === result.button){
			break
		}
		temp += 1;
		temp %= 4;
	}
	return lastPlayer
}

function showCards(result, cards){
	var cardsToShow = []
	for (var i = 0; i < 4; i++){
		if (result.seats[i] != null && !result.seats[i].folded){
			for (var player of cards.players){
				if (player.uid === result.seats[i].uid){
					cardsToShow[i] = player.cards
				}
			}
		}
	}
	io.emit("showdown", cardsToShow)	
}

function newGame(result){
	var seats = result.seats

	/*for (var seatNum of seatNums){
		seats[seatNum].amountBet = 0;
		seats[seatNum].folded = false;
	}*/
	for (var i = 0; i < 4; i++){
		if (seats[i] != null){
			if (seats[i].standUp || seats[i].stackSize == 0){
				if (connectedUsers[seats[i].uid]){
  					connectedUsers[seats[i].uid].emit('balance', seats[i].stackSize)
  				}
				db.collection('balances').update({uid:seats[i].uid}, 
 					{$inc: {balance: seats[i].stackSize}}, 
 					function(err, result2){
 						if (err) throw err;		
 					}
 				)
				seats[i] = null
			}
			else{
				seats[i].amountBet = 0;
				seats[i].folded = false
			}
		}
	}
	var seatNums = getSeatNums(seats)
	if (seatNums.length > 1){
		result.bet = 2;
		result.previousRaise = 2;
		result.button = findNextPlayer(result, result.button)
		if (seatNums.length == 2){
			result.lastBet = findNextPlayer(result, result.button) //big blind
			seats[result.button].amountBet = 1;
			seats[result.button].stackSize -= 1;
			seats[result.lastBet].amountBet = 2;
			seats[result.lastBet].stackSize -= 2;
			result.turn = result.button
		}
		else{
			var smallBlind = findNextPlayer(result, result.button);
			var bigBlind = findNextPlayer(result, smallBlind)
			result.turn = findNextPlayer(result, bigBlind)
			seats[smallBlind].amountBet = 1
			seats[smallBlind].stackSize -= 1;
			seats[bigBlind].amountBet = 2
			seats[bigBlind].stackSize -= 2;
			result.lastBet = bigBlind
		}
		var playerIds =[]
  		for (seatNum of seatNums){
  			playerIds.push(seats[seatNum].uid)
  		}
  		result.community = []
  		result.sidePots = []
  		result.pot = 3;
  		result.street = "preflop"
  		dealCards(playerIds)
	}
	//else{
	//	result.seats = [null, null, null, null, null]
	//}
	
  	db.collection("gameState").update({}, result, function(err, result2){
  		if (err) throw err;
  		io.emit("game state", result)
  	})
}

function nextStreet(result){
	db.collection("cards").findOne({}, function(err, result2){
		if (err) throw err;
		var street = result.street
		var seats = result.seats
  		for (var i = 0; i < 4; i++){
  			if (seats[i] != null && seats[i].stackSize === 0){
  				seats[i].folded = true
  			}
  		}
		//create side pots if necessary
		var sidePotPlayers = [];
		var sidePots = [];
		var isAllIn = false;
		for (var i = 0; i < 4; i++){
			var player = result.seats[i];
			if (player !== null && player.amountBet > 0){
				if (player.stackSize === 0){
					isAllIn = true
				}
				sidePotPlayers.push({uid: player.uid, amountBet: player.amountBet, seat:i})
			}
		}
		if (isAllIn){
			sidePotPlayers.sort(x => x.amountBet)
			for (var i = 0; i < sidePotPlayers.length; i++){
				var player = sidePotPlayers[i];
				if (player.amountBet > 0){
					var newSidePot = {};
					newSidePot.players = []
					newSidePot.pot = 0;
					var allInAmount = player.amountBet
					for (var j = i; j < sidePotPlayers.length; j++){
						sidePotPlayers[j].amountBet -= allInAmount;
						newSidePot.players.push(sidePotPlayers[j].uid);
					}
					newSidePot.pot = allInAmount * (sidePotPlayers.length - i)
					result.pot -= newSidePot.pot
					sidePots.push(newSidePot)
				}
				if (player.stackSize === 0){
					result.seats[player.seat].folded = true
				}
			}
			result.sidePots = result.sidePots.concat(sidePots)
		}
		var playersInHand = getPlayersInHand(result.seats)
		if (playersInHand.length <= 1){
			//everyone folded
			if (playersInHand.length === 1){
				result.seats[playersInHand[0]].stackSize += result.pot
			}
			if (result.sidePots.length > 0){
				for (var i = 0; i < 5; i++){
					result.community[i] = result2.community[i]
				}
				for (var sidePot of result.sidePots){
					winners = determineWinners(result, result2, sidePot.players)
					for (var i = 0; i < 4; i++){
						if (result.seats[i] !== null && winners.includes(result.seats[i].uid)){
							result.seats[i].stackSize += Math.floor(sidePot.pot / winners.length)
						}
					}
				}
			}
			newGame(result)
			return;
		}
		if (street == 'river'){
			//console.log(playersInHand.map(x => result.seats[x].uid))
			showCards(result, result2)
			winners = determineWinners(result, result2, playersInHand.map(x => result.seats[x].uid))
			
			for (var i = 0; i < 4; i++){
				if (result.seats[i] !== null && winners.includes(result.seats[i].uid)){
					result.seats[i].stackSize += Math.floor(result.pot / winners.length)
				}
			}
			//determine sidepots
			for (var sidePot of result.sidePots){
				winners = determineWinners(result, result2, sidePot.players)
				for (var i = 0; i < 4; i++){
					if (result.seats[i] !== null && winners.includes(result.seats[i].uid)){
						result.seats[i].stackSize += Math.floor(sidePot.pot / winners.length)
					}
				}
			}
			newGame(result)
			return;
		}
		if (street == 'preflop'){
			result.street = 'flop'
			result.community[0] = result2.community[0]
			result.community[1] = result2.community[1]
			result.community[2] = result2.community[2]
		}
		else if (street == 'flop'){
			result.street = 'turn'
			result.community[3] = result2.community[3]
		}
		else if (street == 'turn'){
			result.street = 'river';
			result.community[4] = result2.community[4]
		}
		//var seatNums = getSeatNums(result.seats)
		for (var i = 0; i < 4; i++){
			if(result.seats[i] !== null){
				result.seats[i].amountBet = 0
			}
		}
		result.bet = 0;
		result.previousRaise = 2;
		result.lastBet = findLastPlayer(result);
		result.turn = findNextPlayer(result, result.button)
		db.collection("gameState").update({}, result, function(err, result2){
  			if (err) throw err;
  			io.emit("game state", result)
  		})
	})
}

app.get("/login", function(req, res){
	res.sendFile("login.html", {root: __dirname + "/public/"})
})

app.get('/messages', function(req, res){
	db.collection("messages").find({}).toArray(function(err, result){
		if (err) throw err;
		else{
    		res.json(result);
    	}
	})
})

app.get("/balance/:userId([0-9A-Za-z]*)", function(req, res){
	db.collection("balances").findOne({uid:req.params.userId}, function(err, result){
		if (err) throw err;
		res.json(result)
	})
})


io.on('connection', function(socket){
  	//console.log(socket)
  	socket.on('login', function(uid){
  		connectedUsers[uid] = socket
  		db.collection("gameState").findOne({}, function(err, result){
  			if (err) throw err;
  			socket.emit('game state', result)
  			db.collection("cards").findOne({}, function(err, result2){
  				for (var player of result2.players){
  					if (player.uid == uid){
  						socket.emit('cards', player.cards)
  					}
  				}
  			})
  		})
  		
  	})

  	



  	function handleNextAction(result){
  		var players = getPlayersInHand(result.seats)
  		if ((result.bet === 2 && result.turn === result.lastBet && result.street == 'preflop') || 
  			(result.bet === 0 && result.turn === result.lastBet) ||
  			(players.length == 1 && players[0] === result.turn)){
  			nextStreet(result)
  		}
  		else{
  			result.turn = findNextPlayer(result, result.turn)
  			//console.log(result.turn)
  			if (result.turn === result.lastBet && !((result.bet === 2 && result.street == 'preflop') || 
  				(result.bet === 0 && result.turn === result.lastBet))){
  				//option of checking
  				nextStreet(result)
  			}
  			else{
  				db.collection("gameState").update({}, result, function(err, result2){
  					if (err) throw err;
  					io.emit("game state", result)
  				})
  			}
  		}
  	}

  	socket.on('fold', function(){
  		db.collection("gameState").findOne({}, function(err, result){
  			if (err) throw err;
  			var turn = result.turn
  			var seats = result.seats
  			seats[turn].folded = true
  			var playersInHand = getPlayersInHand(seats)
			if (playersInHand.length == 1){
				//everyone folded
				result.seats[playersInHand[0]].stackSize += result.pot
				newGame(result)
			}
			else{
				handleNextAction(result)
			}

  		})
  	})

  	socket.on('bet', function(bet){
  		db.collection("gameState").findOne({}, function(err, result){
  			if (err) throw err;
  			var seats = result.seats;
  			var turn = result.turn;
  			var currentBet = result.bet
  			if (seats[turn].stackSize + seats[turn].amountBet >= bet){
  				seats[turn].stackSize -= bet - seats[turn].amountBet
  				//raise
  				if (bet > result.bet){
  					result.previousRaise = bet - result.bet
  					result.bet = bet
  					result.lastBet = turn
  				}
  				result.pot += bet - seats[turn].amountBet;
  				seats[turn].amountBet = bet
  				/*if (seats[turn].stackSize === 0){
  					seats[turn].folded = true
  				}*/

  				//if anyone is all in, they don't need to call a raise
  				if (bet > 0){
  					for (var i = 0; i < 4; i++){
  						if (seats[i] != null && seats[i].stackSize === 0 && i != result.lastBet){
  							seats[i].folded = true
  						}
  					}
  				} 
  				handleNextAction(result)
  	    	}
  		})
  	})

  	socket.on('chat message', function(msg){
    	io.emit('chat message', msg);
  	});

  	socket.on('take seat', function(data){
  		var seat = data.seat
  		var uid = data.uid
  		db.collection("gameState").findOne({}, function(err, result){
  			if (err) throw err;
  			var seats = result.seats
  			var isValid = true
  			if (seats[seat] != null){
  				isValid = false
  			}
  			var seatNums = getSeatNums(seats)
  			for (var seatNum of seatNums){
  				if (seats[seatNum].uid == uid){
  					isValid = false
  				}
  			}
  		
  			if (isValid){
  				seats[seat] = {uid:uid, stackSize:200, folded:true, amountBet:0, standUp:false}
  				seatNums.push(seat)
  				db.collection('balances').update({uid:uid}, {$inc: {balance: -200}}, function(err, result2){
  					if (err) throw err;
  					if (connectedUsers[uid]){
  						connectedUsers[uid].emit('balance', -200)
  					}
  				})
  				if (seatNums.length == 2){
  					newGame(result)
  				}
  				else{
  					db.collection('gameState').update({}, result, function(err, result3){
  						if (err) throw err;
						io.emit('game state', result)
  						
  					})
  				}
  			}
  		})
  	})

  	socket.on('stand up', function (uid){
  		db.collection("gameState").findOne({}, function(err, result){
  			if (err) throw err;
  			for (var i = 0; i < 4; i++){
  				if (result.seats[i] != null && result.seats[i].uid === uid){
  					result.seats[i].standUp = true
 					/*db.collection('balances').update({uid:uid}, 
 						{$inc: {balance: result.seats[i].stackSize}}, 
 						function(err, result2){
 							if (err) throw err;
 						}
 					)*/
  				} 
  			}
  			db.collection('gameState').update({}, result, function(err, result3){
  				if (err) throw err;
  				io.emit('game state', result)
  			})
  		})
  	})
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});


MongoClient.connect("mongodb://admin:password1@ds151707.mlab.com:51707/heroku_vkbrcrpg", function (err, client){
	db = client.db("heroku_vkbrcrpg")
	admin.auth().listUsers()
    .then(function(listUsersResult) {
	  
      listUsersResult.users.forEach(function(userRecord) {
        console.log(userRecord.uid)
        //db.collection("balances").insertOne({uid:userRecord.uid, balance:10000})
      });
    })
    .catch(function(error) {
      console.log("Error listing users:", error);
    });
})
