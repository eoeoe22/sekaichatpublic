document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const errorDiv = document.getElementById('errorMessage');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    // 버튼 비활성화
    submitButton.disabled = true;
    submitButton.textContent = '로그인 중...';
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            // 쿠키 설정을 위한 충분한 지연
            setTimeout(() => {
                window.location.href = `/chat?t=${Date.now()}`;
            }, 300);
        } else {
            errorDiv.textContent = '으....이....';
            errorDiv.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = '로그인';
        }
    } catch (error) {
        errorDiv.textContent = '으....이....';
        errorDiv.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = '로그인';
    }
});
