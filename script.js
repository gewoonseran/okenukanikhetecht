// UI-elementen ophalen
const socket = io('http://localhost:3000');
const usernameInput = document.getElementById("username-input");
const setUsernameButton = document.getElementById("set-username");
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const messagesList = document.getElementById("messages");
const logoutBtn = document.getElementById("logout-btn");
const usernameHeader = document.getElementById("username-header");
const recordBtn = document.getElementById("record-btn");
const cameraBtn = document.getElementById("camera-btn");
const cameraModal = document.getElementById("camera-modal");
const cameraFeed = document.getElementById("camera-feed");
const takePhotoBtn = document.getElementById("take-photo");
const startVideoBtn = document.getElementById("start-video");
const stopVideoBtn = document.getElementById("stop-video");
const cancelBtn = document.getElementById("cancel");
const recordingTimerElement = document.getElementById("recording-timer");

let username = "";
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let videoStream;
let videoRecorder;
let videoChunks = [];
let recordingSeconds = 0;
let recordingTimer;

// Gebruiker registreren
setUsernameButton.addEventListener("click", () => {
    username = usernameInput.value.trim();
    if (username) {
        socket.emit('register-user', username);
        document.getElementById("username-container").style.display = "none";
        chatContainer.style.display = "flex";
        usernameHeader.textContent = username;
    }
});

// Tekstbericht verzenden
chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    socket.emit('send-text-message', { content: messageText });
    messageInput.value = "";
});

// Spraakbericht opnemen en verzenden
recordBtn.addEventListener("click", async () => {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            isRecording = true;
            recordBtn.textContent = "⏹️";
            startRecordingTimer();

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                const audioUrl = URL.createObjectURL(audioBlob);
                socket.emit('send-voice-message', { content: audioUrl });
                audioChunks = [];
                stopRecordingTimer();
            });
        } catch (err) {
            console.error("Microfoon toegang geweigerd", err);
            alert("Microfoon toegang is vereist om spraakberichten te versturen.");
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordBtn.textContent = "🎤";
    }
});

// Camera modal openen
cameraBtn.addEventListener("click", async () => {
    cameraModal.style.display = "flex";
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraFeed.srcObject = videoStream;
    } catch (err) {
        console.error("Camera toegang geweigerd", err);
        alert("Camera toegang is vereist om foto's en video's te maken.");
    }
});

// Foto maken
takePhotoBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    canvas.getContext("2d").drawImage(cameraFeed, 0, 0);
    canvas.toBlob(blob => {
        const photoUrl = URL.createObjectURL(blob);
        socket.emit('send-photo-message', { content: photoUrl });
        closeCameraModal();
    });
});

// Video opnemen
startVideoBtn.addEventListener("click", () => {
    videoRecorder = new MediaRecorder(videoStream);
    videoRecorder.start();
    startVideoBtn.disabled = true;
    stopVideoBtn.disabled = false;
    startVideoRecordingTimer();

    videoRecorder.addEventListener("dataavailable", event => {
        videoChunks.push(event.data);
    });

    videoRecorder.addEventListener("stop", () => {
        const videoBlob = new Blob(videoChunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);
        socket.emit('send-video-message', { content: videoUrl });
        videoChunks = [];
    });
});

stopVideoBtn.addEventListener("click", () => {
    videoRecorder.stop();
    startVideoBtn.disabled = false;
    stopVideoBtn.disabled = true;
    stopVideoRecordingTimer();
});

// Camera modal sluiten
cancelBtn.addEventListener("click", closeCameraModal);

function closeCameraModal() {
    cameraModal.style.display = "none";
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
}

// Timer voor spraakopname
function startRecordingTimer() {
    recordingSeconds = 0;
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;
        recordBtn.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ⏹️`;
    }, 1000);
}

function stopRecordingTimer() {
    clearInterval(recordingTimer);
    recordBtn.textContent = "🎤";
}

// Timer voor video-opname
function startVideoRecordingTimer() {
    recordingSeconds = 0;
    recordingTimerElement.style.display = "block";
    recordingTimer = setInterval(() => {
        recordingSeconds++;
        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;
        recordingTimerElement.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }, 1000);
}

function stopVideoRecordingTimer() {
    clearInterval(recordingTimer);
    recordingTimerElement.style.display = "none";
}

// Berichtfuncties
function addTextMessage(text, type) {
    const messageItem = document.createElement("li");
    messageItem.classList.add("message", type);
    messageItem.innerHTML = `
        <div class="message-content">
            ${text}
            <span class="timestamp">${getCurrentTime()}</span>
        </div>
    `;
    messagesList.appendChild(messageItem);
    messagesList.scrollTop = messagesList.scrollHeight;
}

function addVoiceMessage(audioUrl, type) {
    const messageId = Date.now();
    const messageItem = document.createElement("li");
    messageItem.classList.add("message", type, "voice-message");
    messageItem.innerHTML = `
        <div class="message-content">
            <div class="waveform" id="waveform-${messageId}"></div>
            <button class="play-btn" data-audio="${audioUrl}">▶️</button>
            <span class="timestamp">${getCurrentTime()}</span>
        </div>
    `;
    messagesList.appendChild(messageItem);
    const waveformContainer = document.getElementById(`waveform-${messageId}`);
    const wavesurfer = WaveSurfer.create({
        container: waveformContainer,
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        height: 50,
    });
    wavesurfer.load(audioUrl);
    const playBtn = messageItem.querySelector(".play-btn");
    playBtn.addEventListener("click", () => {
        wavesurfer.playPause();
    });
    wavesurfer.on("play", () => playBtn.textContent = "⏸️");
    wavesurfer.on("pause", () => playBtn.textContent = "▶️");
    wavesurfer.on("finish", () => playBtn.textContent = "▶️");
    messagesList.scrollTop = messagesList.scrollHeight;
}

function addPhotoMessage(photoUrl, type) {
    const messageItem = document.createElement("li");
    messageItem.classList.add("message", type);
    messageItem.innerHTML = `
        <div class="message-content">
            <img src="${photoUrl}" alt="Foto" style="max-width: 100%;">
            <span class="timestamp">${getCurrentTime()}</span>
        </div>
    `;
    messagesList.appendChild(messageItem);
    messagesList.scrollTop = messagesList.scrollHeight;
}

function addVideoMessage(videoUrl, type) {
    const messageItem = document.createElement("li");
    messageItem.classList.add("message", type);
    messageItem.innerHTML = `
        <div class="message-content">
            <video controls src="${videoUrl}" style="max-width: 100%;"></video>
            <span class="timestamp">${getCurrentTime()}</span>
        </div>
    `;
    messagesList.appendChild(messageItem);
    messagesList.scrollTop = messagesList.scrollHeight;
}

function getCurrentTime() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

// Ontvang berichten van anderen
socket.on('receive-message', (data) => {
    const type = data.sender === username ? "sent" : "received";
    switch (data.type) {
        case 'text':
            addTextMessage(data.content, type);
            break;
        case 'voice':
            addVoiceMessage(data.content, type);
            break;
        case 'photo':
            addPhotoMessage(data.content, type);
            break;
        case 'video':
            addVideoMessage(data.content, type);
            break;
    }
});

// Uitloggen
logoutBtn.addEventListener("click", () => {
    username = "";
    document.getElementById("username-container").style.display = "block";
    chatContainer.style.display = "none";
    messagesList.innerHTML = "";
});