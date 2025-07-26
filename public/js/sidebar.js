// 검색 관련 변수
let allConversations = [];
let searchQuery = '';

// 사이드바 초기화 함수
async function initializeSidebar() {
    try {
        await loadNotice();
        await loadConversations();
        setupSidebarEventListeners();
        
        // 사용자 정보 UI 업데이트
        if (window.userInfo) {
            updateUserInfoUI();
            updateSidebarSettings();
        }
    } catch (error) {
        console.error('사이드바 초기화 오류:', error);
    }
}

// 🔧 수정된 사이드바 이벤트 리스너 설정
function setupSidebarEventListeners() {
    // 🔧 새로운 사이드바 버튼들
    document.getElementById('sidebarOpenBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('collapsed');
    });
    
    document.getElementById('sidebarCloseBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('collapsed');
    });
    
    // 검색 관련 이벤트
    document.getElementById('conversationSearch').addEventListener('input', handleSearchInput);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    
    // 새 대화 시작
    document.getElementById('newConversationBtn').addEventListener('click', () => {
        if (window.startNewConversation) {
            window.startNewConversation();
        }
    });
    
    // 폼 이벤트들
    document.getElementById('changePasswordForm').addEventListener('submit', changePassword);
    document.getElementById('changeNicknameForm').addEventListener('submit', changeNickname);
    document.getElementById('apiKeyForm').addEventListener('submit', manageApiKey);
    document.getElementById('deleteApiKeyBtn').addEventListener('click', deleteApiKey);
    document.getElementById('selfIntroForm').addEventListener('submit', updateSelfIntroduction);
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// 검색 입력 처리
function handleSearchInput(e) {
    searchQuery = e.target.value.toLowerCase().trim();
    displayConversations();
}

// 검색 초기화
function clearSearch() {
    document.getElementById('conversationSearch').value = '';
    searchQuery = '';
    displayConversations();
}

// 공지사항 로드
async function loadNotice() {
    try {
        const response = await fetch('/api/admin/notice');
        if (response.ok) {
            const data = await response.json();
            const formattedNotice = data.notice.replace(/\n/g, '<br>');
            document.getElementById('noticeContent').innerHTML = formattedNotice;
        }
    } catch (error) {
        console.error('공지사항 로드 실패:', error);
    }
}

// 대화 목록 로드
async function loadConversations() {
    try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
            allConversations = await response.json();
            window.allConversations = allConversations; // 전역 변수로 설정
            displayConversations();
        } else if (response.status === 401) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('대화내역 로드 실패:', error);
    }
}

// 대화 목록 표시 함수
function displayConversations() {
    const listElement = document.getElementById('conversationList');
    listElement.innerHTML = '';
    
    // 검색 필터링
    let filteredConversations = allConversations;
    if (searchQuery) {
        filteredConversations = allConversations.filter(conv => 
            conv.title && conv.title.toLowerCase().includes(searchQuery)
        );
    }
    
    // 즐겨찾기 우선 정렬
    filteredConversations.sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    // 검색 결과가 없는 경우
    if (filteredConversations.length === 0) {
        if (searchQuery) {
            listElement.innerHTML = '<div class="no-search-results">검색 결과가 없습니다</div>';
        }
        return;
    }
    
    filteredConversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conv.id === window.currentConversationId) {
            item.classList.add('active');
        }
        if (conv.is_favorite) {
            item.classList.add('favorite');
        }
        
        // 참여 캐릭터 이미지 표시
        const participantImagesHtml = conv.participant_images ? 
            conv.participant_images.map(img => 
                `<img src="${img}" class="participant-avatar" style="transform: rotate(${Math.random() * 20 - 10}deg);">`
            ).join('') : '';
        
        // 대화 제목에서 유니코드 이모지 제거
        const cleanTitle = removeUnicodeEmojis(conv.title);
        
        item.innerHTML = `
            <div class="conversation-info" onclick="loadConversation(${conv.id})" style="cursor: pointer; flex: 1;">
                <div class="conversation-title" data-conversation-id="${conv.id}" ondblclick="startEditTitle(${conv.id}, event)">${cleanTitle}</div>
                <input type="text" class="title-edit-input" data-conversation-id="${conv.id}" onblur="saveTitle(${conv.id})" onkeypress="handleTitleKeypress(event, ${conv.id})">
                <div class="participant-images">${participantImagesHtml}</div>
            </div>
            <div class="conversation-actions">
                <i class="bi ${conv.is_favorite ? 'bi-star-fill' : 'bi-star'} favorite-btn ${conv.is_favorite ? 'active' : ''}" 
                   onclick="toggleFavorite(${conv.id}, event)"></i>
                ${!conv.is_favorite ? `<i class="bi bi-trash delete-conversation" onclick="deleteConversation(${conv.id})"></i>` : ''}
            </div>
        `;
        listElement.appendChild(item);
    });
}

// 즐겨찾기 토글
async function toggleFavorite(conversationId, event) {
    event.stopPropagation();
    
    try {
        const response = await fetch(`/api/conversations/${conversationId}/favorite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            await loadConversations();
        } else {
            alert('즐겨찾기 설정에 실패했습니다.');
        }
    } catch (error) {
        alert('즐겨찾기 설정에 실패했습니다.');
    }
}

// 제목 수정 시작
function startEditTitle(conversationId, event) {
    event.stopPropagation();
    
    const titleElement = document.querySelector(`.conversation-title[data-conversation-id="${conversationId}"]`);
    const inputElement = document.querySelector(`.title-edit-input[data-conversation-id="${conversationId}"]`);
    
    if (titleElement && inputElement) {
        const currentTitle = titleElement.textContent;
        inputElement.value = currentTitle;
        
        titleElement.classList.add('editing');
        inputElement.classList.add('active');
        inputElement.focus();
        inputElement.select();
    }
}

// 제목 저장
async function saveTitle(conversationId) {
    const titleElement = document.querySelector(`.conversation-title[data-conversation-id="${conversationId}"]`);
    const inputElement = document.querySelector(`.title-edit-input[data-conversation-id="${conversationId}"]`);
    
    if (titleElement && inputElement) {
        const newTitle = inputElement.value.trim();
        
        if (newTitle && newTitle !== titleElement.textContent) {
            try {
                const response = await fetch(`/api/conversations/${conversationId}/title`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle })
                });
                
                if (response.ok) {
                    titleElement.textContent = newTitle;
                    if (conversationId === window.currentConversationId) {
                        document.getElementById('conversationTitle').textContent = newTitle;
                    }
                    await loadConversations();
                } else {
                    alert('제목 변경에 실패했습니다.');
                }
            } catch (error) {
                alert('제목 변경에 실패했습니다.');
            }
        }
        
        titleElement.classList.remove('editing');
        inputElement.classList.remove('active');
    }
}

// 제목 수정 키보드 이벤트
function handleTitleKeypress(event, conversationId) {
    if (event.key === 'Enter') {
        event.target.blur();
    } else if (event.key === 'Escape') {
        const titleElement = document.querySelector(`.conversation-title[data-conversation-id="${conversationId}"]`);
        const inputElement = document.querySelector(`.title-edit-input[data-conversation-id="${conversationId}"]`);
        
        if (titleElement && inputElement) {
            titleElement.classList.remove('editing');
            inputElement.classList.remove('active');
        }
    }
}

// 사용자 정보 UI 업데이트
function updateUserInfoUI() {
    if (window.userInfo) {
        document.getElementById('userInfo').innerHTML = `
            아이디: ${window.userInfo.username}<br>
            닉네임: ${window.userInfo.nickname}
        `;
        
        // 자기소개 필드 업데이트
        document.getElementById('selfIntroInput').value = window.userInfo.self_introduction || '';
        
        // 연속 호출 설정 업데이트
        document.getElementById('maxAutoCall').value = window.userInfo.max_auto_call_sequence || 3;
    }
}

// 사이드바 설정 업데이트
function updateSidebarSettings() {
    if (window.userInfo) {
        updateApiKeyUI();
    }
}

// API 키 UI 업데이트
function updateApiKeyUI() {
    const input = document.getElementById('apiKeyInput');
    const submitBtn = document.getElementById('apiKeySubmitBtn');
    const deleteBtn = document.getElementById('deleteApiKeyBtn');
    
    if (window.userInfo.has_api_key) {
        input.value = '●●●●●●●●●●●●●●●●';
        submitBtn.textContent = '변경하기';
        deleteBtn.style.display = 'inline-block';
    } else {
        input.value = '';
        submitBtn.textContent = '등록하기';
        deleteBtn.style.display = 'none';
    }
}

// 자기소개 업데이트
async function updateSelfIntroduction(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'self_introduction',
                self_introduction: formData.get('self_introduction')
            })
        });
        
        if (response.ok) {
            alert('자기소개가 저장되었습니다.');
            // 사용자 정보 재로드
            if (window.loadUserInfo) {
                await window.loadUserInfo();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('으....이....');
        }
    } catch (error) {
        alert('으....이....');
    }
}

// 연속 호출 설정 업데이트
async function updateAutoCallSetting() {
    const maxSequence = document.getElementById('maxAutoCall').value;
    
    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'max_auto_call_sequence',
                max_auto_call_sequence: maxSequence
            })
        });
        
        if (response.ok) {
            alert('설정이 저장되었습니다.');
            if (window.loadUserInfo) {
                await window.loadUserInfo();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('으....이....');
        }
    } catch (error) {
        alert('으....이....');
    }
}

// 비밀번호 변경
async function changePassword(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    if (newPassword !== confirmPassword) {
        alert('으....이....');
        return;
    }
    
    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'password',
                current_password: formData.get('current_password'),
                new_password: newPassword
            })
        });
        
        if (response.ok) {
            alert('비밀번호가 변경되었습니다.');
            e.target.reset();
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('으....이....');
        }
    } catch (error) {
        alert('으....이....');
    }
}

// 닉네임 변경
async function changeNickname(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'nickname',
                new_nickname: formData.get('new_nickname')
            })
        });
        
        if (response.ok) {
            alert('닉네임이 변경되었습니다.');
            e.target.reset();
            if (window.loadUserInfo) {
                await window.loadUserInfo();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('으....이....');
        }
    } catch (error) {
        alert('으....이....');
    }
}

// API 키 관리
async function manageApiKey(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const apiKey = formData.get('api_key');
    
    if (apiKey === '●●●●●●●●●●●●●●●●') {
        alert('으....이....');
        return;
    }
    
    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'api_key',
                api_key: apiKey
            })
        });
        
        if (response.ok) {
            alert('API 키가 등록/변경되었습니다.');
            if (window.loadUserInfo) {
                await window.loadUserInfo();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('으....이....');
        }
    } catch (error) {
        alert('으....이....');
    }
}

// API 키 삭제
async function deleteApiKey() {
    if (!confirm('API 키를 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'delete_api_key'
            })
        });
        
        if (response.ok) {
            alert('API 키가 삭제되었습니다.');
            if (window.loadUserInfo) {
                await window.loadUserInfo();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('으....이....');
        }
    } catch (error) {
        alert('으....이....');
    }
}

// 대화 삭제
async function deleteConversation(id) {
    if (!confirm('대화내역을 삭제하시겠습니까?')) return;
    
    try {
        const response = await fetch(`/api/conversations/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadConversations();
            if (window.currentConversationId === id) {
                window.currentConversationId = null;
                window.currentCharacters = [];
                
                // 빈 화면으로 초기화
                document.getElementById('chatMessages').innerHTML = '';
                document.getElementById('conversationTitle').textContent = '세카이 채팅';
                
                // 채팅 관련 UI 업데이트
                if (window.updateInvitedCharactersUI) {
                    window.updateInvitedCharactersUI();
                }
                if (window.updateHeaderCharacterAvatars) {
                    window.updateHeaderCharacterAvatars();
                }
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        }
    } catch (error) {
        alert('으....이....');
    }
}

// 로그아웃
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        alert('으....이....');
    }
}

// 유니코드 이모지 제거 함수 (chat.js와 동일)
function removeUnicodeEmojis(content) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE0F}]|[\u{200D}]/gu;
    return content.replace(emojiRegex, '');
}

// 전역 함수로 내보내기
window.initializeSidebar = initializeSidebar;
window.loadConversations = loadConversations;
window.updateAutoCallSetting = updateAutoCallSetting;
window.toggleFavorite = toggleFavorite;
window.startEditTitle = startEditTitle;
window.saveTitle = saveTitle;
window.handleTitleKeypress = handleTitleKeypress;
window.deleteConversation = deleteConversation;
