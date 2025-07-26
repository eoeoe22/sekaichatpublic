let currentConversationId = null;
let userInfo = null;
let lastUploadedImageData = null;
let currentCharacters = [];
let availableCharacters = [];
let awaitingResponse = false;
let autoCallInProgress = false;
let currentWorkMode = false;
let currentShowTime = true;
let currentSituationPrompt = '';

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('페이지 로딩 시작 - 초기화 진행');
        
        // 인증 상태 확인
        const isAuthenticated = await checkAuthentication();
        if (!isAuthenticated) {
            console.log('인증 실패 - 로그인 페이지로 리다이렉트');
            window.location.href = '/login';
            return;
        }
        
        console.log('인증 성공 - 초기화 시작');
        
        // 초기화 진행
        await loadUserInfo();
        await loadCharacters();
        
        // 사이드바 초기화 (sidebar.js에서 처리)
        if (window.initializeSidebar) {
            await window.initializeSidebar();
        }
        
        // 이벤트 리스너 설정
        setupEventListeners();
        
        console.log('초기화 완료');
    } catch (error) {
        console.error('초기화 중 오류:', error);
        window.location.href = '/login';
    }
});

// HTML 이스케이프 함수
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 긴 텍스트 처리 함수 (모바일 레이아웃 개선용)
function processLongText(text) {
    // 매우 긴 단어나 URL에 줄바꿈 지점 추가
    return text.replace(/(\S{25,})/g, (match) => {
        // 25자 이상의 연속된 문자는 적절한 위치에서 줄바꿈 허용
        return match.replace(/(.{15})/g, '$1&#8203;'); // 제로 너비 공백 추가
    });
}

// 🔧 메시지 삭제 함수
async function deleteMessage(messageId, messageElement) {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/messages/${messageId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            // DOM에서 메시지 제거
            messageElement.remove();
            
            // 대화 목록 새로고침
            if (window.loadConversations) {
                await window.loadConversations();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            alert('메시지 삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('메시지 삭제 오류:', error);
        alert('메시지 삭제에 실패했습니다.');
    }
}

// 유니코드 이모지 제거 함수
function removeUnicodeEmojis(content) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE0F}]|[\u{200D}]/gu;
    return content.replace(emojiRegex, '');
}

// 인증 상태 확인
async function checkAuthentication() {
    try {
        const response = await fetch('/api/user/info');
        return response.ok;
    } catch (error) {
        console.error('인증 확인 실패:', error);
        return false;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 메시지 전송
    document.getElementById('sendButton').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 이미지 업로드
    document.getElementById('imageUploadBtn').addEventListener('click', () => {
        if (!userInfo.has_api_key) {
            alert('이미지 업로드는 개인 Gemini API 키가 등록된 사용자만 이용할 수 있습니다.');
            return;
        }
        document.getElementById('imageInput').click();
    });
    
    document.getElementById('imageInput').addEventListener('change', handleImageUpload);
    
    // 캐릭터 초대
    document.getElementById('inviteCharacterBtn').addEventListener('click', showInviteModal);
    
    // 헤더 컨트롤 토글
    const headerControlsToggle = document.getElementById('headerControlsToggle');
    if (headerControlsToggle) {
        headerControlsToggle.addEventListener('click', toggleHeaderControls);
    }
    
    // 작업 모드 토글
    document.getElementById('workModeToggle').addEventListener('change', handleWorkModeToggle);
    
    // 시간 정보 토글
    document.getElementById('showTimeToggle').addEventListener('change', handleShowTimeToggle);
    
    // 제목 수정 버튼
    document.getElementById('editTitleBtn').addEventListener('click', showEditTitleModal);
    document.getElementById('saveTitleBtn').addEventListener('click', saveConversationTitle);
    
    // 상황 프롬프트 버튼
    document.getElementById('situationPromptBtn').addEventListener('click', showSituationPromptModal);
    document.getElementById('saveSituationBtn').addEventListener('click', saveSituationPrompt);
    document.getElementById('clearSituationBtn').addEventListener('click', clearSituationPrompt);
    
    // 메시지 입력창 자동 크기 조절
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('input', autoResizeTextarea);
}

// 텍스트에어리어 자동 크기 조절
function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'; // 최대 4줄 정도
}

// 헤더 컨트롤 토글 함수
function toggleHeaderControls() {
    const content = document.getElementById('headerControlsContent');
    const toggleBtn = document.getElementById('headerControlsToggle');
    const icon = toggleBtn.querySelector('i');
    
    content.classList.toggle('collapsed');
    
    if (content.classList.contains('collapsed')) {
        icon.className = 'bi bi-chevron-down';
    } else {
        icon.className = 'bi bi-chevron-up';
    }
}

// 작업 모드 토글 처리
async function handleWorkModeToggle(e) {
    const isWorkMode = e.target.checked;
    currentWorkMode = isWorkMode;
    
    if (!currentConversationId) return;
    
    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/work-mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workMode: isWorkMode })
        });
        
        if (response.ok) {
            updateWorkModeUI(isWorkMode);
        } else {
            e.target.checked = !isWorkMode;
            currentWorkMode = !isWorkMode;
        }
    } catch (error) {
        console.error('작업 모드 설정 실패:', error);
        e.target.checked = !isWorkMode;
        currentWorkMode = !isWorkMode;
    }
}

// 시간 정보 토글 처리
async function handleShowTimeToggle(e) {
    const showTime = e.target.checked;
    currentShowTime = showTime;
    
    if (!currentConversationId) return;
    
    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/show-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ showTime: showTime })
        });
        
        if (!response.ok) {
            e.target.checked = !showTime;
            currentShowTime = !showTime;
        }
    } catch (error) {
        console.error('시간 정보 설정 실패:', error);
        e.target.checked = !showTime;
        currentShowTime = !showTime;
    }
}

// 제목 수정 모달 표시
function showEditTitleModal() {
    if (!currentConversationId) {
        alert('먼저 대화를 시작해주세요.');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('editTitleModal'));
    const input = document.getElementById('newTitleInput');
    const currentTitle = document.getElementById('conversationTitle').textContent;
    
    input.value = currentTitle === '세카이 채팅' ? '' : currentTitle;
    modal.show();
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 500);
}

// 대화 제목 저장
async function saveConversationTitle() {
    const newTitle = document.getElementById('newTitleInput').value.trim();
    
    if (!newTitle) {
        alert('제목을 입력해주세요.');
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        
        if (response.ok) {
            document.getElementById('conversationTitle').textContent = newTitle;
            bootstrap.Modal.getInstance(document.getElementById('editTitleModal')).hide();
            
            // 사이드바 대화 목록 새로고침
            if (window.loadConversations) {
                await window.loadConversations();
            }
        } else {
            alert('제목 수정에 실패했습니다.');
        }
    } catch (error) {
        console.error('제목 수정 오류:', error);
        alert('제목 수정에 실패했습니다.');
    }
}

// 상황 프롬프트 모달 표시
function showSituationPromptModal() {
    if (!currentConversationId) {
        alert('먼저 대화를 시작해주세요.');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('situationPromptModal'));
    const input = document.getElementById('situationPromptInput');
    
    input.value = currentSituationPrompt;
    modal.show();
    
    setTimeout(() => {
        input.focus();
    }, 500);
}

// 상황 프롬프트 저장
async function saveSituationPrompt() {
    const prompt = document.getElementById('situationPromptInput').value.trim();
    
    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/situation-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ situationPrompt: prompt })
        });
        
        if (response.ok) {
            currentSituationPrompt = prompt;
            bootstrap.Modal.getInstance(document.getElementById('situationPromptModal')).hide();
            
            if (prompt) {
                alert('상황 설정이 저장되었습니다.');
            } else {
                alert('상황 설정이 삭제되었습니다.');
            }
        } else {
            alert('상황 설정 저장에 실패했습니다.');
        }
    } catch (error) {
        console.error('상황 설정 저장 오류:', error);
        alert('상황 설정 저장에 실패했습니다.');
    }
}

// 상황 프롬프트 삭제
async function clearSituationPrompt() {
    if (!confirm('상황 설정을 삭제하시겠습니까?')) {
        return;
    }
    
    document.getElementById('situationPromptInput').value = '';
    await saveSituationPrompt();
}

// 작업 모드 UI 업데이트
function updateWorkModeUI(isWorkMode) {
    const chatContainer = document.querySelector('.chat-container');
    if (isWorkMode) {
        chatContainer.classList.add('work-mode-active');
    } else {
        chatContainer.classList.remove('work-mode-active');
    }
}

// 사용자 정보 로드
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user/info');
        
        if (response.ok) {
            userInfo = await response.json();
            window.userInfo = userInfo;
            
            updateModelSelector();
            updateImageUploadButton();
            
        } else if (response.status === 401) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
        window.location.href = '/login';
    }
}

// 캐릭터 목록 로드
async function loadCharacters() {
    try {
        const response = await fetch('/api/characters');
        if (response.ok) {
            availableCharacters = await response.json();
            window.availableCharacters = availableCharacters;
        }
    } catch (error) {
        console.error('캐릭터 목록 로드 실패:', error);
    }
}

// 대화 로드 함수 (메시지 ID 포함)
async function loadConversation(id) {
    currentConversationId = id;
    awaitingResponse = false;
    autoCallInProgress = false;
    window.currentConversationId = currentConversationId;
    
    try {
        const response = await fetch(`/api/conversations/${id}`);
        if (response.ok) {
            const conversationData = await response.json();
            
            let messages = [];
            let workModeValue = 0;
            let showTimeValue = 1;
            let situationPrompt = '';
            
            if (conversationData.messages) {
                messages = conversationData.messages;
                workModeValue = conversationData.work_mode || 0;
                showTimeValue = conversationData.show_time_info !== undefined ? conversationData.show_time_info : 1;
                situationPrompt = conversationData.situation_prompt || '';
            } else if (Array.isArray(conversationData)) {
                messages = conversationData;
            }
            
            currentWorkMode = !!workModeValue;
            currentShowTime = !!showTimeValue;
            currentSituationPrompt = situationPrompt;
            
            document.getElementById('workModeToggle').checked = currentWorkMode;
            document.getElementById('showTimeToggle').checked = currentShowTime;
            updateWorkModeUI(currentWorkMode);
            
            const messagesDiv = document.getElementById('chatMessages');
            messagesDiv.innerHTML = '';
            
            await loadConversationParticipants(id);
            
            if (messages.length === 0) {
                messagesDiv.innerHTML = '';
            } else {
                messages.forEach(msg => {
                    if (msg.message_type === 'image' && msg.filename) {
                        const cleanContent = removeUnicodeEmojis(msg.content);
                        addImageMessage(msg.role, cleanContent, `/api/images/${msg.filename}`, msg.id);
                    } else {
                        const cleanContent = removeUnicodeEmojis(msg.content);
                        addMessage(msg.role, cleanContent, msg.character_name, msg.character_image, msg.auto_call_sequence, msg.id);
                    }
                });
            }
            
            let conversationTitle = '세카이 채팅';
            if (window.allConversations) {
                const currentConv = window.allConversations.find(conv => conv.id === id);
                if (currentConv && currentConv.title) {
                    conversationTitle = removeUnicodeEmojis(currentConv.title);
                }
            }
            document.getElementById('conversationTitle').textContent = conversationTitle;
            
            if (window.loadConversations) {
                await window.loadConversations();
            }
            
        } else if (response.status === 401) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('대화 로드 오류:', error);
        alert('대화를 불러오는 중 오류가 발생했습니다.');
    }
}

// 대화 참여자 로드
async function loadConversationParticipants(conversationId) {
    try {
        const response = await fetch(`/api/conversations/${conversationId}/participants`);
        if (response.ok) {
            currentCharacters = await response.json();
            window.currentCharacters = currentCharacters;
            updateInvitedCharactersUI();
            updateHeaderCharacterAvatars();
        }
    } catch (error) {
        console.error('참여자 로드 실패:', error);
        currentCharacters = [];
        window.currentCharacters = [];
    }
}

// 메시지 전송
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message || awaitingResponse) return;
    
    if (!currentConversationId) {
        await startNewConversation();
        if (!currentConversationId) {
            alert('으....이....');
            return;
        }
    }
    
    const cleanMessage = removeUnicodeEmojis(message);
    addMessage('user', cleanMessage);
    input.value = '';
    input.style.height = 'auto'; // 텍스트에어리어 높이 초기화
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                conversationId: currentConversationId
            })
        });
        
        if (response.ok) {
            awaitingResponse = true;
            if (window.loadConversations) {
                await window.loadConversations();
            }
            
            if (currentCharacters.length === 0) {
                addMessage('system', '캐릭터를 초대한 후 캐릭터 프로필을 클릭하여 응답을 생성하세요.');
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

// 캐릭터 응답 생성
async function generateCharacterResponse(characterId) {
    console.log('캐릭터 응답 생성 시도:', characterId);
    
    if (autoCallInProgress) {
        console.log('자동 호출 진행 중이므로 무시');
        return;
    }
    
    const selectedModel = document.getElementById('modelSelect').value;
    const imageToggle = document.getElementById('imageToggle').checked;
    
    const character = currentCharacters.find(c => c.id === characterId) || 
                     availableCharacters.find(c => c.id === characterId);
    
    const loadingDiv = addMessage('assistant', '...', character?.name, character?.profile_image);
    
    try {
        const requestBody = {
            characterId,
            conversationId: currentConversationId,
            workMode: currentWorkMode,
            showTime: currentShowTime,
            situationPrompt: currentSituationPrompt
        };
        
        if (imageToggle && lastUploadedImageData) {
            requestBody.imageData = lastUploadedImageData;
        }
        
        const response = await fetch('/api/chat/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            const cleanResponse = removeUnicodeEmojis(data.response);
            const { text, emoji } = parseCustomEmoji(cleanResponse);
            
            const messageContent = loadingDiv.parentElement.parentElement;
            const processedText = processLongText(escapeHtml(text));
            messageContent.querySelector('.message-bubble').innerHTML = processedText;
            
            if (emoji) {
                const messageContentDiv = loadingDiv.parentElement;
                messageContentDiv.innerHTML += createCustomEmojiHTML(emoji);
            }
            
            awaitingResponse = false;
            
            if (data.autoCallTriggered && data.calledCharacter) {
                console.log(`자동 호출 감지: ${data.calledCharacter}`);
                await processAutoCall(data.calledCharacter, 1);
            }
            
            if (window.loadConversations) {
                await window.loadConversations();
            }
        } else if (response.status === 401) {
            window.location.href = '/login';
        } else {
            loadingDiv.textContent = '으....이....';
        }
    } catch (error) {
        loadingDiv.textContent = '으....이....';
    }
}

// 자동 호출 처리 함수
async function processAutoCall(characterName, sequence) {
    if (autoCallInProgress) {
        console.log('이미 자동 호출이 진행 중입니다.');
        return;
    }
    
    const maxSequence = userInfo.max_auto_call_sequence || 3;
    if (sequence > maxSequence) {
        console.log(`최대 연속 호출 횟수(${maxSequence}) 도달`);
        return;
    }
    
    const targetCharacter = currentCharacters.find(c => 
        c.name === characterName || c.nickname === characterName
    );
    
    if (!targetCharacter) {
        console.log(`호출할 캐릭터를 찾을 수 없음: ${characterName}`);
        return;
    }
    
    autoCallInProgress = true;
    
    setTimeout(async () => {
        try {
            console.log(`자동 호출 실행: ${characterName} (순서: ${sequence})`);
            
            addMessage('system', `${targetCharacter.name}이(가) 응답합니다...`);
            
            const character = targetCharacter;
            const loadingDiv = addMessage('assistant', '...', character.name, character.profile_image, sequence);
            
            const response = await fetch('/api/chat/auto-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterId: targetCharacter.id,
                    conversationId: currentConversationId,
                    sequence: sequence,
                    workMode: currentWorkMode,
                    showTime: currentShowTime,
                    situationPrompt: currentSituationPrompt
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                const cleanResponse = removeUnicodeEmojis(data.response);
                const { text, emoji } = parseCustomEmoji(cleanResponse);
                
                const messageContent = loadingDiv.parentElement.parentElement;
                const processedText = processLongText(escapeHtml(text));
                messageContent.querySelector('.message-bubble').innerHTML = processedText;
                
                if (emoji) {
                    const messageContentDiv = loadingDiv.parentElement;
                    messageContentDiv.innerHTML += createCustomEmojiHTML(emoji);
                }
                
                if (data.autoCallTriggered && data.calledCharacter && sequence < maxSequence) {
                    console.log(`연속 자동 호출: ${data.calledCharacter} (순서: ${sequence + 1})`);
                    setTimeout(() => {
                        autoCallInProgress = false;
                        processAutoCall(data.calledCharacter, sequence + 1);
                    }, 1000);
                } else {
                    autoCallInProgress = false;
                }
                
                if (window.loadConversations) {
                    await window.loadConversations();
                }
            } else {
                loadingDiv.textContent = '응답 생성 실패';
                autoCallInProgress = false;
            }
        } catch (error) {
            console.error('자동 호출 중 오류:', error);
            autoCallInProgress = false;
        }
    }, 2000);
}

// 🔧 캐릭터 초대 모달 표시 (과거 정상 동작 방식으로 복원)
function showInviteModal() {
    if (!currentConversationId) {
        alert('먼저 대화를 시작해주세요.');
        return;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('inviteModal'));
    const container = document.getElementById('availableCharacters');
    
    container.innerHTML = '';
    
    const invitedIds = currentCharacters.map(c => c.id);
    const available = availableCharacters.filter(c => !invitedIds.includes(c.id));
    
    if (available.length === 0) {
        container.innerHTML = '<p class="text-center">초대할 수 있는 캐릭터가 없습니다.</p>';
    } else {
        available.forEach(character => {
            const card = document.createElement('div');
            card.className = 'character-card';
            card.innerHTML = `
                <img src="${character.profile_image}" alt="${escapeHtml(character.name)}" class="character-card-avatar">
                <div class="character-card-info">
                    <h6>${escapeHtml(character.name)}</h6>
                    <p>${escapeHtml(character.nickname)}</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="inviteCharacter(${character.id})">초대</button>
            `;
            container.appendChild(card);
        });
    }
    
    modal.show();
}

// 캐릭터 초대
async function inviteCharacter(characterId) {
    try {
        const response = await fetch(`/api/conversations/${currentConversationId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId })
        });
        
        if (response.ok) {
            await loadConversationParticipants(currentConversationId);
            bootstrap.Modal.getInstance(document.getElementById('inviteModal')).hide();
        } else {
            alert('캐릭터 초대에 실패했습니다.');
        }
    } catch (error) {
        alert('캐릭터 초대에 실패했습니다.');
    }
}

// 초대된 캐릭터 UI 업데이트
function updateInvitedCharactersUI() {
    const container = document.getElementById('invitedCharacters');
    container.innerHTML = '';
    
    if (currentCharacters.length === 0) {
        container.innerHTML = '<p class="no-characters-text">초대된 캐릭터가 없습니다. 캐릭터를 초대해보세요!</p>';
        return;
    }
    
    currentCharacters.forEach((character) => {
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'character-avatar-container';
        avatarContainer.title = `${character.name} - 클릭하여 응답 생성`;
        avatarContainer.onclick = function() {
            generateCharacterResponse(character.id);
        };
        
        const avatar = document.createElement('img');
        avatar.src = character.profile_image;
        avatar.alt = character.name;
        avatar.className = 'invited-character-avatar clickable';
        
        avatarContainer.appendChild(avatar);
        container.appendChild(avatarContainer);
    });
}

// 헤더 캐릭터 아바타 업데이트
function updateHeaderCharacterAvatars() {
    const container = document.getElementById('headerCharacterAvatars');
    container.innerHTML = '';
    
    currentCharacters.forEach((character, index) => {
        const avatar = document.createElement('img');
        avatar.src = character.profile_image;
        avatar.alt = character.name;
        avatar.className = 'header-character-avatar';
        avatar.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
        avatar.style.zIndex = currentCharacters.length - index;
        container.appendChild(avatar);
    });
}

// 새 대화 시작
async function startNewConversation() {
    try {
        const response = await fetch('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        if (response.ok) {
            const data = await response.json();
            currentConversationId = data.id;
            window.currentConversationId = currentConversationId;
            currentCharacters = [];
            window.currentCharacters = [];
            lastUploadedImageData = null;
            awaitingResponse = false;
            autoCallInProgress = false;
            
            currentWorkMode = false;
            currentShowTime = true;
            currentSituationPrompt = '';
            
            document.getElementById('workModeToggle').checked = false;
            document.getElementById('showTimeToggle').checked = true;
            updateWorkModeUI(false);
            
            document.getElementById('chatMessages').innerHTML = '';
            document.getElementById('conversationTitle').textContent = '세카이 채팅';
            updateInvitedCharactersUI();
            updateHeaderCharacterAvatars();
            
            if (window.loadConversations) {
                await window.loadConversations();
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

// 이미지 업로드 처리
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!userInfo.has_api_key) {
        alert('이미지 업로드는 개인 Gemini API 키가 등록된 사용자만 이용할 수 있습니다.');
        return;
    }
    
    if (!validateImageFile(file)) {
        alert('지원하지 않는 파일 형식이거나 크기가 5MB를 초과합니다.');
        return;
    }
    
    if (!currentConversationId) {
        await startNewConversation();
        if (!currentConversationId) {
            alert('대화방 생성에 실패했습니다.');
            return;
        }
    }
    
    const uploadModal = new bootstrap.Modal(document.getElementById('uploadModal'));
    
    try {
        uploadModal.show();
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', currentConversationId);
        
        const uploadResponse = await fetch('/api/upload/direct', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error('업로드 실패');
        }
        
        const { fileId, imageUrl, fileName } = await uploadResponse.json();
        
        const base64Data = await fileToBase64(file);
        lastUploadedImageData = {
            base64Data: base64Data,
            mimeType: file.type,
            fileName: file.name
        };
        
        const cleanFileName = removeUnicodeEmojis(file.name);
        addImageMessage('user', cleanFileName, imageUrl);
        
        if (window.loadConversations) {
            await window.loadConversations();
        }
        
        addMessage('system', '이미지가 업로드되었습니다. 메시지를 입력하면 캐릭터가 이미지를 참고해서 답변합니다.');
        
    } catch (error) {
        console.error('이미지 업로드 실패:', error);
        alert('업로드 실패');
    } finally {
        uploadModal.hide();
        event.target.value = '';
    }
}

// 🔧 이미지 메시지 추가 (삭제 버튼 포함)
function addImageMessage(role, fileName, imageUrl, messageId = null) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const cleanFileName = removeUnicodeEmojis(fileName);
    const escapedFileName = escapeHtml(cleanFileName);
    
    // 🔧 삭제 버튼 HTML
    const deleteButtonHtml = messageId ? 
        `<div class="message-delete-wrapper">
            <button class="message-delete-btn" onclick="deleteMessage(${messageId}, this.closest('.message'))" title="메시지 삭제">
                <i class="bi bi-trash-fill"></i>
            </button>
         </div>` : '';
    
    if (role === 'user') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="image-message">
                    <img src="${imageUrl}" alt="${escapedFileName}" class="uploaded-image">
                    <div class="image-info">${escapedFileName}</div>
                </div>
                ${deleteButtonHtml}
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <img src="/images/characters/kanade.webp" alt="카나데" class="message-avatar">
            <div class="message-content">
                <div class="image-message">
                    <img src="${imageUrl}" alt="${escapedFileName}" class="uploaded-image">
                    <div class="image-info">${escapedFileName}</div>
                </div>
                ${deleteButtonHtml}
            </div>
        `;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// 커스텀 이모지 HTML 생성 함수
function createCustomEmojiHTML(emojiFileName) {
    const emojiId = `emoji_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return `
        <div class="custom-emoji" id="container_${emojiId}">
            <img src="/images/emojis/${emojiFileName}" 
                 alt="emoji" 
                 class="emoji-image" 
                 id="${emojiId}"
                 onerror="handleEmojiLoadError('${emojiId}')">
        </div>
    `;
}

// 이모지 로딩 실패 처리 함수
function handleEmojiLoadError(emojiId) {
    const emojiImg = document.getElementById(emojiId);
    const emojiContainer = document.getElementById(`container_${emojiId}`);
    
    if (emojiImg) {
        emojiImg.classList.add('failed-to-load');
    }
    
    if (emojiContainer) {
        emojiContainer.classList.add('hidden');
    }
    
    console.log(`이모지 로딩 실패: ${emojiId}`);
}

// 커스텀 이모지 파싱 함수 (괄호, 느낌표 포함)
function parseCustomEmoji(content) {
    const emojiRegex = /::([\가-힣\w\s\-_\(\)!]+\.(jpg|jpeg|png|gif|webp))::/i;
    const match = content.match(emojiRegex);
    
    if (match) {
        const emojiFileName = match[1];
        const text = content.replace(emojiRegex, '').trim();
        return { text, emoji: emojiFileName };
    }
    
    return { text: content, emoji: null };
}

// 🔧 메시지 추가 함수 (삭제 버튼 포함)
function addMessage(role, content, characterName = null, characterImage = null, autoCallSequence = 0, messageId = null) {
    const messagesDiv = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    if (autoCallSequence > 0) {
        messageDiv.classList.add('auto-called-message');
        messageDiv.setAttribute('data-auto-sequence', autoCallSequence);
    }
    
    const cleanedContent = removeUnicodeEmojis(content);
    const { text, emoji } = parseCustomEmoji(cleanedContent);
    
    // HTML 이스케이프 + 긴 텍스트 처리
    const processedText = processLongText(escapeHtml(text));
    
    // 🔧 삭제 버튼 HTML (시스템 메시지가 아닌 경우에만)
    const deleteButtonHtml = role !== 'system' && messageId ? 
        `<div class="message-delete-wrapper">
            <button class="message-delete-btn" onclick="deleteMessage(${messageId}, this.closest('.message'))" title="메시지 삭제">
                <i class="bi bi-trash-fill"></i>
            </button>
         </div>` : '';
    
    if (role === 'assistant') {
        let avatarSrc = '/images/characters/kanade.webp';
        let altText = '카나데';
        
        if (characterImage) {
            avatarSrc = characterImage;
        }
        if (characterName) {
            altText = characterName;
        }
        
        if (text === '...') {
            messageDiv.innerHTML = `
                <img src="${avatarSrc}" alt="${escapeHtml(altText)}" class="message-avatar">
                <div class="message-content">
                    <div class="message-bubble">
                        <div class="typing-indicator">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <img src="${avatarSrc}" alt="${escapeHtml(altText)}" class="message-avatar">
                <div class="message-content">
                    <div class="message-bubble">${processedText}</div>
                    ${emoji ? createCustomEmojiHTML(emoji) : ''}
                    ${deleteButtonHtml}
                </div>
            `;
        }
    } else if (role === 'system') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-bubble system-message">${processedText}</div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">${processedText}</div>
                ${emoji ? createCustomEmojiHTML(emoji) : ''}
                ${deleteButtonHtml}
            </div>
        `;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return messageDiv.querySelector('.message-bubble');
}

// 유틸리티 함수들
function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(file.type)) return false;
    if (file.size > maxSize || file.size <= 0) return false;
    
    return true;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateModelSelector() {
    const modelSelect = document.getElementById('modelSelect');
    const proOption = modelSelect.querySelector('option[value="gemini-2.5-pro"]');
    
    if (proOption) {
        proOption.disabled = !userInfo.has_api_key;
        
        if (!userInfo.has_api_key && modelSelect.value === 'gemini-2.5-pro') {
            modelSelect.value = 'gemini-2.0-flash';
        }
    }
}

function updateImageUploadButton() {
    const uploadBtn = document.getElementById('imageUploadBtn');
    if (uploadBtn) {
        if (userInfo.has_api_key) {
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
            uploadBtn.title = '이미지 업로드';
        } else {
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.cursor = 'not-allowed';
            uploadBtn.title = '개인 API 키가 필요합니다';
        }
    }
}

// 전역 함수로 내보내기
window.loadConversation = loadConversation;
window.startNewConversation = startNewConversation;
window.handleEmojiLoadError = handleEmojiLoadError;
window.deleteMessage = deleteMessage;
