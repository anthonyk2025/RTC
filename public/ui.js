document.addEventListener('DOMContentLoaded', function () {
    
    // --- Hamburger Menu Functionality ---
    const hamburgerButton = document.getElementById('hamburger-btn');
    const roomHeader = document.getElementById('room-header');

    if (hamburgerButton && roomHeader) {
        hamburgerButton.addEventListener('click', function () {
            // This single line toggles the class on the header element
            roomHeader.classList.toggle('mobile-menu-open');
        });
    }

    // --- Sidebar Tabs Functionality ---
    const tabButtons = document.querySelectorAll('.tab-nav-btn');
    const tabPanels = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // First, deactivate all buttons and panels
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            // Activate the button that was clicked
            button.classList.add('active');
            
            // Find and activate the corresponding content panel
            const targetPanelId = button.getAttribute('data-target');
            const targetPanel = document.querySelector(targetPanelId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

});