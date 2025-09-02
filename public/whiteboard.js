// A flag to check if the script is already initialized
let isWhiteboardInitialized = false;

// Expose functions to the global scope so room.js can call them
window.initWhiteboard = (canvas, socket) => {
    if (isWhiteboardInitialized) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Function to set canvas size correctly
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }

    // Set initial size and resize on window changes
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function draw(x, y, prevX, prevY, color = 'black', emit = false) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.closePath();

        if (emit) {
            socket.emit('wb:draw', { x, y, prevX, prevY, color });
        }
    }
    
    // --- Event Listeners for Drawing ---
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        draw(e.offsetX, e.offsetY, lastX, lastY, 'black', true);
        [lastX, lastY] = [e.offsetX, e.offsetY];
    });

    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);
    
    // --- Socket Listeners for Receiving Drawings ---
    socket.on('wb:draw', (data) => {
        draw(data.x, data.y, data.prevX, data.prevY, data.color);
    });

    socket.on('wb:clear', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    isWhiteboardInitialized = true;
};

// Expose the clear function globally
window.clearCanvas = () => {
    const canvas = document.getElementById('board');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
};