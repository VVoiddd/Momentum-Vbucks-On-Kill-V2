import functions from "../utilities/structs/functions.js";
import Safety from "../utilities/safety.js";
import { WebSocket } from "ws";
import { io } from "socket.io-client";
import log from "../utilities/structs/log.js";

import User from "../model/user.js";
import destr from "destr";

const bote = Safety.env.NAME;

type Client = {
    matchmakingId: string,
    playlist: string,
    socket: Object
}

class matchmaker {

    // Create a map to store clients
    clients = new Map();

    public async server(ws: WebSocket, req: any) {

        const socket = io("https://matchmaker.nexusfn.net", {
            transports: ["websocket"],
            extraHeaders: {
                "key": await Safety.getLoopKey()
            }
        });

        //Connect to socket.io server
        socket.on("connect", () => {
            log.debug("Connected to socket.io server");
        });

        //On error connecting to socket.io server
        socket.on("connect_error", (err: any) => {
            log.debug("Failed to connect to socket.io server");
            log.debug("Socket.io error: " + err);
        });


        let clients = this.clients;

        const auth = req.headers.authorization;

        // Handle unauthorized connection
        if (auth == undefined) {
            return ws.close();
        }

        // Destructure the authorization header
        let [_, __, ___, matchmakingId, playlist] = auth.split(" ");

        //console.log(`Playlist: ${playlist} | MatchmakingId: ${matchmakingId}`)

        // Check if playlist and matchmakingId are valid
        try {

            // Handle invalid playlist error
            if (typeof (playlist) !== "string") {
                ws.send(JSON.stringify({
                    payload: {
                        state: "Error",
                        error: "errors.com.epicgames.matchmaker.invalid_playlist",
                        errorMessage: "Invalid playlist",
                    }
                }));
                return ws.close();
            }

            // Handle invalid account error
            const account = await User.findOne({ matchmakingId: matchmakingId });
            if (!account) {
                return ws.close();
            }
        } catch (err) {
            //console.log(err);
            ws.send(JSON.stringify({
                payload: {
                    state: "Error",
                    error: "errors.com.epicgames.common.matchmaker.invalid_token",
                    errorMessage: "Invalid token",
                }
            }));
            // Handle error in token parsing
            return ws.close();
        }

        socket.emit(`message`, {
            "type": "queued",
            "bote": bote,
            "data": {
                "matchmakingId": matchmakingId,
                "playlist": playlist
            },
            time: new Date().toISOString()
        });

        const clientInfo: Client = {
            matchmakingId: matchmakingId,
            playlist: playlist,
            socket: ws
        }

        this.clients.set(matchmakingId, clientInfo);

        ws.on('close', async () => {
            this.clients.delete(matchmakingId);
            socket.emit(`message`, {
                "type": "unqueued",
                "bote": bote,
                "data": {
                    "matchmakingId": matchmakingId,
                    "playlist": playlist
                },
                time: new Date().toISOString()
            });
            //console.log('Client disconnected');
            //console.log(this.clients);
        });

        const ticketId = functions.MakeID().replace(/-/ig, "");
        const matchId = functions.MakeID().replace(/-/ig, "");
        const sessionId = functions.MakeID().replace(/-/ig, "");

        //Listen for "matchmaking" event
        socket.on(`${bote}-queue`, async (message: any) => {
            //console.log("Received matchmaking queue event");
            //console.log(message);
            message = destr(message);
            if(!message) return;

            const playlist = message.data.playlist;

            //console.log(`Playlist: ${playlist}`);

            if (message.type !== "update") {
                setTimeout(Connecting, 200);
                setTimeout(Waiting, 1000);
                if (playlist) {
                    setTimeout(() => Queued(message.data.queuedAmount, playlist), 2000);
                }
                const status = await global.kv.get(`serverStatus:${playlist}`);
                if (status == "online") {
                    setTimeout(async () => {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await SessionAssignment(playlist);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await Join(playlist);
                    }, 2000);
                } else {
                    await global.kv.set(`serverStatus:${playlist}`, "offline");
                }
            } else {
                if (playlist) {
                    Queued(message.data.queuedAmount, playlist);
                }
            }
        });

        //Listen for "status" event
        socket.on(`${bote}-status`, async (message: any) => {

            //console.log("Received matchmaking status event");
            //console.log(message);
            message = JSON.parse(message);

            const playlist = message.data.playlist;

            //console.log(`Playlist: ${playlist}`);

            switch (message.type) {
                case "update":
                    SessionAssignment(playlist);
                    setTimeout(() => Join(playlist), 1000);
                    await global.kv.setttl(`serverStatus:${playlist}`, "online", 60000);
            }

        });

        async function Connecting() {
            //console.log(`Connecting. TicketId: ${ticketId}`);
            // Send a "Connecting" status update to the client
            ws.send(
                JSON.stringify({
                    payload: {
                        state: "Connecting",
                    },
                    name: "StatusUpdate",
                }),
            );
        }

        async function Waiting(players: number) {
            //console.log(`Waiting.`);
            // Send a "Waiting" status update to the client with the total number of players
            ws.send(
                JSON.stringify({
                    payload: {
                        totalPlayers: players,
                        connectedPlayers: players,
                        state: "Waiting",
                    },
                    name: "StatusUpdate",
                }),
            );
        }

        async function Queued(players: number, playlist: string) {

            //console.log(`Queued. Players: ${players}. Typeof players: ${typeof players}`);
            if (typeof players !== "number") {
                players = 0;
            }

            for (const [key, value] of clients.entries()) {
                if (value.playlist === playlist) {
                    //console.log(`Client ${value.matchmakingId} has playlist ${value.playlist}`);
                    ws.send(
                        JSON.stringify({
                            payload: {
                                ticketId: ticketId,
                                queuedPlayers: players,
                                estimatedWaitSec: 3,
                                status: {},
                                state: "Queued",
                            },
                            name: "StatusUpdate",
                        }),
                    );
                } else {
                    //console.log(`Client ${value.matchmakingId} has playlist ${value.playlist} but needs ${playlist}`);
                }
            }
        }

        async function SessionAssignment(playlist: string) {
            //console.log(`SessionAssignment. MatchId: ${matchId}`);
            // Send a "SessionAssignment" status update to the client with the match ID
            for (const [key, value] of clients.entries()) {
                if (value.playlist === playlist) {
                    ws.send(
                        JSON.stringify({
                            payload: {
                                matchId: matchId,
                                state: "SessionAssignment",
                            },
                            name: "StatusUpdate",
                        }),
                    );
                }
            }
        }

        async function Join(playlist: string) {
            // Send a "Play" message to the client with the match ID, session ID, and join delay
            for (const [key, value] of clients.entries()) {
                if (value.playlist === playlist) {
                    ws.send(
                        JSON.stringify({
                            payload: {
                                matchId: matchId,
                                sessionId: sessionId,
                                joinDelaySec: 1,
                            },
                            name: "Play",
                        }),
                    );
                }
            }
        }
    }
}

export default new matchmaker();