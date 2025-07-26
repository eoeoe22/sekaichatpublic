import { handleAuth } from './auth.js';
import { handleChat, handleCharacterGeneration, handleAutoCall } from './gemini.js';
import { handleCharacters } from './characters.js';
import { handleConversationParticipants } from './conversations.js';
import { logError, generateSalt, hashPassword, verifyPassword } from './utils.js';

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      console.log(`요청 받음: ${request.method} ${path}`);
      
      // 정적 파일 서빙
      if (path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/images/')) {
        return handleStaticFiles(path, env);
      }
      
      // API 라우팅
      if (path.startsWith('/api/')) {
        return handleAPI(request, env, path);
      }
      
      // 페이지 라우팅
      return handlePages(request, env);
    } catch (error) {
      await logError(error, env, 'Main Router');
      return new Response('으....이....', { status: 500 });
    }
  }
};

// 정적 파일 서빙 함수
async function handleStaticFiles(path, env) {
  try {
    if (env.ASSETS) {
      const file = await env.ASSETS.fetch(new Request(`https://dummy${path}`));
      return file;
    } else {
      return new Response('정적 파일 서비스를 사용할 수 없습니다', { status: 503 });
    }
  } catch (error) {
    await logError(error, env, 'Static Files');
    return new Response('정적 파일 로드 오류', { status: 500 });
  }
}

// API 라우팅 함수
async function handleAPI(request, env, path) {
  const method = request.method;
  
  console.log(`API 요청: ${method} ${path}`);
  
  switch (path) {
    // 기존 인증 관련 엔드포인트
    case '/api/auth/login':
      if (method === 'POST') return handleAuth.login(request, env);
      return new Response('으....이....', { status: 405 });
      
    case '/api/auth/register':
      if (method === 'POST') return handleAuth.register(request, env);
      return new Response('으....이....', { status: 405 });
      
    case '/api/auth/logout':
      if (method === 'POST') return handleAuth.logout(request, env);
      return new Response('으....이....', { status: 405 });
      
    // 채팅 관련 엔드포인트
    case '/api/chat':
      if (method === 'POST') return handleChat(request, env);
      return new Response('으....이....', { status: 405 });
      
    case '/api/chat/generate':
      if (method === 'POST') return handleCharacterGeneration(request, env);
      return new Response('으....이....', { status: 405 });
      
    case '/api/chat/auto-call':
      if (method === 'POST') return handleAutoCall(request, env);
      return new Response('으....이....', { status: 405 });
      
    // 캐릭터 관련 엔드포인트
    case '/api/characters':
      if (method === 'GET') return handleCharacters.getAll(request, env);
      return new Response('으....이....', { status: 405 });
      
    case '/api/characters/info':
      if (method === 'GET') return getCharacterInfo(request, env);
      return new Response('으....이....', { status: 405 });
      
    // 사용자 정보 관련 엔드포인트
    case '/api/user/info':
      if (method === 'GET') return getUserInfo(request, env);
      return new Response('으....이....', { status: 405 });
      
    case '/api/user/update':
      if (method === 'POST') return handleUserUpdate(request, env);
      return new Response('으....이....', { status: 405 });
      
    // 대화 관련 엔드포인트
    case '/api/conversations':
      if (method === 'GET') return handleConversations(request, env);
      if (method === 'POST') return createConversation(request, env);
      return new Response('으....이....', { status: 405 });
      
    // 관리자 관련 엔드포인트
    case '/api/admin/notice':
      if (method === 'GET') return getNotice(request, env);
      if (method === 'POST') return updateNotice(request, env);
      return new Response('으....이....', { status: 405 });
      
    // 업로드 관련 엔드포인트
    case '/api/upload/direct':
      if (method === 'POST') return handleDirectUpload(request, env);
      return new Response('으....이....', { status: 405 });
      
    default:
      // 대화방 개별 처리
      const conversationMatch = path.match(/^\/api\/conversations\/(\d+)$/);
      if (conversationMatch) {
        const conversationId = parseInt(conversationMatch[1]);
        if (method === 'GET') return getConversationMessages(request, env, conversationId);
        if (method === 'DELETE') return deleteConversation(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 🔧 새로 추가: 메시지 삭제 엔드포인트
      const messageMatch = path.match(/^\/api\/messages\/(\d+)$/);
      if (messageMatch) {
        const messageId = parseInt(messageMatch[1]);
        if (method === 'DELETE') return deleteMessage(request, env, messageId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 즐겨찾기 토글 엔드포인트
      const favoriteMatch = path.match(/^\/api\/conversations\/(\d+)\/favorite$/);
      if (favoriteMatch) {
        const conversationId = parseInt(favoriteMatch[1]);
        if (method === 'POST') return toggleConversationFavorite(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 제목 수정 엔드포인트
      const titleMatch = path.match(/^\/api\/conversations\/(\d+)\/title$/);
      if (titleMatch) {
        const conversationId = parseInt(titleMatch[1]);
        if (method === 'POST') return updateConversationTitle(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 작업 모드 설정 엔드포인트
      const workModeMatch = path.match(/^\/api\/conversations\/(\d+)\/work-mode$/);
      if (workModeMatch) {
        const conversationId = parseInt(workModeMatch[1]);
        if (method === 'POST') return updateWorkMode(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 🔧 새로 추가: 시간 정보 토글 엔드포인트
      const showTimeMatch = path.match(/^\/api\/conversations\/(\d+)\/show-time$/);
      if (showTimeMatch) {
        const conversationId = parseInt(showTimeMatch[1]);
        if (method === 'POST') return updateShowTime(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 🔧 새로 추가: 상황 프롬프트 엔드포인트
      const situationPromptMatch = path.match(/^\/api\/conversations\/(\d+)\/situation-prompt$/);
      if (situationPromptMatch) {
        const conversationId = parseInt(situationPromptMatch[1]);
        if (method === 'POST') return updateSituationPrompt(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 대화방 참여자 관리
      const participantMatch = path.match(/^\/api\/conversations\/(\d+)\/invite$/);
      if (participantMatch) {
        const conversationId = parseInt(participantMatch[1]);
        if (method === 'POST') return handleConversationParticipants.inviteCharacter(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      const participantListMatch = path.match(/^\/api\/conversations\/(\d+)\/participants$/);
      if (participantListMatch) {
        const conversationId = parseInt(participantListMatch[1]);
        if (method === 'GET') return handleConversationParticipants.getParticipants(request, env, conversationId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 캐릭터 개별 조회
      const characterMatch = path.match(/^\/api\/characters\/(\d+)$/);
      if (characterMatch) {
        const characterId = parseInt(characterMatch[1]);
        if (method === 'GET') return handleCharacters.getById(request, env, characterId);
        return new Response('으....이....', { status: 405 });
      }
      
      // 업로드된 이미지 서빙
      const imageMatch = path.match(/^\/api\/images\/(.+)$/);
      if (imageMatch) {
        const fileName = imageMatch[1];
        if (method === 'GET') return serveImage(request, env, fileName);
        return new Response('으....이....', { status: 405 });
      }
      
      return new Response('으....이....', { status: 404 });
  }
}

// 🔧 새로 추가: 시간 정보 토글 함수
async function updateShowTime(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화방 소유권 확인
    const conversation = await env.DB.prepare(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    const { showTime } = await request.json();
    
    await env.DB.prepare(
      'UPDATE conversations SET show_time_info = ? WHERE id = ?'
    ).bind(showTime ? 1 : 0, conversationId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      show_time_info: showTime ? 1 : 0 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Update Show Time');
    return new Response('으....이....', { status: 500 });
  }
}

// 🔧 새로 추가: 상황 프롬프트 업데이트 함수
async function updateSituationPrompt(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화방 소유권 확인
    const conversation = await env.DB.prepare(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    const { situationPrompt } = await request.json();
    const trimmedPrompt = situationPrompt ? situationPrompt.trim().substring(0, 1000) : ''; // 최대 1000자
    
    await env.DB.prepare(
      'UPDATE conversations SET situation_prompt = ? WHERE id = ?'
    ).bind(trimmedPrompt, conversationId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      situation_prompt: trimmedPrompt 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Update Situation Prompt');
    return new Response('으....이....', { status: 500 });
  }
}

// 🔧 새로 추가: 메시지 삭제 함수
async function deleteMessage(request, env, messageId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 메시지 소유권 확인
    const message = await env.DB.prepare(`
      SELECT m.*, c.user_id 
      FROM messages m
      LEFT JOIN conversations c ON m.conversation_id = c.id
      WHERE m.id = ?
    `).bind(messageId).first();
    
    if (!message) {
      return new Response('메시지를 찾을 수 없습니다.', { status: 404 });
    }
    
    if (message.user_id !== user.id) {
      return new Response('으....이....', { status: 403 });
    }
    
    // 이미지 파일이 있는 경우 R2에서도 삭제
    if (message.message_type === 'image' && message.file_id) {
      try {
        // 파일 정보 조회
        const fileInfo = await env.DB.prepare('SELECT r2_key FROM files WHERE id = ?')
          .bind(message.file_id).first();
        
        if (fileInfo && fileInfo.r2_key) {
          // R2에서 파일 삭제
          await env.R2.delete(fileInfo.r2_key);
          
          // 파일 레코드 삭제
          await env.DB.prepare('DELETE FROM files WHERE id = ?')
            .bind(message.file_id).run();
        }
      } catch (r2Error) {
        console.error('R2 파일 삭제 실패:', r2Error);
        // R2 삭제 실패해도 메시지는 삭제 진행
      }
    }
    
    // 메시지 삭제
    await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(messageId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Delete Message');
    return new Response('으....이....', { status: 500 });
  }
}

// 페이지 라우팅 함수
async function handlePages(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  let fileName = '';
  
  switch (path) {
    case '/':
      return getLandingPage();
      
    case '/chat':
      fileName = 'chat.html';
      break;
      
    case '/login':
      fileName = 'login.html';
      break;
      
    case '/register':
      fileName = 'register.html';
      break;
      
    case '/admin':
      fileName = 'admin.html';
      break;
      
    case '/characterinfo':
      fileName = 'characterinfo.html';
      break;

    case '/about':
      fileName = 'about.html';
      break;
      
    default:
      return new Response('으....이....', { status: 404 });
  }
  
  try {
    if (env.ASSETS) {
      const file = await env.ASSETS.fetch(new Request(`https://dummy/${fileName}`));
      return file;
    } else {
      return new Response('정적 파일 서비스를 사용할 수 없습니다', { status: 503 });
    }
  } catch (error) {
    await logError(error, env, 'Page Routing');
    return new Response('으....이....', { status: 404 });
  }
}

// 캐릭터 상세 정보 조회 함수
async function getCharacterInfo(request, env) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, nickname, profile_image, system_prompt FROM characters ORDER BY id ASC'
    ).all();
    
    return new Response(JSON.stringify(results || []), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    await logError(error, env, 'Get Character Info');
    return new Response('으....이....', { status: 500 });
  }
}

// 사용자 인증 확인 함수
async function getUserFromRequest(request, env) {
  try {
    const cookies = request.headers.get('Cookie');
    if (!cookies) return null;
    
    const tokenMatch = cookies.match(/token=([^;]+)/);
    if (!tokenMatch) return null;
    
    const tokenData = JSON.parse(atob(tokenMatch[1]));
    if (tokenData.exp < Date.now()) return null;
    
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(tokenData.userId).first();
    
    return user;
  } catch (error) {
    return null;
  }
}

// 사용자 정보 조회
async function getUserInfo(request, env) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    const userInfo = {
      username: user.username,
      nickname: user.nickname,
      self_introduction: user.self_introduction,
      max_auto_call_sequence: user.max_auto_call_sequence || 3,
      has_api_key: !!user.gemini_api_key
    };
    
    return new Response(JSON.stringify(userInfo), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Get User Info');
    return new Response('으....이....', { status: 500 });
  }
}

// 사용자 설정 업데이트
async function handleUserUpdate(request, env) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    const { type, ...data } = await request.json();
    
    switch (type) {
      case 'password':
        const { current_password, new_password } = data;
        const isValidPassword = await verifyPassword(current_password, user.password_hash, user.salt);
        
        if (!isValidPassword) {
          return new Response('으....이....', { status: 400 });
        }
        
        const salt = generateSalt();
        const passwordHash = await hashPassword(new_password, salt);
        
        await env.DB.prepare(
          'UPDATE users SET password_hash = ?, salt = ? WHERE id = ?'
        ).bind(passwordHash, salt, user.id).run();
        break;
        
      case 'nickname':
        const { new_nickname } = data;
        await env.DB.prepare(
          'UPDATE users SET nickname = ? WHERE id = ?'
        ).bind(new_nickname, user.id).run();
        break;
        
      case 'api_key':
        const { api_key } = data;
        await env.DB.prepare(
          'UPDATE users SET gemini_api_key = ? WHERE id = ?'
        ).bind(api_key, user.id).run();
        break;
        
      case 'delete_api_key':
        await env.DB.prepare(
          'UPDATE users SET gemini_api_key = NULL WHERE id = ?'
        ).bind(user.id).run();
        break;
        
      case 'self_introduction':
        const { self_introduction } = data;
        await env.DB.prepare(
          'UPDATE users SET self_introduction = ? WHERE id = ?'
        ).bind(self_introduction, user.id).run();
        break;
        
      case 'max_auto_call_sequence':
        const { max_auto_call_sequence } = data;
        await env.DB.prepare(
          'UPDATE users SET max_auto_call_sequence = ? WHERE id = ?'
        ).bind(max_auto_call_sequence, user.id).run();
        break;
        
      default:
        return new Response('지원하지 않는 업데이트 유형입니다', { status: 400 });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Handle User Update');
    return new Response('으....이....', { status: 500 });
  }
}

// 대화 목록 조회 (즐겨찾기 포함)
async function handleConversations(request, env) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    const { results } = await env.DB.prepare(`
      SELECT c.id, c.title, c.created_at, c.is_favorite,
             GROUP_CONCAT(ch.profile_image) as participant_images
      FROM conversations c
      LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN characters ch ON cp.character_id = ch.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.is_favorite DESC, c.created_at DESC
    `).bind(user.id).all();
    
    // 참여자 이미지 처리
    const conversations = results.map(conv => ({
      ...conv,
      participant_images: conv.participant_images ? conv.participant_images.split(',') : []
    }));
    
    return new Response(JSON.stringify(conversations || []), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Handle Conversations');
    return new Response('으....이....', { status: 500 });
  }
}

// 즐겨찾기 토글 함수
async function toggleConversationFavorite(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화방 소유권 확인
    const conversation = await env.DB.prepare(
      'SELECT is_favorite FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    // 즐겨찾기 상태 토글
    const newFavoriteStatus = conversation.is_favorite ? 0 : 1;
    
    await env.DB.prepare(
      'UPDATE conversations SET is_favorite = ? WHERE id = ?'
    ).bind(newFavoriteStatus, conversationId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      is_favorite: newFavoriteStatus 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Toggle Conversation Favorite');
    return new Response('으....이....', { status: 500 });
  }
}

// 대화 제목 수정 함수
async function updateConversationTitle(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화방 소유권 확인
    const conversation = await env.DB.prepare(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    const { title } = await request.json();
    
    if (!title || title.trim().length === 0) {
      return new Response('제목이 필요합니다.', { status: 400 });
    }
    
    const trimmedTitle = title.trim().substring(0, 100); // 최대 100자
    
    await env.DB.prepare(
      'UPDATE conversations SET title = ? WHERE id = ?'
    ).bind(trimmedTitle, conversationId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      title: trimmedTitle 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Update Conversation Title');
    return new Response('으....이....', { status: 500 });
  }
}

// 작업 모드 업데이트 함수
async function updateWorkMode(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화방 소유권 확인
    const conversation = await env.DB.prepare(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    const { workMode } = await request.json();
    
    await env.DB.prepare(
      'UPDATE conversations SET work_mode = ? WHERE id = ?'
    ).bind(workMode ? 1 : 0, conversationId).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      work_mode: workMode ? 1 : 0 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Update Work Mode');
    return new Response('으....이....', { status: 500 });
  }
}

// 새 대화 생성
async function createConversation(request, env) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    const { title } = await request.json();
    const conversationTitle = title || `대화 ${Date.now()}`;
    
    const result = await env.DB.prepare(
      'INSERT INTO conversations (user_id, title) VALUES (?, ?) RETURNING id'
    ).bind(user.id, conversationTitle).first();
    
    return new Response(JSON.stringify({ 
      id: result.id,
      title: conversationTitle
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Create Conversation');
    return new Response('으....이....', { status: 500 });
  }
}

// 대화 메시지 조회 함수 (작업 모드, 시간정보, 상황프롬프트 정보 포함)
async function getConversationMessages(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화방 접근 권한 확인 및 설정 정보 조회
    const conversation = await env.DB.prepare(
      'SELECT work_mode, show_time_info, situation_prompt FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    const { results } = await env.DB.prepare(
      `SELECT m.id, m.role, m.content, m.message_type, m.auto_call_sequence,
              c.name as character_name, c.profile_image as character_image,
              f.filename
       FROM messages m
       LEFT JOIN characters c ON m.character_id = c.id
       LEFT JOIN files f ON m.file_id = f.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`
    ).bind(conversationId).all();
    
    return new Response(JSON.stringify({
      messages: results || [],
      work_mode: conversation.work_mode,
      show_time_info: conversation.show_time_info !== undefined ? conversation.show_time_info : 1,
      situation_prompt: conversation.situation_prompt || ''
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Get Conversation Messages');
    return new Response('으....이....', { status: 500 });
  }
}

// 대화 삭제
async function deleteConversation(request, env, conversationId) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 즐겨찾기 대화는 삭제 불가
    const conversation = await env.DB.prepare(
      'SELECT is_favorite FROM conversations WHERE id = ? AND user_id = ?'
    ).bind(conversationId, user.id).first();
    
    if (!conversation) {
      return new Response('으....이....', { status: 404 });
    }
    
    if (conversation.is_favorite) {
      return new Response('즐겨찾기 대화는 삭제할 수 없습니다.', { status: 400 });
    }
    
    // 트랜잭션으로 관련 데이터 모두 삭제
    await env.DB.prepare('DELETE FROM conversation_participants WHERE conversation_id = ?')
      .bind(conversationId).run();
    await env.DB.prepare('DELETE FROM messages WHERE conversation_id = ?')
      .bind(conversationId).run();
    await env.DB.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
      .bind(conversationId, user.id).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Delete Conversation');
    return new Response('으....이....', { status: 500 });
  }
}

// 공지사항 조회
async function getNotice(request, env) {
  try {
    const result = await env.DB.prepare(
      'SELECT content FROM notices WHERE id = 1'
    ).first();
    
    return new Response(JSON.stringify({ 
      notice: result?.content || '공지사항이 없습니다.' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Get Notice');
    return new Response('으....이....', { status: 500 });
  }
}

// 공지사항 업데이트
async function updateNotice(request, env) {
  try {
    const { password, content } = await request.json();
    
    if (password !== env.ADMIN_PASSWORD) {
      return new Response('으....이....', { status: 401 });
    }
    
    await env.DB.prepare(
      'INSERT OR REPLACE INTO notices (id, content) VALUES (1, ?)'
    ).bind(content).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Update Notice');
    return new Response('으....이....', { status: 500 });
  }
}

// 이미지 직접 업로드 함수
async function handleDirectUpload(request, env) {
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || !user.gemini_api_key) {
      return new Response('으....이....', { status: 403 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file');
    const conversationId = formData.get('conversationId');
    
    if (!file) {
      return new Response('파일이 필요합니다.', { status: 400 });
    }
    
    // 파일 검증
    if (!validateUploadFile(file)) {
      return new Response('지원하지 않는 파일 형식이거나 크기가 5MB를 초과합니다.', { status: 400 });
    }
    
    // 고유 파일명 생성
    const uniqueFileName = generateUniqueFileName(file.name);
    const r2Key = `image_uploads/${uniqueFileName}`;
    
    try {
      // R2에 파일 업로드
      await env.R2.put(r2Key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });
      
      // DB에 파일 정보 저장
      const fileResult = await env.DB.prepare(
        'INSERT INTO files (user_id, filename, original_name, file_size, mime_type, r2_key) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
      ).bind(user.id, uniqueFileName, file.name, file.size, file.type, r2Key).first();
      
      const fileId = fileResult.id;
      
      // 이미지 메시지 생성
      await env.DB.prepare(
        'INSERT INTO messages (conversation_id, role, content, message_type, file_id, user_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(conversationId, 'user', file.name, 'image', fileId, user.id).run();
      
      return new Response(JSON.stringify({
        success: true,
        fileId,
        imageUrl: `/api/images/${uniqueFileName}`,
        fileName: uniqueFileName
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (uploadError) {
      // R2 업로드 실패 시 정리
      await env.R2.delete(r2Key).catch(() => {});
      throw uploadError;
    }
  } catch (error) {
    await logError(error, env, 'Handle Direct Upload');
    return new Response('업로드 실패', { status: 500 });
  }
}

// 파일 검증 함수
function validateUploadFile(file) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  // 파일 타입 검증
  if (!allowedTypes.includes(file.type)) {
    return false;
  }
  
  // 파일 크기 검증
  if (!file.size || file.size > maxSize || file.size <= 0) {
    return false;
  }
  
  // 파일명 검증
  if (!file.name || file.name.length > 255) {
    return false;
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
  
  if (!ext || !allowedExts.includes(ext)) {
    return false;
  }
  
  return true;
}

// 고유 파일명 생성
function generateUniqueFileName(originalName) {
  const ext = originalName.split('.').pop();
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  return `${uuid}_${timestamp}.${ext}`;
}

// 이미지 서빙
async function serveImage(request, env, fileName) {
  try {
    const r2Key = `image_uploads/${fileName}`;
    const object = await env.R2.get(r2Key);
    
    if (!object) {
      return new Response('이미지를 찾을 수 없습니다.', { status: 404 });
    }
    
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐싱
    
    return new Response(object.body, { headers });
  } catch (error) {
    await logError(error, env, 'Serve Image');
    return new Response('이미지 로드 실패', { status: 500 });
  }
}

function getLandingPage() {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>세카이 채팅</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.10.5/font/bootstrap-icons.min.css" />
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            transition: background 0.3s ease, color 0.3s ease;
            color: #333;
        }
        .landing-card {
            background: white;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 90%;
            transition: background 0.3s ease, color 0.3s ease;
        }
        .logo {
            font-size: 3rem;
            color: #667eea;
            margin-bottom: 1rem;
            transition: color 0.3s ease;
        }
        .title {
            font-size: 2.5rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 1rem;
            transition: color 0.3s ease;
        }
        .description {
            color: #666;
            margin-bottom: 2rem;
            font-size: 1.1rem;
            line-height: 1.6;
            transition: color 0.3s ease;
        }
        .btn-custom {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            padding: 15px 30px;
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0 10px 10px 0;
            border-radius: 50px;
            transition: all 0.3s ease;
            color: white;
            text-decoration: none;
            display: inline-block;
        }
        .btn-custom:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            color: white;
            text-decoration: none;
        }
        .btn-outline-secondary {
            border: 2px solid #333;
            color: #333;
            background: transparent;
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: 500;
            border-radius: 50px;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        .btn-outline-secondary:hover {
            background-color: #333;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.3);
            text-decoration: none;
        }

        @media (max-width: 768px) {
            .landing-card {
                padding: 2rem;
            }
            .title {
                font-size: 2rem;
            }
        }

        /* 다크모드 지원 */
        @media (prefers-color-scheme: dark) {
            body {
                background: linear-gradient(135deg, #22272e 0%, #1c1f24 100%);
                color: #ddd;
            }
            .landing-card {
                background: #2c2f36;
                color: #ddd;
                box-shadow: 0 20px 40px rgba(0,0,0,0.7);
            }
            .logo {
                color: #87bfff;
            }
            .title {
                color: #e0e0e0;
            }
            .description {
                color: #bbb;
            }
            .btn-custom {
                background: linear-gradient(135deg, #4a90e2 0%, #336abd 100%);
                color: #eee;
            }
            .btn-custom:hover {
                background: linear-gradient(135deg, #3565b0 0%, #274a7a 100%);
                color: #fff;
                box-shadow: 0 10px 25px rgba(0,0,0,0.8);
            }
            .btn-outline-secondary {
                border-color: #ddd;
                color: #ddd;
            }
            .btn-outline-secondary:hover {
                background-color: #ddd;
                color: #222;
            }
        }
    </style>
</head>
<body>
    <div class="landing-card">
        <div class="logo">
            <i class="bi bi-chat-heart-fill"></i>
        </div>
        <h1 class="title">세카이 채팅</h1>
        <p class="description">
            Google Gemini 기반 다중 캐릭터 챗봇
        </p>

        <div>
            <a href="/login" class="btn-custom">
                <i class="bi bi-box-arrow-in-right"></i> 로그인
            </a>
            <a href="/register" class="btn-custom">
                <i class="bi bi-person-plus"></i> 회원가입
            </a>
        </div>

        <div class="mt-4">
            <a href="/about" class="btn-outline-secondary">
                <i class="bi bi-info-circle"></i> 사이트 정보
            </a>
        </div>
    </div>
</body>
</html>
  `;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
