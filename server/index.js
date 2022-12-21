const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 9000;
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// create an object to store users
let users = {};

// utility to send message to one user
const sendTo = (connection, message) => {
	connection.send(JSON.stringify(message));
};

// utility to send message to all users

const sendToAll = (clients, type, { id, name: userName }) => {
	Object.values(clients).forEach((client) => {
		if (client.name !== userName) {
			client.send(
				JSON.stringify({
					type,
					user: { id, userName },
				})
			);
		}
	});
};

wss.on('connection', (ws) => {
	ws.on('message', (msg) => {
		let data;

		try {
			data = JSON.parse(msg);
		} catch (e) {
			console.log('Invalid JSON');
			data = {};
		}

		const { type, name, offer, answer, candidate } = data;
		switch (type) {
			case 'login':
				if (users[name]) {
					console.log('Login: ', name);
					sendTo(ws, {
						type: 'login',
						success: false,
						message: 'Username is unavailable',
					});
				} else {
					console.log('Registered: ', name);
					const id = uuidv4();
					const loggedIn = Object.values(users).map(
						({ id, name: userName }) => ({ id, userName })
					);
					users[name] = ws;
					ws.name = name;
					ws.id = id;
					sendTo(ws, {
						type: 'login',
						success: true,
						users: loggedIn,
					});
					sendToAll(users, 'updateUsers', ws);
				}
				break;
			case 'offer':
				const offerRecipient = users[name];
				if (!!offerRecipient) {
					console.log('Offer: ', name, offer);
					sendTo(offerRecipient, {
						type: 'offer',
						offer,
						name: ws.name,
					});
				} else {
					console.log('Offer Error: ', name, offer);
					sendTo(ws, {
						type: 'error',
						message: `User ${name} does not exist!`,
					});
				}
				break;
			case 'answer':
				const answerRecipient = users[name];
				if (!!answerRecipient) {
					console.log('Answer: ', name, answer);
					sendTo(answerRecipient, {
						type: 'answer',
						answer,
					});
				} else {
					console.error('Answer Error: ', name, answer);
					sendTo(ws, {
						type: 'error',
						message: `User ${name} does not exist!`,
					});
				}
				break;
			case 'candidate':
				const candidateRecipient = users[name];
				if (!!candidateRecipient) {
					console.log('Candidate: ', name, candidate);
					sendTo(candidateRecipient, {
						type: 'candidate',
						candidate,
					});
				} else {
					console.error('Candidate Error: ', name, candidate);
					sendTo(ws, {
						type: 'error',
						message: `User ${name} does not exist!`,
					});
				}
				break;
			case 'leave':
				console.log('Leave', name);
				sendToAll(users, 'leave', ws);
				break;
			default:
				console.log('Command not found: ' + type);
				sendTo(ws, {
					type: 'error',
					message: 'Command not found: ' + type,
				});
				break;
		}
	});

	ws.on('close', () => {
		delete users[ws.name];
		sendToAll(users, 'leave', ws);
	});

	ws.send(
		JSON.stringify({
			type: 'connect',
			message: 'Well hello there, I am a WebSocket server',
		})
	);
});

server.listen(port, () => {
	console.log(`Signaling Server running on port: ${port}`);
});
