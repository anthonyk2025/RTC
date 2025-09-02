// --- Professional File Sharing Logic (Chunk-based) ---

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const fileReceivers = {}; // Stores incoming file data

// --- SENDER LOGIC ---
window.sendFile = (file, socket) => {
    if (!file) return;
    const fileReader = new FileReader();
    // Create a unique ID for each file transfer to avoid collisions
    const fileId = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

    fileReader.onload = () => {
        const arrayBuffer = fileReader.result;
        const metadata = { id: fileId, name: file.name, type: file.type, size: file.size };

        socket.emit('file:start', metadata);
        
        let offset = 0;
        while (offset < arrayBuffer.byteLength) {
            const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
            socket.emit('file:chunk', { id: fileId, chunk });
            offset += CHUNK_SIZE;
        }

        addFileLogEntry({ from: 'You', id: fileId, name: file.name, size: file.size });
    };
    fileReader.readAsArrayBuffer(file);
};

// --- RECEIVER LOGIC ---
window.setupFileReceivers = (socket) => {
    socket.on('file:start', (metadata) => {
        fileReceivers[metadata.id] = { metadata, chunks: [], receivedSize: 0 };
        addFileLogEntry(metadata, `Receiving: ${metadata.name} (0%)`);
    });

    socket.on('file:chunk', (data) => {
        const receiver = fileReceivers[data.id];
        if (!receiver) return;

        receiver.chunks.push(data.chunk);
        receiver.receivedSize += data.chunk.byteLength;

        const progress = Math.round((receiver.receivedSize / receiver.metadata.size) * 100);
        updateFileLogProgress(data.id, `Receiving: ${receiver.metadata.name} (${progress}%)`);

        if (receiver.receivedSize >= receiver.metadata.size) {
            reassembleAndDownload(receiver);
            delete fileReceivers[data.id];
        }
    });
};

// --- UI & DOWNLOAD LOGIC (CORRECTED) ---
function reassembleAndDownload(receiver) {
    const { metadata, chunks } = receiver;
    const fileBlob = new Blob(chunks, { type: metadata.type });
    
    // Create a temporary URL representing the file in the browser's memory
    const url = URL.createObjectURL(fileBlob);
    
    const entryId = `file-entry-${metadata.id}`;
    const entry = document.getElementById(entryId);

    if (entry) {
        // --- THIS IS THE CRITICAL FIX ---
        // 1. Set the 'href' to the temporary file URL
        entry.href = url;
        // 2. Set the 'download' attribute to the original filename
        entry.download = metadata.name;
        // 3. Add a class to enable hover effects from the CSS
        entry.classList.add('downloadable');
        
        // Update the text to tell the user they can now download it
        const metaElement = entry.querySelector('.file-meta');
        if(metaElement) {
            metaElement.textContent = `From ${metadata.from} - Click to download`;
        }
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function addFileLogEntry(metadata, initialText) {
    const fileLog = document.getElementById('files');
    const entry = document.createElement('a');
    entry.id = `file-entry-${metadata.id}`;
    entry.classList.add('file-entry');
    
    // Prevent clicking on the entry while it's still being received
    entry.onclick = (e) => {
        if (!entry.classList.contains('downloadable')) {
            e.preventDefault();
        }
    };
    
    const textToShow = initialText || metadata.name;
    const fromText = metadata.from === 'You' ? 'You sent' : `From ${metadata.from}`;

    entry.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"></path></svg>
        <div class="file-info">
            <span class="file-name">${textToShow}</span>
            <span class="file-meta">${fromText} · ${formatFileSize(metadata.size)}</span>
        </div>
    `;
    fileLog.appendChild(entry);
}

function updateFileLogProgress(fileId, text) {
    const entry = document.getElementById(`file-entry-${fileId}`);
    if (entry) {
        entry.querySelector('.file-name').textContent = text;
    }
}