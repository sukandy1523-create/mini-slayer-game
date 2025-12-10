// login.js

// 💡 사용자 계정 데이터베이스 (로컬 스토리지에 저장됨)
let userAccounts = {}; 
const ACCOUNTS_KEY = 'miniSlayerAccounts';
// 💡 아이디 유효성 검사 정규식: 한글, 영어 대소문자, 숫자만 허용
const USERNAME_REGEX = /^[a-zA-Z0-9가-힣]+$/; 

// ------------------- 사용자/세션 관리 함수 -------------------

function loadUserAccounts() {
    const storedAccounts = localStorage.getItem(ACCOUNTS_KEY);
    userAccounts = storedAccounts ? JSON.parse(storedAccounts) : {};
}

function saveUserAccounts() {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(userAccounts));
}

function loadUserStats(username) {
    const statsKey = `miniSlayerStats_${username}`;
    let loadedStats = JSON.parse(localStorage.getItem(statsKey));

    let statsChanged = false;
    
    // 로드된 스탯이 없으면 기본 스탯 사용
    loadedStats = loadedStats || {};
    
    // ✨ NaN 또는 undefined 값을 DEFAULT_GLOBAL_STATS의 값으로 강제 초기화
    for (const key in DEFAULT_GLOBAL_STATS) {
        const defaultValue = DEFAULT_GLOBAL_STATS[key];
        const loadedValue = loadedStats[key];
        
        if (loadedValue === undefined || (typeof defaultValue === 'number' && isNaN(loadedValue)) || (loadedValue === null && typeof defaultValue === 'number')) {
             loadedStats[key] = defaultValue;
             statsChanged = true;
        }
    }
    
    // 새 사용자거나 스탯이 변경되었으면 기본 스탯 저장
    if (statsChanged || !localStorage.getItem(statsKey)) {
        localStorage.setItem(statsKey, JSON.stringify(loadedStats));
    }
    
    globalStats = loadedStats;
}

function saveUserStats() {
    if (!currentUsername || !globalStats) return;
    const statsKey = `miniSlayerStats_${currentUsername}`;
    localStorage.setItem(statsKey, JSON.stringify(globalStats));
    
    setSessionTimeout(); 
}

function setSessionTimeout() {
    const timeoutTime = Date.now() + SESSION_TIMEOUT_MS;
    sessionStorage.setItem('sessionTimeout', timeoutTime);
    sessionStorage.setItem('currentUsername', currentUsername);
}

function checkSession() {
    // 💡 페이지 로드 시 계정 데이터 먼저 로드
    loadUserAccounts(); 
    
    const storedUsername = sessionStorage.getItem('currentUsername');
    const timeoutTime = sessionStorage.getItem('sessionTimeout');
    
    if (storedUsername && timeoutTime && Date.now() < parseInt(timeoutTime)) {
        currentUsername = storedUsername;
        loginSuccess();
    } else {
        logout(true); 
    }
}

// ------------------- 핵심 인증 로직 -------------------

function authenticateLogin() {
    const username = DOM.usernameInput.value.trim();
    const password = DOM.passwordInput.value.trim();
    
    if (username.length < 2 || password.length < 4) {
        DOM.loginStatusMessage.textContent = '아이디는 2자 이상, 비밀번호는 4자 이상이어야 합니다.';
        return;
    }

    loadUserAccounts(); // 최신 계정 정보를 다시 로드
    
    if (userAccounts[username] && userAccounts[username].password === password) {
        currentUsername = username;
        setSessionTimeout();
        DOM.loginStatusMessage.textContent = '로그인 성공!';
        // 💡 비밀번호 입력 필드 초기화
        DOM.passwordInput.value = '';
        loginSuccess();
    } else {
        DOM.loginStatusMessage.textContent = '로그인 실패: 아이디가 없거나 비밀번호가 틀렸습니다.';
    }
}

function registerUser() {
    const username = DOM.usernameInput.value.trim();
    const password = DOM.passwordInput.value.trim();
    
    if (username.length < 2) {
        DOM.loginStatusMessage.textContent = '아이디는 2자 이상이어야 합니다.';
        return;
    }
    if (password.length < 4) {
        DOM.loginStatusMessage.textContent = '비밀번호는 4자 이상이어야 합니다.';
        return;
    }
    
    // 💡 아이디 유효성 검사 (한글, 영어, 숫자만 허용)
    if (!USERNAME_REGEX.test(username)) {
        DOM.loginStatusMessage.textContent = '아이디는 한글, 영어, 숫자만 사용할 수 있습니다.';
        return;
    }

    loadUserAccounts(); // 최신 계정 정보를 다시 로드
    
    if (userAccounts[username]) {
        // 💡 중복 아이디 오류 메시지
        DOM.loginStatusMessage.textContent = `회원가입 실패: "${username}" 아이디는 이미 존재합니다.`;
        return;
    }
    
    // 💡 새 사용자 등록
    userAccounts[username] = { password: password };
    saveUserAccounts();
    
    DOM.loginStatusMessage.textContent = `회원가입 성공! 이제 로그인해주세요.`;
    // 회원가입 후 즉시 로그인 시도 (인증 성공 시 loginSuccess로 이동)
    authenticateLogin();
}

// ------------------- UI 및 게임 연동 로직 -------------------

function loginSuccess() {
    DOM.loginOverlay.style.display = 'none';
    DOM.playerNameDisplay.textContent = `슬레이어: ${currentUsername}`;
    
    // 💡 치트 버튼 표시
    if (currentUsername === DEVELOPER_USERNAME) {
        DOM.cheatButton.style.display = 'block';
    } else {
        DOM.cheatButton.style.display = 'none';
    }
    
    DOM.gameoverOverlay.style.display = 'none';
    DOM.skillOverlay.style.display = 'none';
    DOM.chapterClearOverlay.style.display = 'none';
    DOM.cheatOverlay.style.display = 'none';
    
    // 버튼 활성화
    DOM.startButton.disabled = false;
    DOM.shopButton.disabled = false;
    DOM.logoutButton.disabled = false;

    // 사용자 스탯 로드 후 게임 초기화 준비
    loadUserStats(currentUsername);
    initializeGame(globalStats.currentChapter); 
}

function logout(isInitialCheck = false) {
    // 세션 정보 삭제
    sessionStorage.removeItem('sessionTimeout');
    sessionStorage.removeItem('currentUsername');
    currentUsername = null;
    globalStats = null;
    isInvincible = false;

    // 모든 게임 UI 비활성화
    DOM.playerNameDisplay.textContent = `[로그인 필요]`;
    DOM.startButton.disabled = true;
    DOM.shopButton.disabled = true;
    DOM.logoutButton.disabled = true;
    DOM.stopButton.disabled = true;
    
    // 모든 게임 오버레이 숨기기
    DOM.skillOverlay.style.display = 'none';
    DOM.gameoverOverlay.style.display = 'none';
    DOM.chapterClearOverlay.style.display = 'none';
    DOM.cheatOverlay.style.display = 'none';

    // 로그인 화면 표시 및 입력 필드 초기화
    if (!isInitialCheck) {
        DOM.loginStatusMessage.textContent = '로그아웃되었습니다. 다시 로그인해주세요.';
    } else {
        DOM.loginStatusMessage.textContent = '로그인 또는 회원가입을 해주세요.';
    }
    
    DOM.usernameInput.value = '';
    DOM.passwordInput.value = '';
    
    DOM.loginOverlay.style.zIndex = '99999';
    DOM.loginOverlay.style.display = 'flex'; 
}


// ------------------- DOMContentLoaded 이벤트 리스너 -------------------
document.addEventListener('DOMContentLoaded', () => {
    initializeDOM(); 
    
    // 💡 로그인 및 회원가입 버튼 리스너 연결
    DOM.loginButton.addEventListener('click', authenticateLogin);
    DOM.registerButton.addEventListener('click', registerUser);
    
    // 엔터 키로 로그인 시도 (비밀번호 입력 필드에서)
    DOM.passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            authenticateLogin();
        }
    });
    
    DOM.logoutButton.addEventListener('click', () => {
        if (currentUsername && (isPlaying || isPaused)) {
            saveUserStats(); // 로그아웃 전 현재 스탯 저장
        }
        stopGame(); // 게임 정지 (Game.js에 정의됨)
        logout();
    });
    
    checkSession();
});