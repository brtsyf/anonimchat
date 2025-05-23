import express from "express";
import { Server } from "socket.io";
import http from "http";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
// Store connected users
const connectedUsers = new Set();
const roomlist = new Set();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", "src/views");
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/chat", (req, res) => {
  res.render("chat", { room: req.query.room });
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Add new user to the set
  connectedUsers.add(socket.id);

  // Send existing users to the new user
  socket.emit("users", Array.from(connectedUsers));
  socket.emit("roomlist", Array.from(roomlist));
  // Broadcast to all other clients that a new user has connected
  socket.broadcast.emit("users", Array.from(connectedUsers));

  // Handle chat messages
  socket.on("create room", () => {
    const room = Math.random().toString(36).substring(2, 15);
    roomlist.add(room);
    io.emit("roomlist", Array.from(roomlist));
    socket.emit("room", room);
  });
  socket.on("chat message", (message, room) => {
    socket.broadcast.to(room).emit("chat message", {
      user: socket.id,
      message: message,
      room: room,
    });
  });
  socket.on("join room", (room) => {
    socket.join(room);
    socket.broadcast.to(room).emit("user joined", {
      user: socket.id,
    });
    io.to(room).emit("room status", {
      userCount: io.sockets.adapter.rooms.get(room).size,
    });
  });
  socket.on("leave room", (room) => {
    socket.leave(room);
    io.to(room).emit("chat message", {
      user: socket.id,
      message: "left the room",
      room: room,
    });

    // Get the room size safely
    const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;

    socket.broadcast.to(room).emit("room status", {
      userCount: roomSize,
    });

    // If room is empty, remove it from roomlist
    if (roomSize === 0) {
      roomlist.delete(room);
      io.emit("roomlist", Array.from(roomlist));
    }
  });
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    // Remove user from the set
    connectedUsers.delete(socket.id);
    // Broadcast updated user list to remaining users
    socket.broadcast.emit("users", Array.from(connectedUsers));
  });
});

// Use server.listen instead of app.listen for Socket.IO
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
