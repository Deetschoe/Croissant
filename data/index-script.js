// Check for initials on home page
document.addEventListener('DOMContentLoaded', () => {
    const storedInitials = localStorage.getItem('userInitials');
    if (!storedInitials) {
        // Redirect to initials page if not set
        window.location.href = '/initials.html';
    }
});
