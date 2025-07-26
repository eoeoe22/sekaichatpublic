import { logError } from './utils.js';
import { getCharacterPrompt, getCharacterIdByName } from './characters.js';
import { getConversationParticipants, updateConversationTitle } from './conversations.js';

// JWT 토큰에서 사용자 정보 추출
async function getUserFromToken(request, env) {
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

// 현재 서울 시간 반환
function getCurrentSeoulTime() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());
}

// 캐릭터 호출 시스템 안내
const CHARACTER_CALL_SYSTEM = `
[다른 캐릭터 호출]
기본 규칙:
• 다른 캐릭터를 호출하려면 @캐릭터명을 메시지 마지막에 적어주세요.
• 호출된 캐릭터가 바로 다음으로 응답합니다.
• 한번에 오직 한 명의 캐릭터만 호출 가능합니다
• 호출문은 반드시 메시지의 맨 마지막에 위치해야 합니다

올바른 예시:
   "카나데, 이 부분 어떻게 생각해? @요이사키 카나데"

잘못된 예시:
   "@요이사키 카나데, 이 부분 어떻게 생각해?"
   → 호출문이 메시지 맨 마지막에 있어야 합니다

잘못된 예시 2:
   "다들 이 부분 어떻게 생각하는지 말해줘. @요이사키 카나데 @아키야마 미즈키"
   → 여러명을 동시에 호출할 수 없습니다

현재 호출 가능한 대화 참여 캐릭터:
   {participantsList}
`;

export async function handleChat(request, env) {
  try {
    const { message, model, conversationId, imageData } = await request.json();
    
    // 사용자 인증 확인
    const user = await getUserFromToken(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화 제목 업데이트 (사용자 첫 메시지)
    await updateConversationTitle(conversationId, message, env);
    
    // 사용자 메시지 저장
    await saveChatMessage(conversationId, 'user', message, env, null, 0, user.id);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '메시지가 저장되었습니다. 캐릭터를 선택해주세요.' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError(error, env, 'Handle Chat');
    return new Response('으....이....', { status: 500 });
  }
}

// 특정 캐릭터로 메시지 생성
export async function handleCharacterGeneration(request, env) {
  try {
    const { characterId, conversationId, imageData, workMode, showTime, situationPrompt } = await request.json();
    
    // 사용자 인증 확인
    const user = await getUserFromToken(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 대화 기록 조회 (캐릭터 이름 포함)
    const history = await getChatHistoryWithCharacters(conversationId, env);
    
    // 캐릭터 프롬프트 조회
    const characterPrompt = await getCharacterPrompt(characterId, env);
    if (!characterPrompt) {
      return new Response('캐릭터를 찾을 수 없습니다.', { status: 404 });
    }
    
    // 현재 연속 호출 횟수 확인
    const currentAutoCallSequence = await getCurrentAutoCallSequence(conversationId, env);
    const maxAutoCallSequence = user.max_auto_call_sequence || 3;
    
    // 참여 캐릭터 목록 조회
    const participantsList = await getConversationParticipants(conversationId, env);
    
    // 모드별 프롬프트 선택 및 Gemini 예외처리
    let commonRulesPrompt = '';
    if (characterId !== 0) { // Gemini 예외처리
      if (workMode) {
        commonRulesPrompt = env.WORK_MODE_PROMPT;
      } else {
        commonRulesPrompt = env.COMMON_RULES_PROMPT;
      }
    }
    
    // 현재 시간 (시간 정보 토글에 따라)
    const currentTime = showTime ? getCurrentSeoulTime() : null;
    
    // 최신 이미지 조회
    let latestImageData = null;
    if (imageData) {
      latestImageData = imageData;
    } else {
      latestImageData = await getLatestImageFromHistory(conversationId, env);
    }
    
    // Gemini API 호출
    const apiKey = user.gemini_api_key || env.GEMINI_API_KEY;
    const response = await callGeminiAPI(
      characterPrompt,
      commonRulesPrompt,
      history,
      user.nickname,
      user.self_introduction,
      apiKey,
      currentTime,
      latestImageData,
      currentAutoCallSequence,
      maxAutoCallSequence,
      participantsList,
      situationPrompt
    );
    
    // 캐릭터 호출 파싱 및 처리
    const { cleanContent, calledCharacter } = parseCharacterCall(response);
    
    // 응답 메시지 저장
    await saveChatMessage(conversationId, 'assistant', cleanContent, env, characterId);
    
    // 자동 호출 확인
    let autoCallTriggered = false;
    if (calledCharacter && currentAutoCallSequence < maxAutoCallSequence) {
      const targetCharacterId = await getCharacterIdByName(calledCharacter, env);
      if (targetCharacterId && await isCharacterInConversation(conversationId, targetCharacterId, env)) {
        autoCallTriggered = true;
      }
    }
    
    return new Response(JSON.stringify({
      response: cleanContent,
      autoCallTriggered,
      calledCharacter
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    await logError(error, env, 'Character Generation');
    return new Response('으....이....', { status: 500 });
  }
}

// 자동 호출 처리
export async function handleAutoCall(request, env) {
  try {
    const { characterId, conversationId, sequence, workMode, showTime, situationPrompt } = await request.json();
    
    // 사용자 인증 확인
    const user = await getUserFromToken(request, env);
    if (!user) {
      return new Response('으....이....', { status: 401 });
    }
    
    // 최대 연속 호출 횟수 확인
    const maxAutoCallSequence = user.max_auto_call_sequence || 3;
    if (sequence > maxAutoCallSequence) {
      return new Response('최대 연속 호출 횟수를 초과했습니다.', { status: 400 });
    }
    
    // 대화 기록 조회
    const history = await getChatHistoryWithCharacters(conversationId, env);
    
    // 캐릭터 프롬프트 조회
    const characterPrompt = await getCharacterPrompt(characterId, env);
    if (!characterPrompt) {
      return new Response('캐릭터를 찾을 수 없습니다.', { status: 404 });
    }
    
    // 참여 캐릭터 목록 조회
    const participantsList = await getConversationParticipants(conversationId, env);
    
    // 모드별 프롬프트 선택
    let commonRulesPrompt = '';
    if (characterId !== 0) {
      if (workMode) {
        commonRulesPrompt = env.WORK_MODE_PROMPT;
      } else {
        commonRulesPrompt = env.COMMON_RULES_PROMPT;
      }
    }
    
    // 현재 시간 (시간 정보 토글에 따라)
    const currentTime = showTime ? getCurrentSeoulTime() : null;
    
    // 최신 이미지 조회
    const latestImageData = await getLatestImageFromHistory(conversationId, env);
    
    // Gemini API 호출
    const apiKey = user.gemini_api_key || env.GEMINI_API_KEY;
    const response = await callGeminiAPI(
      characterPrompt,
      commonRulesPrompt,
      history,
      user.nickname,
      user.self_introduction,
      apiKey,
      currentTime,
      latestImageData,
      sequence,
      maxAutoCallSequence,
      participantsList,
      situationPrompt
    );
    
    // 캐릭터 호출 파싱
    const { cleanContent, calledCharacter } = parseCharacterCall(response);
    
    // 응답 메시지 저장 (자동 호출 순서 포함)
    await saveChatMessage(conversationId, 'assistant', cleanContent, env, characterId, sequence);
    
    // 다음 자동 호출 확인
    let autoCallTriggered = false;
    if (calledCharacter && sequence < maxAutoCallSequence) {
      const targetCharacterId = await getCharacterIdByName(calledCharacter, env);
      if (targetCharacterId && await isCharacterInConversation(conversationId, targetCharacterId, env)) {
        autoCallTriggered = true;
      }
    }
    
    return new Response(JSON.stringify({
      response: cleanContent,
      autoCallTriggered,
      calledCharacter
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    await logError(error, env, 'Auto Call');
    return new Response('으....이....', { status: 500 });
  }
}

// 🔧 수정된 Gemini API 호출 - 시간정보 토글과 상황 프롬프트 추가
async function callGeminiAPI(characterPrompt, commonRulesPrompt, history, userNickname, userSelfIntro, apiKey, currentTime, imageData, autoCallSequence, maxAutoCallSequence, participantsList, situationPrompt) {
  try {
    // 시스템 프롬프트 구성
    let systemPrompt = characterPrompt;
    
    if (commonRulesPrompt) {
      systemPrompt += '\n\n' + commonRulesPrompt;
    }
    
    // 캐릭터 호출 시스템 추가
    if (participantsList && participantsList.length > 0) {
      const participantsText = participantsList.map(name => `   • ${name}`).join('\n');
      systemPrompt += '\n\n' + CHARACTER_CALL_SYSTEM.replace('{participantsList}', participantsText);
    }
    
    // 사용자 정보 추가
    if (userNickname) {
      systemPrompt += `\n\n[사용자 정보]\n사용자 닉네임: ${userNickname}`;
      if (userSelfIntro) {
        systemPrompt += `\n사용자 자기소개: ${userSelfIntro}`;
      }
    }
    
    // 🔧 수정: 시간 정보 토글에 따라 조건부 추가
    if (currentTime) {
      systemPrompt += `\n\n[현재 시간]\n${currentTime}`;
    }
    
    // 🔧 새로 추가: 상황 프롬프트
    if (situationPrompt && situationPrompt.trim()) {
      systemPrompt += `\n\n[상황 설정]\n${situationPrompt.trim()}`;
    }
    
    // 자동 호출 정보 추가
    if (autoCallSequence > 0) {
      systemPrompt += `\n\n[자동 호출 정보]\n현재 연속 호출 순서: ${autoCallSequence}/${maxAutoCallSequence}`;
    }
    
    // 대화 기록을 새로운 형식으로 추가
    if (history && history.length > 0) {
      systemPrompt += '\n\n[대화 기록]';
      const conversationHistory = history.map(msg => {
        if (msg.role === 'user') {
          return `${msg.nickname || '사용자'} : ${msg.content}`;
        } else if (msg.role === 'assistant') {
          return `${msg.character_name || '캐릭터'} : ${msg.content}`;
        }
        return null;
      }).filter(Boolean).join('\n-----\n');
      
      if (conversationHistory) {
        systemPrompt += '\n' + conversationHistory;
      }
    }
    
    // 메시지 구성 (시스템 프롬프트만 포함)
    const messages = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      }
    ];
    
    // 이미지 데이터가 있는 경우 마지막 메시지에 추가
    if (imageData && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      lastMessage.parts.push({
        inline_data: {
          mime_type: imageData.mimeType,
          data: imageData.base64Data
        }
      });
    }
    
    // Gemini API 호출
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Gemini API 응답이 비어있습니다.');
    }
    
  } catch (error) {
    console.error('Gemini API 호출 실패:', error);
    throw error;
  }
}

// 캐릭터 호출 파싱
function parseCharacterCall(content) {
  // @캐릭터명 패턴 찾기 (메시지 끝에서)
  const callPattern = /@([^\s@]+(?:\s+[^\s@]+)*)\s*$/;
  const match = content.match(callPattern);
  
  if (match) {
    const calledCharacter = match[1].trim();
    const cleanContent = content.replace(callPattern, '').trim();
    return { cleanContent, calledCharacter };
  }
  
  return { cleanContent: content, calledCharacter: null };
}

// 🔧 수정된 채팅 메시지 저장 - user_id 파라미터 추가
async function saveChatMessage(conversationId, role, content, env, characterId = null, autoCallSequence = 0, userId = null) {
  try {
    await env.DB.prepare(
      'INSERT INTO messages (conversation_id, role, content, character_id, auto_call_sequence, user_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(conversationId, role, content, characterId, autoCallSequence, userId).run();
  } catch (error) {
    await logError(error, env, 'Save Chat Message');
    throw error;
  }
}

// 대화 기록 조회 (캐릭터 이름 포함)
async function getChatHistoryWithCharacters(conversationId, env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT m.role, m.content, m.auto_call_sequence, c.name as character_name, 
              CASE WHEN m.role = 'user' THEN u.nickname ELSE NULL END as nickname
       FROM messages m
       LEFT JOIN characters c ON m.character_id = c.id
       LEFT JOIN conversations conv ON m.conversation_id = conv.id
       LEFT JOIN users u ON conv.user_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC
       LIMIT 50`
    ).bind(conversationId).all();
    
    return results || [];
  } catch (error) {
    await logError(error, env, 'Get Chat History');
    return [];
  }
}

// 현재 자동 호출 순서 확인
async function getCurrentAutoCallSequence(conversationId, env) {
  try {
    const result = await env.DB.prepare(
      'SELECT COALESCE(MAX(auto_call_sequence), 0) as max_sequence FROM messages WHERE conversation_id = ?'
    ).bind(conversationId).first();
    
    return result?.max_sequence || 0;
  } catch (error) {
    return 0;
  }
}

// 캐릭터가 대화에 참여 중인지 확인
async function isCharacterInConversation(conversationId, characterId, env) {
  try {
    const result = await env.DB.prepare(
      'SELECT id FROM conversation_participants WHERE conversation_id = ? AND character_id = ?'
    ).bind(conversationId, characterId).first();
    
    return !!result;
  } catch (error) {
    return false;
  }
}

// 최신 이미지 데이터 조회
async function getLatestImageFromHistory(conversationId, env) {
  try {
    const result = await env.DB.prepare(
      `SELECT f.filename, f.mime_type FROM messages m
       JOIN files f ON m.file_id = f.id
       WHERE m.conversation_id = ? AND m.message_type = 'image'
       ORDER BY m.created_at DESC
       LIMIT 1`
    ).bind(conversationId).first();
    
    if (!result) return null;
    
    // R2에서 이미지 데이터 조회
    const object = await env.R2.get(`image_uploads/${result.filename}`);
    if (!object) return null;
    
    const arrayBuffer = await object.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    return {
      base64Data,
      mimeType: result.mime_type,
      fileName: result.filename
    };
  } catch (error) {
    await logError(error, env, 'Get Latest Image');
    return null;
  }
}
