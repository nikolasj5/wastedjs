(function() {
	'use strict';

    angular
    	.module("wastedJSapp")
		.controller("lobbyController", lobbyCtrl);

	function lobbyCtrl($location, lobbyService, socket) {
        var vm = this;

		//Model variables
		vm.readyToStart = false;
		vm.firstPlayer = false;
		vm.name = '';
		vm.manilhas = ["4C","7H","AS","7D"];
		vm.weakCards = ["3S","2H","AD","KS","JH","QS","7C","6H","5D","4S"];

		// Model player list
		vm.players = [];

        //Function Binds
        vm.logoutButton = logoutButton;
        vm.readyButton = readyButton;
        vm.startGame = startGame;
		vm.kickPlayer = kickPlayer;
		vm.cardIsRed = cardIsRed;

        //Socket listener events
		socket.on('player-connect', playerConnectCB);
        socket.on('player-disconnect', playerDisconnectCB);
        socket.on('update-client-ready', updateClientReadyCB);
        socket.on('game-start-notification', gameStartNotificationCB);
		socket.on('kicked', kickedCB);

        activate();

        //////////////////////////////

        function activate () {
            //Getting players and name
            socket.emit('request-playerlist', null, function (data) {
                lobbyService.setPlayers(data);
                vm.name = data.name;
                vm.players = data.playerList;

                if (vm.players[0].name == data.name) {
                    vm.firstPlayer = true;
                }
            });
        };

        //////////////////////////////
        // Function Implementations //
        //////////////////////////////

		function logoutButton() {
			//Disconnect
			socket.disconnect();

			//Redirect
			$location.url("/");
		};

		function readyButton() {
            //Update model
            vm.readyToStart = lobbyService.toggleReady();
            vm.players = lobbyService.getPlayers();

			// Update to server
			socket.emit('ready', {
				name: vm.name,
				ready: lobbyService.getReady()
			});
		};

		//Start game - Only for host player
		function startGame() {
			if (vm.readyToStart) {
				socket.emit("start-game");
			}
		};

		function kickPlayer(name) {
			socket.emit('kick-player', name);
			lobbyService.removePlayer(name);
		};

		function cardIsRed(card) {
			return (card[1] == 'H' || card[1] == 'D');
		};

        ///////////////////////////////
        // Socket listener callbacks //
        ///////////////////////////////

        function playerConnectCB(newPlayer) {
            lobbyService.addPlayer(newPlayer);

            vm.readyToStart = false;
            updatePlayerModel();
		};

		function playerDisconnectCB(dcName) {
            vm.firstPlayer = lobbyService.removePlayer (dcName)
			vm.readyToStart = lobbyService.isEveryoneReady();
            updatePlayerModel();
		};

		function updateClientReadyCB(player) {
			vm.readyToStart = lobbyService.updateReadyForPlayer(player);
            updatePlayerModel();
		};

		function gameStartNotificationCB(data) {
            lobbyService.startGame(data);

			$location.url("/game");
		};

		function kickedCB(name) {
			$location.url("/");
		};

        /////////////////////////////
        //    Utility Functions    //
        /////////////////////////////

        function updatePlayerModel() {
            vm.players = lobbyService.getPlayers();
        };
	};
})();
