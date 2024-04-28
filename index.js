const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    transports: ['polling'],
});

// Your Socket.io logic here...




// Initialize an empty object to store user data
let users = {};

// Encryption functions
const forge = require('node-forge');

function generateRSAKeyPair() {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const publicKey = forge.pki.publicKeyToPem(keys.publicKey);
    const privateKey = forge.pki.privateKeyToPem(keys.privateKey);
    return { publicKey, privateKey };
}

function encryptMessage(message, publicKey) {
    const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);
    const encrypted = publicKeyObj.encrypt(message, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
}

function decryptMessage(encryptedData, privateKey) {
    const decrypted = forge.pki.privateKeyFromPem(privateKey).decrypt(forge.util.decode64(encryptedData), 'RSA-OAEP');
    return decrypted;
}

// Main code

const { publicKey: GpublicKey, privateKey: GprivateKey } = generateRSAKeyPair();

//a new connection is formed
io.on('connection', socket => {
    socket.on('new-user-joined', data => {
        const { name, publicKey } = data;
        users[socket.id] = { name, publicKey };
        console.log(users[socket.id].name);

        // Broadcast to others
        socket.broadcast.emit('user-joined', users[socket.id].name);

        // Send group public key to the user
        io.to(socket.id).emit('Grouppk', GpublicKey);
    });

    // User has sent a message to the server
    socket.on('send', encryptedData => {
        try {
            // Decrypt user's data
            const decryptedData = decryptMessage(encryptedData, GprivateKey);
            const { message, senderName } = JSON.parse(decryptedData);
            console.log('Decrypted message:', message);
            console.log('Sender name:', senderName);

            // Broadcast the decrypted message and sender's name to everyone in the group chat
            Object.keys(users).forEach(socketId => {
                // Skip sending the message to the sender
                if (socketId !== socket.id) {
                    const userPublicKey = users[socketId].publicKey;
                    // Encrypt user's data with recipient's public key
                    const encryptedData = encryptMessage(JSON.stringify({ message, senderName }), userPublicKey);
                    io.to(socketId).emit('receive', encryptedData);
                }
            });
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            socket.broadcast.emit('left', users[socket.id].name);
            delete users[socket.id];
        }
    });
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Define route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});


// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
