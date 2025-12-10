// config.js

// ------------------- 전역 변수 및 상수 -------------------

// 💡 새로운 상수 추가: 치트 권한을 가진 개발자 이름
const DEVELOPER_USERNAME = "sk"; 

// 게임 변수
let isPlaying = false;
let isPaused = false;
let gameLoop = null;
let waveTimer = null;
let currentUsername = null; 
let globalStats = null; // 로그인 전에는 null
let bossProjectiles = [];
let isInvincible = false; // 무적 모드 상태

// 보스 관련 변수
let isBossWave = false; 
let bossMonster = null; 
let bossSpawned = false; 

// 챕터 및 난이도 설정
const CHAPTER_GOALS = [
    { chapter: 1, requiredKills: 50, monsterClass: 'monster-chap-1' }, // 킬수 50
    { chapter: 2, requiredKills: 50, monsterClass: 'monster-chap-2' }, // 킬수 50
    { chapter: 3, requiredKills: 60, monsterClass: 'monster-chap-3' }, // 킬수 60
    { chapter: 4, requiredKills: 70, monsterClass: 'monster-chap-4' }, // 킬수 70
    { chapter: 5, requiredKills: 80, monsterClass: 'monster-chap-5' }  // 킬수 80
];
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5분 세션 유지

// 기본 영구 스탯
const DEFAULT_GLOBAL_STATS = {
    totalCoins: 0,
    baseMaxHp: 100,
    baseDamage: 10,
    baseSpeed: 3,
    baseAttackDelay: 50,
    baseMagnetRange: 50,
    currentChapter: 1,
    baseProjectileSpeed: 5, 
    coinMultiplier: 1.0, 
    baseHealAmount: 0, // 💡 신규 스탯: 기본 회복량 (0)
};

// 무기 데이터
const WEAPONS = [
    { name: "활 (Bow)", emoji: "🏹", damageMultiplier: 1.0, speed: 5, delay: 50 },
    { name: "파이어볼 (Fire)", emoji: "🔥", damageMultiplier: 1.5, speed: 4, delay: 60, effect: 'fire' },
    { name: "쌍검 (Dual Blades)", emoji: "⚔️", damageMultiplier: 0.8, speed: 7, delay: 30 }
];

// 💡 공격 딜레이 항목 수정: MaxLevel 20으로 재설정 및 next 로직 보강
const UPGRADES = [
    // 1. HP (Max Level 99)
    { key: 'baseMaxHp', name: 'HP 갑옷', cost: 10, effect: '+30 시작 HP', next: (v) => v + 30, current: () => globalStats.baseMaxHp, base: 100, increase: 30, maxLevel: 99 },
    // 2. 데미지 (Max Level 99)
    { key: 'baseDamage', name: '강철 검', cost: 15, effect: '+7 시작 공격력', next: (v) => v + 7, current: () => globalStats.baseDamage, base: 10, increase: 7, maxLevel: 99 },
    // 3. 이동 속도 (Max Level 99)
    { key: 'baseSpeed', name: '부츠', cost: 10, effect: '+0.5 시작 이동 속도', next: (v) => v + 0.5, current: () => globalStats.baseSpeed, base: 3, increase: 0.5, maxLevel: 99 },
    // 4. 공격 딜레이 (Max Level 20으로 재설정, 최소 10 보장)
    { key: 'baseAttackDelay', name: '가벼운 손목', cost: 20, effect: '공격 딜레이 -5 (최소 10)', next: (v) => Math.max(10, v - 5), current: () => globalStats.baseAttackDelay, base: 50, increase: 5, maxLevel: 20 },
    // 5. 투사체 속도 (Max Level 99)
    { key: 'baseProjectileSpeed', name: '강화 투사체', cost: 15, effect: '투사체 속도 +1.5', next: (v) => v + 1.5, current: () => globalStats.baseProjectileSpeed, base: 5, increase: 1.5, maxLevel: 99 },
    // 6. 코인 배율 (Max Level 99)
    { key: 'coinMultiplier', name: '행운의 코인', cost: 25, effect: '획득 코인 배율 +0.15', next: (v) => v + 0.15, current: () => globalStats.coinMultiplier, base: 1.0, increase: 0.15, maxLevel: 99 },
    
    // 7. 자석 범위 (Max Level 99)
    { key: 'baseMagnetRange', name: '자석 링', cost: 8, effect: '기본 자석 범위 +25', next: (v) => v + 25, current: () => globalStats.baseMagnetRange, base: 50, increase: 25, maxLevel: 99 },
    
    // 8. 시작 챕터 (Max Level 5 유지 - 난이도 조절용)
    { key: 'currentChapter', name: '숙련된 시작', cost: 50, effect: '시작 챕터 +1', next: (v) => v + 1, current: () => globalStats.currentChapter, base: 1, increase: 1, maxLevel: 5 },
    
    // 9. 회복량 증가 (Max Level 99)
    { key: 'baseHealAmount', name: '생명력 강화', cost: 30, effect: '회복 팩 효율 +5', next: (v) => (v || 0) + 5, current: () => globalStats.baseHealAmount || 0, base: 0, increase: 5, maxLevel: 99 } 
];

// 게임 상태 변수 (Game.js에서 사용)
let player = {
    x: 250, y: 250, size: 30, hp: 100, maxHp: 100, xp: 0, nextXp: 100, level: 1, kills: 0,
    moveSpeed: 3,
    currentWeapon: WEAPONS[0], 
    attackDamage: 10,
    attackDelay: 50, 
    attackTimer: 0,
    projectileSpeed: 5,
    magnetRange: 50,
    coins: 0,
    // 💡 새로운 스탯 추가: 회복량 
    healAmount: 0 
};

let monsters = [];
let projectiles = [];
let items = []; 
let wave = 1;
let chapter = 1; 
let chapterKillGoal = CHAPTER_GOALS[0].requiredKills; 
const waveDuration = 15000; 
const keys = {}; // ✨ 키 상태를 저장할 전역 객체

// ------------------- DOM 요소 참조 (모든 파일에서 사용) -------------------
const $ = (id) => document.getElementById(id);

// DOM 객체를 초기에는 빈 객체로 정의하고, DOMContentLoaded 이후에 initializeDOM에서 채움
const DOM = {};

function initializeDOM() {
    DOM.loginOverlay = $('login-overlay');
    DOM.usernameInput = $('username-input');
    DOM.passwordInput = $('password-input'); // 💡 비밀번호 입력란 DOM 추가
    DOM.loginButton = $('login-button');
    DOM.logoutButton = $('logout-button');
    DOM.registerButton = $('register-button'); // 💡 회원가입 버튼 DOM 추가
    DOM.playerNameDisplay = $('player-name-display');
    DOM.loginStatusMessage = $('login-status-message');
    
    DOM.gameArea = $('game-area');
    DOM.character = $('character');
    DOM.startButton = $('start-button');
    DOM.stopButton = $('stop-button');
    DOM.shopButton = $('shop-button');
    
    // 💡 치트 버튼 및 오버레이 DOM 추가
    DOM.cheatButton = $('cheat-button');
    DOM.cheatOverlay = $('cheat-overlay');
    DOM.cheatOptionsDiv = $('cheat-options');
    DOM.cheatLevelUpButton = $('cheat-level-up');
    DOM.cheatMaxCoinsButton = $('cheat-max-coins');
    DOM.cheatToggleInvincibleButton = $('cheat-toggle-invincible');
    DOM.cheatWinChapterButton = $('cheat-win-chapter');
    DOM.cheatCloseButton = $('cheat-close-button');
    
    DOM.skillOverlay = $('skill-overlay');
    DOM.skillOptionsDiv = $('skill-options');
    
    // gameoverOverlay 내의 요소
    DOM.gameoverOverlay = $('gameover-overlay');
    DOM.restartButton = $('restart-button');
    
    DOM.chapterClearOverlay = $('chapter-clear-overlay');
    DOM.chapterClearMessage = $('chapter-clear-message');
    DOM.nextChapterButton = $('next-chapter-button');

    DOM.hpBar = $('hp-bar');
    DOM.xpBar = $('xp-bar');
    DOM.levelDisplay = $('level-display');
    DOM.scoreDisplay = $('score-display');
    DOM.waveDisplay = $('wave-display');
    DOM.chapterDisplay = $('chapter-display');
    DOM.weaponDisplay = $('weapon-display');
    DOM.coinDisplay = $('coin-display');
    DOM.currentCoinDisplay = $('current-coin-display');
    DOM.shopOptionsDiv = $('shop-options');
    
    DOM.statDmg = $('stat-dmg');
    DOM.statSpeed = $('stat-speed');
    DOM.statAttSpd = $('stat-att-spd');
    DOM.statMagnet = $('stat-magnet');
    DOM.statHp = $('stat-hp');
    DOM.statProjSpeed = $('stat-proj-speed');
}