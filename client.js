const socket = io();

const form = document.getElementById("send-container");
const messageInput = document.getElementById('mssg');
const messageContainer = document.querySelector(".container");
var audio = new Audio('sound.mp3');
var groupPublicKey; // store the group's public key
var uprivateKey; // store the user's private key

const append = (message, position) => {
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message');
    messageElement.classList.add(position);
    messageContainer.append(messageElement);
    if (position == 'left')
        audio.play();
}

// Generate a key pair using Forge
async function generateRSAKeyPair() {
    try {
        const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
        const publicKey = forge.pki.publicKeyToPem(keyPair.publicKey);
        uprivateKey = forge.pki.privateKeyToPem(keyPair.privateKey); // Store user's private key
        return publicKey; // Return only the public key
    } catch (error) {
        console.error('Error generating key pair:', error);
        throw error;
    }
}

// Encrypt plaintext data with the public key
async function encryptMessage(message, publicKey) {
    const encryptedMessage = forge.pki.publicKeyFromPem(publicKey).encrypt(message, 'RSA-OAEP');
    return forge.util.encode64(encryptedMessage);
}

// Decrypt encrypted data with the private key
async function decryptMessage(encryptedData) {
    const decryptedMessage = forge.pki.privateKeyFromPem(uprivateKey).decrypt(forge.util.decode64(encryptedData), 'RSA-OAEP');
    return decryptedMessage;
}

// Main code
(async () => {
    try {
        // Joining the server
        const username = prompt("Welcome to Noble Hospital! Enter your name to join:");
        const publicKey = await generateRSAKeyPair(); // Get the user's public key from the generated key pair
        socket.emit("new-user-joined", { name: username, publicKey });

        // Sending messages
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = messageInput.value;
            append(`You: ${message}`, 'right');

            try {
                const encryptedData = await encryptMessage(JSON.stringify({ message, senderName: username }), groupPublicKey);
                socket.emit('send', encryptedData);
            } catch (error) {
                console.error('Encryption error:', error);
            }

            messageInput.value = '';
        });

        // When a new user on a different device joins
        socket.on('user-joined', username => {
            append(`${username} joined the chat`, 'right');
        });

        // Receiving group public key
        socket.on("Grouppk", async data => {
            groupPublicKey = data;
            console.log('Received group public key:', groupPublicKey);
        });

        // Receiving messages
        socket.on('receive', async encryptedData => {
            try {
                // Decrypt the encrypted data
                const decryptedData = await decryptMessage(encryptedData);
                // Parse the decrypted data to extract message and sender's name
                const { message, senderName } = JSON.parse(decryptedData);
                // Display the message along with sender's name
                append(`${senderName}: ${message}`, 'left');
            } catch (error) {
                console.error('Error decrypting message:', error);
            }
        });

        // User left the chat
        socket.on('left', username => {
            append(`${username} left the chat  :(`, 'left');
        });
    } catch (error) {
        console.error('Error:', error);
    }
})();
