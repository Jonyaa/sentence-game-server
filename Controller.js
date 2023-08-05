const DISCONNECTION_TIMEOUT = 10000;

function shuffle(array) {
  let currentIndex = array.length,
    randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

class Player {
  constructor(uid, socket, room, isAdmin, onInput) {
    this.uid = uid;
    this.socket = socket;
    this.room = room; // ref to the room
    this.gameData = null;
    this.state = "ready";
    this.isAdmin = isAdmin;
    this.onInput = onInput;
    this.sentence = null;
    this.disconnection_timeout = null;

    console.log(
      `${isAdmin ? "Admin " + uid : uid} is connected to room ${room.pin}`
    );

    this.registerSocketMethods();
  }

  registerSocketMethods = () => {
    this.socket.on("disconnect", () => {
      this.room.playerDisconnected(this.uid);
    });

    this.socket.on("input", (inputStr) => {
      this.sentence = inputStr;
      this.onInput();
    });

    this.socket.on("next turn", this.room.nextTurn);

    if (this.isAdmin) {
      this.socket.on("start", () => {
        console.log(`starting room ${this.room.pin}`);
        this.room.startInputStage();
      });
    }
  };

  reconnect = (socket) => {
    this.socket = socket;
    this.registerSocketMethods();
    this.state = "ready";
    socket.emit("reconnect", { state: this.room.state, data: this.gameData });
    clearTimeout(this.disconnection_timeout);
  };

  emit = (eventName, ...data) => {
    this.socket.emit(eventName, ...data);
  };
}

class GameRoom {
  constructor(pin, admin, roomSocket, destroy, selfRead, readerVisible) {
    this.admin = admin;
    this.pin = pin;
    this.roomSocket = roomSocket;
    this.destroy = destroy;
    this.state = "lobby";
    this.turn = null;
    this.activePlayer = null;
    this.selfRead = selfRead;
    this.readerVisible = readerVisible;

    this.players = {};
    console.log("created room " + pin + ", admin is " + admin);
  }

  connectPlayer = (uid, socket) => {
    socket.join(this.pin);

    if (uid in this.players) {
      // reconnected user
      console.log(`${uid} reconnected`);
      this.roomSocket.emit("continue");
      this.state = "running";
      this.players[uid].reconnect(socket);
    } else {
      // new user
      this.players[uid] = new Player(
        uid,
        socket,
        this,
        uid === this.admin,
        this.playerInputted
      );
      if (uid === this.admin) {
        socket.emit("admin");
      }
    }
    this.roomSocket.emit("players_update", {
      playersList: Object.keys(this.players),
      pin: this.pin,
    });
  };

  playerDisconnected = (uid) => {
    if (this.state === "lobby") {
      // disconnection in lobby - kicks player, except if it's the admin then it destroys the room
      if (this.players[uid].isAdmin) {
        this.destroy(this.pin);
      } else {
        this.kickPlayer(uid);
      }
    } else if (this.state === "running") {
      // disconnection in game - freezes game and waits for reconnection
      console.log(
        `${uid} disconnected from running game, waiting to reconnect`
      );
      this.state = "waiting";
      this.players[uid].state = "disconnected";
      this.roomSocket.emit("waiting", uid);

      this.players[uid].disconnection_timeout = setTimeout(
        () => this.destroy(this.pin),
        DISCONNECTION_TIMEOUT
      );
    }

    this.roomSocket.emit("players_update", {
      playersList: Object.keys(this.players),
      pin: this.pin,
    });
  };

  kickPlayer = (uid) => {
    delete this.players[uid];
    this.roomSocket.emit("players_update", {
      playersList: Object.keys(this.players),
    });
    console.log(`kicked ${uid} from ${this.pin}`);
  };

  produceGame = () => {
    const playersArray = shuffle(Object.keys(this.players));
    this.gameData = playersArray.map((uid, idx) => {
      const writer = playersArray[(idx + 1) % playersArray.length];
      return {
        player: uid,
        text: {
          writer: writer,
          body: this.players[writer].sentence,
        },
      };
    });
  };

  startInputStage = () => {
    this.state = "running";
    const START_TIMEOUT = 1000;
    this.roomSocket.emit("start input in", START_TIMEOUT);
  };

  playerInputted = () => {
    let readyToStart = true;
    for (const player in this.players) {
      if (!this.players[player].sentence) {
        readyToStart = false;
        break;
      }
    }
    if (readyToStart) {
      console.log("all players inputted");
      this.startGameStage();
    }
  };

  startGameStage = () => {
    const START_TIMEOUT = 1000;
    this.produceGame();
    this.roomSocket.emit("start game soon", {
      timeout: START_TIMEOUT,
      data: this.gameData,
    });
    setTimeout(() => {
      this.turn = 0;
      this.nextTurn();
    }, START_TIMEOUT);
  };

  nextTurn = () => {
    if (this.turn === Object.keys(this.players).length) {
      this.endGame();
    } else {
      this.roomSocket.emit("next turn", this.turn);
      this.turn++;
    }
  };

  endGame = () => {
    this.state = "ended";
    this.roomSocket.emit("next turn", "end game");
  };
}

class Controller {
  constructor() {
    console.log("Initialized controller");
    /** @private */ this.rooms = {};
  }

  /**
   * Verifies that the inputs are valid and player can connect.
   * Called by the express upon login request is made.
   * Throws exceptions if any problem occures.
   * Doesn't do anything if all good.
   *
   * @param {number} pin The pin of the room.
   * @param {string} uid The name of the client.
   */
  validateLogin = (pin, uid) => {
    if (!(pin in this.rooms)) {
      throw new Error("room doesn't exist");
    }

    if (this.rooms[pin].state != "lobby" && !(uid in this.rooms[pin].players)) {
      throw new Error("room already started game");
    }

    if (
      uid in this.rooms[pin].players &&
      this.rooms[pin].players[uid].state === "ready"
    ) {
      throw new Error("name already taken");
    }
  };

  connectPlayer = (pin, uid, socket) => {
    this.rooms[pin].connectPlayer(uid, socket);
    socket.join(pin);
  };

  generatePin = () => {
    const newPin = Math.round(Math.random() * 9000 + 1000);
    if (newPin in this.rooms) {
      return this.generatePin();
    }
    return newPin;
  };

  destroyRoom = (pin) => {
    console.log(`destroying room ${pin}`);
    this.rooms[pin].roomSocket.emit("redirect", "/");
    delete this.rooms[pin];
  };

  createRoom = (player, selfRead, readerVisible, socketServer) => {
    const pin = this.generatePin();
    this.rooms[pin] = new GameRoom(
      pin,
      player,
      socketServer.to(pin),
      this.destroyRoom,
      selfRead,
      readerVisible
    );
    return pin;
  };
}

module.exports = Controller;
