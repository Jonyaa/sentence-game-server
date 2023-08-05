const start = () => {
  socket.emit("start");
};

const submitInput = () => {
  const input = document.getElementById("input");
  socket.emit("input", input.value);
};

socket.on("starting input soon", (time) => {
  console.log(`STARTING GAME IN ${time / 1000} SECONDS`);
  countdown(time);
});

socket.on("start input in", () => {
  document.getElementById("lobby").classList.remove("active");
  document.getElementById("game").classList.add("active");
});

socket.on("start game", ({ time, data }) => {
  gameData = data;
  console.log("starting game soon");
  // countdown(time);
});

socket.on("next turn", (turn) => {
  nextTurn(turn);
});

socket.on("connect", () => {
  console.log("CONNECTED ", socket.id);
});

socket.on("reconnect", (data) => {
  console.log(data);
  if (data.state === "running") {
    document.getElementById("lobby").classList.remove("active");
    document.getElementById("game").classList.add("active");
  }
});

socket.on("admin", () => {
  document.getElementById("admin").style.display = "block";
});

socket.on("waiting", (data) => {
  console.log("WAITING" + data);
});

socket.on("redirect", (destination) => {
  window.location.href = destination;
});

socket.on("destroy", leave);

socket.on("continue", () => {
  console.log("CONTINUE GAME");
});

socket.on("players_update", (data) => {
  console.log(data);
  document.getElementById("pin").innerText = data.pin;
  const ul = document.getElementById("playersList");
  ul.innerHTML = "";
  for (const player of data.playersList) {
    ul.innerHTML += `<li>${player}</li>`;
  }
});
