document.addEventListener('DOMContentLoaded', () => {
    // --- AUTHENTICATION ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    // --- ELEMENT SELECTION ---
    const micBtn = document.getElementById('btn-mic');
    const camBtn = document.getElementById('btn-cam');
    const screenBtn = document.getElementById('btn-screen');
    const whiteboardBtn = document.getElementById('btn-whiteboard');
    const clearBoardBtn = document.getElementById('btn-clearboard');
    const leaveBtn = document.getElementById('btn-leave');
    const fileInput = document.getElementById('file-input');
    const chatInput = document.getElementById('chat-input');
    const chatLog = document.getElementById('chat-log');
    const videoGrid = document.getElementById('videos');
    const canvas = document.getElementById('board');
    const chatForm = document.getElementById('chat-form');
    // In public/room.js, inside the DOMContentLoaded listener

// --- ELEMENT SELECTION (add the new button) ---
const copyLinkBtn = document.getElementById('btn-copy-link');

// ... other element selections

// --- UI EVENT LISTENERS (add a new listener) ---
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        // Use the modern Clipboard API to copy the link
        navigator.clipboard.writeText(window.location.href).then(() => {
            // Provide visual feedback to the user
            const originalText = copyLinkBtn.querySelector('span').textContent;
            copyLinkBtn.querySelector('span').textContent = 'Copied!';
            copyLinkBtn.classList.add('active'); // Optional: change color

            setTimeout(() => {
                copyLinkBtn.querySelector('span').textContent = originalText;
                copyLinkBtn.classList.remove('active');
            }, 2000); // Revert back after 2 seconds
        }).catch(err => {
            console.error('Failed to copy link: ', err);
            alert('Could not copy link to clipboard.');
        });
    });
}

    // --- STATE MANAGEMENT ---
    let localCameraStream, localScreenStream;
    let isScreenSharing = false;
    let myUsername = 'You';
    const peers = {};

    // --- SOCKET.IO & WEBRTC SETUP ---

    // 1. Read the room ID from the URL's query parameters
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (!roomId) {
        alert('No room specified. Please create a new room from the home page.');
        window.location.href = '/index.html';
        return; // Stop script execution if no room ID
    }

    // 2. Pass the room ID to the server when connecting
    const socket = io({
        auth: { token },
        query: { room: roomId }
    });

    socket.on('connect_error', (err) => {
        console.error('Authentication Error:', err.message);
        localStorage.removeItem('authToken');
        window.location.href = '/index.html';
    });

    socket.on('connect', () => {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        myUsername = decodedToken.username;
        startLocalMedia();
        if (window.initWhiteboard) {
            initWhiteboard(canvas, socket);
        }
        if (window.setupFileReceivers) {
            setupFileReceivers(socket);
        }
    });
    
    // --- TAB SWITCHING LOGIC ---
    const tabButtons = document.querySelectorAll('.tab-nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.querySelector(button.dataset.target)?.classList.add('active');
        });
    });

    // --- CORE MEDIA & WEBRTC FUNCTIONS ---
    async function startLocalMedia() {
        try {
            localCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            addVideoStream(localCameraStream, myUsername, true, socket.id);
        } catch (error) {
            console.error('Error accessing media devices.', error);
            alert('Could not access camera or microphone.');
        }
    }

    function addVideoStream(stream, username, isMuted = false, id) {
        const container = document.createElement('div');
        container.classList.add('video-container');
        container.id = `container-${id}`;
        if (isMuted) container.dataset.isLocal = true;
        const nameTag = document.createElement('div');
        nameTag.classList.add('video-name-tag');
        nameTag.innerText = username;
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = isMuted;
        video.addEventListener('loadedmetadata', () => video.play());
        container.append(video, nameTag);
        videoGrid.append(container);
    }
    
    // --- SCREEN SHARING LOGIC ---
    async function toggleScreenShare() {
        if (!isScreenSharing) {
            try {
                localScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: { echoCancellation: true } });
                isScreenSharing = true;
                const screenTrack = localScreenStream.getVideoTracks()[0];
                updateTrackForPeers(screenTrack);
                document.querySelector('.video-container[data-is-local="true"] video').srcObject = localScreenStream;
                screenBtn.classList.add('active');
                screenBtn.querySelector('span').textContent = 'Stop Sharing';
                screenTrack.onended = () => stopScreenShare();
            } catch (err) { console.error('Screen share failed:', err); isScreenSharing = false; }
        } else {
            stopScreenShare();
        }
    }

    function stopScreenShare() {
        if (!isScreenSharing) return;
        isScreenSharing = false;
        localScreenStream.getTracks().forEach(track => track.stop());
        const cameraTrack = localCameraStream.getVideoTracks()[0];
        updateTrackForPeers(cameraTrack);
        document.querySelector('.video-container[data-is-local="true"] video').srcObject = localCameraStream;
        screenBtn.classList.remove('active');
        screenBtn.querySelector('span').textContent = 'Share Screen';
    }

    function updateTrackForPeers(newTrack) {
        for (const peerId in peers) {
            const sender = peers[peerId].getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(newTrack);
        }
    }

    // --- UI EVENT LISTENERS ---
    micBtn.addEventListener('click', () => {
        const audioTrack = localCameraStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        micBtn.classList.toggle('active', audioTrack.enabled);
        micBtn.querySelector('span').textContent = audioTrack.enabled ? 'Mic On' : 'Mic Off';
    });
    camBtn.addEventListener('click', () => {
        const videoTrack = localCameraStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        camBtn.classList.toggle('active', videoTrack.enabled);
        camBtn.querySelector('span').textContent = videoTrack.enabled ? 'Cam On' : 'Cam Off';
    });
    screenBtn.addEventListener('click', toggleScreenShare);
    whiteboardBtn.addEventListener('click', () => {
        const isVisible = canvas.classList.toggle('visible');
        whiteboardBtn.classList.toggle('active', isVisible);
    });
    clearBoardBtn.addEventListener('click', () => {
        if (window.clearCanvas) {
            window.clearCanvas();
            socket.emit('wb:clear');
        }
    });
    leaveBtn.addEventListener('click', () => {
        socket.disconnect();
        localStorage.removeItem('authToken');
        window.location.href = '/index.html';
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && window.sendFile) window.sendFile(file, socket);
        e.target.value = '';
    });

    // --- CHAT FORM LOGIC ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value;
        if (message.trim()) {
            socket.emit('chat', message);
            displayChatMessage(myUsername, message);
            chatInput.value = '';
        }
    });
    socket.on('chat', (data) => {
        if (data.from !== myUsername) {
            displayChatMessage(data.from, data.msg);
        }
    });
    function displayChatMessage(user, message) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message');
        const senderSpan = document.createElement('span');
        senderSpan.classList.add('chat-message-sender');
        senderSpan.innerText = user;
        msgDiv.appendChild(senderSpan);
        msgDiv.append(document.createTextNode(message));
        if (user === myUsername) {
            msgDiv.classList.add('self');
        } else {
            msgDiv.classList.add('other');
        }
        chatLog.appendChild(msgDiv);
        chatLog.scrollTop = chatLog.scrollHeight;
    }
    
    // --- SOCKET & PEER CONNECTION LOGIC (SIMPLIFIED) ---
    // (This is where your full WebRTC signaling logic would go)
});