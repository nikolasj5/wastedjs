wastedJS.controller("gameController", function($scope, $timeout, $window, $location, socket)
{
	//Local variables
	$scope.readyToStart = false;
	$scope.firstPlayer = false;
	$scope.game = false;
	$scope.phase = false;
	$scope.me = {
		name : "",
		ready : false,
		lives : 3,
		won : 0,
		bet : '-',
		card : '',
		turn: false
	};

	// Local player list
	$scope.players = [];

	// Local player card list
	$scope.cards = [];

	//Bet options
	$scope.betOptions = [];

	//Getting players and name
	socket.emit('request-playerlist', null, function (data){
		$scope.players = data.playerList;
		for (let i in $scope.players) {
			if ($scope.players[i].name == data.name) {
				$scope.me = $scope.players[i];
				break;
			}
		}

		if($scope.players.length == 1){
			$scope.firstPlayer = true;
		}
	});

	//logout button function
	$scope.logoutToggle = function()
	{
		let exit = true;
		if ($scope.game) {
			if ($window.confirm("This will end the game, are you sure?")) {
				exit = true;
			} else {
				exit = false;
			}
		}

		if (exit) {
			//Disconnect
			socket.disconnect();

			//Redirect
			$location.url("/");
		}
	};

	// Ready button function
	$scope.readyToggle = function()
	{
		let aux = true;

		//Toggle ready variable
		$scope.me.ready = !$scope.me.ready;

		// Update to server
		socket.emit('ready', {
			name: $scope.me.name,
			ready: $scope.me.ready
		});

		//At least 2 players
		if($scope.players.length == 1)
		{
			aux = false;
		}

		//Check if everyone is ready
		for(i in $scope.players)
		{
			if(!$scope.players[i].ready)
			{
				aux = false;
			}
		}

		$scope.readyToStart = aux;
	};

	//Play card button function
	$scope.playCard = function()
	{
		if($scope.me.turn && $scope.phase == 'play' && $scope.me.card != ''){
			socket.emit('player-play-card', $scope.me.card);

			//Remove played card
			$scope.cards = $scope.cards.filter(function (c) {
				if (c == $scope.me.card) {
					return false;
				} else {
					return true;
				}
			});

			$scope.me.turn = false;
			$scope.me.card = '';
		}
	};

	$scope.betClick = function(index){
		bet = $scope.betOptions[index];

		socket.emit('player-bet', bet);
		$scope.me.turn = false;
		$scope.me.bet = bet;
	};

	//Simple function if card is red
	$scope.cardIsRed = function(card)
	{
		return (card[1] == 'H' || card[1] == 'D');
	};

	//Select card function
	$scope.cardSelect = function (index)
	{
		if ($scope.me.turn) {
			$scope.me.card = $scope.cards[index];
		}
	};

	//Start game - Only for host player
	$scope.startGame = function()
	{
		if($scope.readyToStart)
		{
			socket.emit('start-game');
		}
	};

	//Socket listener events
	socket.on('player-connect', function(newPlayer)
	{
		$scope.players.push(newPlayer);

		$scope.readyToStart = false;
	});

	socket.on('player-disconnect', function(dcName)
	{
		$scope.players = $scope.players.filter(function(player) {
			return player.name != dcName;
		});

		if ($scope.players[0].name == $scope.me.name) {
			$scope.firstPlayer = true;
		}

		$scope.readyToStart = false;

		//If ongoing game
		if ($scope.game) {
			$scope.game = false;
			$scope.me.ready = false;
		}
	});

	socket.on('update-client-ready', function(client)
	{
		let aux = true;
		for(i in $scope.players)
		{
			//Update player ready in local player list
			if ($scope.players[i].name == client.name)
			{
				$scope.players[i].ready = client.ready;
			}

			//Check if everyone is ready
			if(!$scope.players[i].ready)
			{
				aux = false;
			}
		}

		//At least 2 players
		if($scope.players.length == 1)
		{
			aux = false;
		}

		$scope.readyToStart = aux;
	});

	socket.on('game-start-notification', function(playerToPlay){
		socket.emit('request-cards', null, function(data){
			$scope.cards = data.cards;
			$scope.matchNumber = $scope.cards.length;

			$scope.betOptions.length = 0;
			for(var i = 0; i < $scope.matchNumber; i++){
				$scope.betOptions.push(i);
			}
			$scope.betOptions.push($scope.matchNumber);
		});

		//Set flags
		$scope.game = true;
		$scope.phase = "bet";

		//Reset Players Config
		for (let i in $scope.players){
			$scope.players[i].lives = 3;
			$scope.players[i].won = 0;
			$scope.players[i].bet = '-';
			$scope.players[i].card = '';

			if ($scope.players[i].name == playerToPlay) {
				$scope.players[i].turn = true;
			} else {
				$scope.players[i].turn = false;
			}
		}
	});

	socket.on('bet-update', function(bet, playerWhoBet, nextPlayer, startPlayPhase){
		//Updates bet locally and set turn
		for (let i in $scope.players){
			if ($scope.players[i].name == playerWhoBet) {
				$scope.players[i].bet = bet;
			}

			if ($scope.players[i].name == nextPlayer) {
				$scope.players[i].turn = true;
			} else {
				$scope.players[i].turn = false;
			}
		}

		//Set bets
		if ($scope.me.turn) {
			//Check if it's last player
			let isLast = true;
			for (let i in $scope.players) {
				//If there is a player who didn't bet and is alive, is not last
				if ($scope.players[i].name != $scope.me.name && $scope.players[i].bet == '-' && $scope.players[i].lives > 0) {
					isLast = false;
					break;
				}
			}

			//Check which bet is blocked
			if (isLast) {
				let betSum = 0;
				for (let i in $scope.players) {
					if ($scope.players[i].name != $scope.me.name && $scope.players[i].lives > 0) {
						betSum += $scope.players[i].bet;
					}
				}

				let cantBet = $scope.matchNumber - betSum;

				$scope.betOptions = $scope.betOptions.filter(function(iBet) {
					if  (iBet != cantBet) {
						return true;
					} else {
						return false;
					}
				});
			}
		}

		//Change phase to play
		if (startPlayPhase) {
			$scope.phase = "play";
		}
	});

	socket.on('play-update', function (card, playerWhoPlayed, nextPlayer) {
		//Update Card and turn locally
		for (let i in $scope.players) {
			if ($scope.players[i].name == playerWhoPlayed) {
				$scope.players[i].card = card;
			}

			if ($scope.players[i].name == nextPlayer) {
				$scope.players[i].turn = true;
			} else {
				$scope.players[i].turn = false;
			}
		}
	});

	socket.on('new-round', function (players, playerToPlay){
		//Updating player list
		for (let i in $scope.players) {
			$scope.players[i].won = players[i].won;
			$scope.players[i].card = '';

			if ($scope.players[i].name == playerToPlay) {
				$scope.players[i].turn = true;
			} else {
				$scope.players[i].turn = false;
			}
		}
	});

	socket.on('new-match', function (players, playerToPlay) {
		//Updating player list
		for (let i in $scope.players) {
			$scope.players[i].lives = players[i].lives;
			$scope.players[i].won = 0;
			$scope.players[i].card = '';
			$scope.players[i].bet = '-';

			if ($scope.players[i].name == playerToPlay) {
				$scope.players[i].turn = true;
			} else {
				$scope.players[i].turn = false;
			}
		}

		//Updating cards
		socket.emit('request-cards', null, function(data){
			$scope.cards = data.cards;
			$scope.matchNumber = $scope.cards.length;

			$scope.betOptions.length = 0;
			for(var i = 0; i < $scope.matchNumber; i++){
				$scope.betOptions.push(i);
			}
			$scope.betOptions.push($scope.matchNumber);
		});

		//Update phase and playerturn
		$scope.phase = "bet";
	});

	socket.on('end-game', function (players) {
		//TODO better end game

		//Updating player list
		for (let i in $scope.players) {
			$scope.players[i].lives = players[i].lives;
			$scope.players[i].won = 0;
			$scope.players[i].card = '';
			$scope.players[i].bet = '-';
			$scope.players[i].ready = false;
		}

		//Ending game
		$scope.game = false;
		$scope.phase = false;
		$scope.readyToStart = false;
	});
});
