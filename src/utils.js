export function generateSalt() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  return crypto.subtle.digest('SHA-256', data)
    .then(buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join(''));
}

export function verifyPassword(password, hash, salt) {
  return hashPassword(password, salt).then(newHash => newHash === hash);
}

// 에러 로그 기록 함수 (Workers 로그만 사용)
export async function logError(error, env, context = '') {
  const timestamp = new Date().toISOString();
  
  // Workers 로그에 출력
  console.error('=== 에러 로그 ===');
  console.error(`시간: ${timestamp}`);
  console.error(`컨텍스트: ${context}`);
  console.error(`메시지: ${error.message}`);
  console.error(`스택 트레이스: ${error.stack}`);
  console.error('================');
}

// 일반 디버그 로그 함수 (Workers 로그만 사용)
export function logDebug(message, context = '', data = null) {
  console.log(`[DEBUG] ${context}: ${message}`, data || '');
}
