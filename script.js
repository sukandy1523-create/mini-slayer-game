document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.getElementById('game-area');
    const character = document.getElementById('character');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const skillOverlay = document.getElementById('skill-overlay');
    const skillOptionsDiv = document.getElementById('skill-options');
    const gameoverOverlay = document.getElementById('gameover-overlay');
    const restartButton = document.getElementById('restart-button');
    
    // 챕터 클리어 오버레이 관련 DOM 참조
    const chapterClearOverlay = document.getElementById('chapter-clear-overlay');
    const chapterClearMessage = document.getElementById('chapter-clear-message');
    const nextChapterButton = document.getElementById('next-chapter-button');

    const hpBar = document.getElementById('hp-bar');
    const xpBar = document.getElementById('xp-bar');
    const levelDisplay = document.getElementById('level-display');
    const scoreDisplay = document.getElementById('score-display');
    const waveDisplay = document.getElementById('wave-display');
    const chapterDisplay = document.getElementById('chapter-display');
    const weaponDisplay = document.getElementById('weapon-display');
    const coinDisplay = document.getElementById('coin-display');
    const currentCoinDisplay = document.getElementById('current-coin-display');
    const shopOptionsDiv = document.getElementById('shop-options');
    const shopButton = document.getElementById('shop-button');

    // 상세 스탯 DOM 참조
    const statDmg = document.getElementById('stat-dmg');
    const statSpeed = document.getElementById('stat-speed');
    const statAttSpd = document.getElementById('stat-att-spd');
    const statMagnet = document.getElementById('stat-magnet');
    const statHp = document.getElementById('stat-hp');
    const statProjSpeed = document.getElementById('stat-proj-speed'); // 투사체 속도 stat ID 추가

    let isPlaying = false;
    let isPaused = false;
    let gameLoop;
    let waveTimer;

    // 챕터 클리어 목표 킬 수 정의
    const CHAPTER_GOALS = [
        { chapter: 1, requiredKills: 50 },
        { chapter: 2, requiredKills: 150 },
        { chapter: 3, requiredKills: 300 },
        { chapter: 4, requiredKills: 500 },
        { chapter: 5, requiredKills: 800 } 
    ];

    // 영구 스탯 저장 (localStorage 사용)
    let globalStats = JSON.parse(localStorage.getItem('miniSlayerStats')) || {
        totalCoins: 0,
        baseMaxHp: 100,
        baseDamage: 10,
        baseSpeed: 3,
        // 기존 영구 스탯
        baseAttackDelay: 50,
        baseMagnetRange: 50,
        currentChapter: 1,
        // ✨ 신규 영구 스탯
        baseProjectileSpeed: 5, // 투사체 속도 기본값
        coinMultiplier: 1.0,    // 코인 획득 배율
    };
    
    // ✨ 로컬 스토리지에 없는 새 스탯이 있을 경우 초기화
    // 이 부분은 사용자가 로컬 스토리지를 직접 지우지 못했을 때 초기화를 시도하는 안전장치입니다.
    const defaultStats = {
        totalCoins: 0,
        baseMaxHp: 100,
        baseDamage: 10,
        baseSpeed: 3,
        baseAttackDelay: 50,
        baseMagnetRange: 50,
        currentChapter: 1,
        baseProjectileSpeed: 5, 
        coinMultiplier: 1.0, 
    };
    
    let statsChanged = false;
    for (const key in defaultStats) {
        if (globalStats[key] === undefined || isNaN(globalStats[key])) {
            globalStats[key] = defaultStats[key];
            statsChanged = true;
        }
    }
    if (statsChanged) {
        localStorage.setItem('miniSlayerStats', JSON.stringify(globalStats));
    }


    const WEAPONS = [
        { name: "활 (Bow)", emoji: "🏹", damageMultiplier: 1.0, speed: 5, delay: 50 },
        { name: "파이어볼 (Fire)", emoji: "🔥", damageMultiplier: 1.5, speed: 4, delay: 60, effect: 'fire' },
        { name: "쌍검 (Dual Blades)", emoji: "⚔️", damageMultiplier: 0.8, speed: 7, delay: 30 }
    ];

    // 게임 상태 변수
    let player = {
        x: 250, y: 250, size: 30, hp: 100, maxHp: 100, xp: 0, nextXp: 100, level: 1, kills: 0,
        moveSpeed: 3,
        currentWeapon: WEAPONS[0], 
        attackDamage: 10,
        attackDelay: 50, 
        attackTimer: 0,
        projectileSpeed: 5,
        magnetRange: 50,
        coins: 0 
    };

    let monsters = [];
    let projectiles = [];
    let items = []; 
    let wave = 1;
    let chapter = 1; 
    let chapterKillGoal = CHAPTER_GOALS[0].requiredKills; // 현재 챕터 목표 킬 수
    let waveDuration = 15000; 
    
    // 키 입력 상태
    const keys = {};
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        
        // 스페이스바 일시정지/시작 로직
        if (e.key === ' ' && isPlaying) {
            e.preventDefault(); 
            if (isPaused) {
                startGame(); 
            } else {
                stopGame(); 
            }
        }
    });
    document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // ------------------- 게임 제어 및 초기화 -------------------

    function getChapterGoal(chap) {
        const goal = CHAPTER_GOALS.find(g => g.chapter === chap);
        if (goal) return goal.requiredKills;
        // 최대 챕터 이후는 기본 증가량 계산
        return CHAPTER_GOALS[CHAPTER_GOALS.length - 1].requiredKills + (chap - CHAPTER_GOALS.length) * 300;
    }

    function applyGlobalStats(startChapter = 1) { // 시작 챕터 인자 추가
        // 게임 시작 시 영구 스탯 적용
        player.maxHp = globalStats.baseMaxHp;
        player.hp = globalStats.baseMaxHp;
        player.attackDamage = globalStats.baseDamage;
        player.moveSpeed = globalStats.baseSpeed;
        player.attackDelay = globalStats.baseAttackDelay; 
        player.magnetRange = globalStats.baseMagnetRange; 
        player.projectileSpeed = globalStats.baseProjectileSpeed; // ✨ 투사체 속도 적용
        player.coinMultiplier = globalStats.coinMultiplier; // ✨ 코인 배율 적용
        
        // 게임 시작 챕터 설정 (죽은 챕터부터 시작)
        chapter = startChapter; 
        chapterKillGoal = getChapterGoal(chapter);
    }

    function initializeGame(startChapter = 1) { // 챕터 유지 로직 적용을 위해 인자 추가
        // 상태 초기화
        player = {
            x: gameArea.clientWidth / 2, y: gameArea.clientHeight / 2, size: 30, hp: 100, maxHp: 100, xp: 0, nextXp: 100, level: 1, kills: 0,
            moveSpeed: 3, currentWeapon: WEAPONS[0], attackDamage: 10, attackDelay: 50, attackTimer: 0, projectileSpeed: 5, magnetRange: 50,
            coins: 0
        };
        monsters = [];
        projectiles = [];
        items = []; 
        wave = 1;
        
        applyGlobalStats(startChapter); // 영구 스탯 및 시작 챕터 적용

        clearInterval(gameLoop);
        clearInterval(waveTimer);
        gameLoop = null;
        
        updateUI(); 
        gameArea.querySelectorAll('.monster, .projectile, .item').forEach(e => e.remove()); 
        gameoverOverlay.style.display = 'none';
        skillOverlay.style.display = 'none';
        chapterClearOverlay.style.display = 'none'; 
        startButton.disabled = false;
        stopButton.disabled = true;
        
        character.style.left = `${player.x - player.size / 2}px`;
        character.style.top = `${player.y - player.size / 2}px`;

        isPlaying = false;
        isPaused = false;
    }

    function startGame() {
        // 이미 실행 중이거나 일시정지 상태가 아닐 때만 시작
        if (isPlaying && !isPaused) return;

        isPlaying = true;
        isPaused = false;
        startButton.disabled = true;
        stopButton.disabled = false;
        
        if (!gameLoop) {
            gameLoop = setInterval(updateGame, 16); 
            startWaveTimer();
        }
    }

    function stopGame() {
        if (!isPlaying && !isPaused) return;
        
        isPaused = true;
        startButton.disabled = false;
        stopButton.disabled = true;
        clearInterval(gameLoop);
        gameLoop = null;
        clearInterval(waveTimer);
    }

    function endGame() {
        isPlaying = false;
        stopGame();
        
        // 죽은 챕터를 영구 스탯에 저장
        globalStats.currentChapter = chapter;
        localStorage.setItem('miniSlayerStats', JSON.stringify(globalStats));

        const finalMessage = document.getElementById('final-message');
        const finalScoreDisplay = document.getElementById('final-score');
        
        finalMessage.textContent = `게임 오버! (레벨 ${player.level} / 챕터 ${chapter})`; 
        finalScoreDisplay.textContent = `획득 코인: ${player.coins}`;
        
        renderShop(); 
        
        // 재시작 버튼이 죽은 챕터부터 시작하도록 안내
        restartButton.textContent = `챕터 ${chapter} 부터 다시 시작`; 
        gameoverOverlay.style.display = 'flex'; 
    }

    function showShopOnly() {
        stopGame(); // 게임이 실행 중이면 정지

        const finalMessage = document.getElementById('final-message');
        const finalScoreDisplay = document.getElementById('final-score');

        finalMessage.textContent = `🛡️ 영구 업그레이드 상점`;
        finalScoreDisplay.textContent = ``; 
        
        renderShop();
        
        // 상점만 열 때: 버튼 텍스트를 '게임으로 돌아가기'로 설정
        restartButton.textContent = '게임으로 돌아가기'; 
        gameoverOverlay.style.display = 'flex';
    }
    
    function startWaveTimer() {
        clearInterval(waveTimer);
        // 웨이브는 시간 경과에 따른 단순 카운터로 유지
        waveTimer = setInterval(() => {
            wave++;
            waveDisplay.textContent = `웨이브: ${wave}`;
        }, waveDuration);
    }

    // 챕터 클리어 로직
    function checkChapterClear() {
        if (player.kills >= chapterKillGoal) {
            
            stopGame(); // 챕터 클리어 시 게임 일시 정지

            // 클리어한 챕터를 영구 스탯에 저장 (다음 시작을 위해)
            const nextChapter = chapter + 1;
            globalStats.currentChapter = nextChapter;
            localStorage.setItem('miniSlayerStats', JSON.stringify(globalStats));

            // 챕터 클리어 메시지 표시
            chapterClearMessage.textContent = `🎉 챕터 ${chapter} 클리어! 🎉`;
            nextChapterButton.textContent = `챕터 ${nextChapter} 로 이동 (계속)`;
            chapterClearOverlay.style.display = 'flex';
        }
    }

    // 화면에 남아있는 모든 아이템을 즉시 흡수
    function collectAllItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            
            if (item.type === 'hp_pack') {
                player.hp = Math.min(player.maxHp, player.hp + item.value);
            } else if (item.type === 'coin') {
                // 코인 획득 시 코인 배율 적용
                const coinAmount = Math.round(item.value * player.coinMultiplier);
                player.coins += coinAmount;
                
                // 코인 획득 시 영구 스탯에 합산하고 저장 (실시간 반영)
                globalStats.totalCoins += coinAmount;
                localStorage.setItem('miniSlayerStats', JSON.stringify(globalStats));
            }
            
            // DOM에서 아이템 제거
            const itemEl = gameArea.querySelector(`.item[data-id="${item.id}"]`);
            if (itemEl) itemEl.remove();
            
            items.splice(i, 1);
        }
        updateUI();
    }
    
    // 다음 챕터로 진행
    function advanceToNextChapter() {
        chapterClearOverlay.style.display = 'none';

        // 챕터 이동 전에 모든 아이템을 흡수
        collectAllItems();

        // 몬스터, 투사체 잔여물 제거
        monsters.forEach(m => {
            const monEl = gameArea.querySelector(`.monster[data-id="${m.id}"]`);
            if (monEl) monEl.remove();
        });
        projectiles.forEach(p => p.element.remove());

        monsters = [];
        projectiles = [];
        wave = 1; // 웨이브 초기화

        // 다음 챕터로 증가 및 목표 설정
        chapter++;
        chapterKillGoal = getChapterGoal(chapter);
        
        // UI 업데이트 및 게임 재개
        updateUI();
        startGame();
    }
    
    // ------------------- 게임 루프 -------------------

    function updateGame() {
        if (isPaused || !isPlaying) return;

        handleMovement(); 
        spawnMonsters(); 
        updateProjectiles();
        updateMonsters();
        updateItems(); 
        checkCollisions();
        handleAutoAttack();
        updateUI();

        if (player.hp <= 0) {
            endGame();
        }
    }

    // ------------------- 입력 처리 및 이동 (WASD 전용) -------------------
    function handleMovement() {
        if (keys['w']) player.y -= player.moveSpeed;
        if (keys['s']) player.y += player.moveSpeed;
        if (keys['a']) player.x -= player.moveSpeed;
        if (keys['d']) player.x += player.moveSpeed;
        
        // 경계 제한
        player.x = Math.max(player.size / 2, Math.min(gameArea.clientWidth - player.size / 2, player.x));
        player.y = Math.max(player.size / 2, Math.min(gameArea.clientHeight - player.size / 2, player.y));

        character.style.left = `${player.x - player.size / 2}px`;
        character.style.top = `${player.y - player.size / 2}px`;
    }
    
    // ------------------- 공격 및 투사체 -------------------

    function handleAutoAttack() {
        player.attackTimer++;
        if (player.attackTimer >= player.currentWeapon.delay) { 
            player.attackTimer = 0;
            if (monsters.length > 0) {
                let closestMonster = null;
                let minDistance = Infinity;

                monsters.forEach(monster => {
                    const dx = monster.x - player.x;
                    const dy = monster.y - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestMonster = monster;
                    }
                });

                if (closestMonster) {
                    createProjectile(closestMonster);
                }
            }
        }
    }

    function createProjectile(target) {
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const projEl = document.createElement('div');
        projEl.classList.add('projectile');
        if (player.currentWeapon.effect === 'fire') {
            projEl.style.backgroundColor = 'var(--monster-color)'; 
            projEl.style.boxShadow = '0 0 10px red';
        } else if (player.currentWeapon.emoji === "⚔️") { 
            projEl.style.width = '10px';
            projEl.style.height = '10px';
        }
        gameArea.appendChild(projEl);

        const proj = {
            x: player.x,
            y: player.y,
            // 플레이어 영구 업그레이드 투사체 속도 적용
            dx: (dx / dist) * player.projectileSpeed, 
            dy: (dy / dist) * player.projectileSpeed,
            damage: player.attackDamage * player.currentWeapon.damageMultiplier, 
            element: projEl 
        };
        projectiles.push(proj);
        
        projEl.style.left = `${proj.x}px`;
        projEl.style.top = `${proj.y}px`;
    }

    function updateProjectiles() {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            
            // 투사체의 속도는 player.projectileSpeed를 기반으로 계산되므로, 
            // 현재 투사체 객체에 저장된 dx, dy를 사용
            proj.x += proj.dx;
            proj.y += proj.dy;

            proj.element.style.left = `${proj.x}px`;
            proj.element.style.top = `${proj.y}px`;

            // 화면 밖으로 나가면 제거
            if (proj.x < 0 || proj.x > gameArea.clientWidth || proj.y < 0 || proj.y > gameArea.clientHeight) {
                proj.element.remove();
                projectiles.splice(i, 1);
            }
        }
    }

    // ------------------- 몬스터 처리 (챕터 난이도 적용) -------------------

    function spawnMonsters() {
        // 챕터 레벨에 따라 난이도가 선형적으로 증가하도록 조정
        const chapterFactor = chapter;
        const maxMonsters = 8 + chapterFactor * 3; 
        if (monsters.length < maxMonsters && Math.random() < 0.05) { 
            
            const monster = {
                id: Date.now() + Math.random(),
                // HP: 기본 15 + 웨이브 * 3 + 챕터 * 10
                hp: 15 + wave * 3 + chapterFactor * 10, 
                maxHp: 15 + wave * 3 + chapterFactor * 10, 
                x: 0, y: 0, size: 25,
                // 속도: 기본 0.6 + 웨이브 * 0.03 + 챕터 * 0.1
                speed: 0.6 + wave * 0.03 + chapterFactor * 0.1, 
                damage: 5 + chapterFactor * 2 // 대미지: 기본 5 + 챕터 * 2
            };

            const side = Math.floor(Math.random() * 4);
            
            if (side === 0) { monster.x = Math.random() * gameArea.clientWidth; monster.y = -monster.size; } 
            else if (side === 1) { monster.x = Math.random() * gameArea.clientWidth; monster.y = gameArea.clientHeight + monster.size; } 
            else if (side === 2) { monster.x = -monster.size; monster.y = Math.random() * gameArea.clientHeight; } 
            else { monster.x = gameArea.clientWidth + monster.size; monster.y = Math.random() * gameArea.clientHeight; }
            
            monsters.push(monster);
            
            const monEl = document.createElement('div');
            monEl.classList.add('monster');
            monEl.dataset.id = monster.id; 
            monEl.style.left = `${monster.x - monster.size / 2}px`;
            monEl.style.top = `${monster.y - monster.size / 2}px`;
            monEl.textContent = '💀';
            gameArea.appendChild(monEl);
        }
    }

    function updateMonsters() {
        for (let i = monsters.length - 1; i >= 0; i--) {
            const monster = monsters[i];
            const monEl = gameArea.querySelector(`.monster[data-id="${monster.id}"]`);
            
            if (!monEl) continue; 
            
            const dx = player.x - monster.x;
            const dy = player.y - monster.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // 이동
            monster.x += (dx / dist) * monster.speed;
            monster.y += (dy / dist) * monster.speed;

            // DOM 업데이트
            monEl.style.left = `${monster.x - monster.size / 2}px`;
            monEl.style.top = `${monster.y - monster.size / 2}px`;

            // 플레이어와 충돌 (대미지 및 밀어내기)
            if (dist < (player.size + monster.size) / 2) {
                player.hp -= monster.damage / 15; 
                player.hp = Math.max(0, player.hp); 
                
                monster.x -= (dx / dist) * 2;
                monster.y -= (dy / dist) * 2;
            }
        }
    }
    
    // ------------------- 아이템 및 코인 처리 -------------------

    function spawnItem(x, y) {
        // HP 팩 드롭 (10%)
        if (Math.random() < 0.1) {
            const item = { id: Date.now() + Math.random(), type: 'hp_pack', value: 20, x: x, y: y, size: 20 };
            items.push(item);
            const itemEl = document.createElement('div');
            itemEl.classList.add('item');
            itemEl.dataset.id = item.id;
            itemEl.textContent = '+';
            itemEl.style.left = `${item.x - item.size / 2}px`;
            itemEl.style.top = `${item.y - item.size / 2}px`;
            gameArea.appendChild(itemEl);
        }

        // 코인 드롭 (70%)
        if (Math.random() < 0.7) {
            const item = { id: Date.now() + Math.random() + 1, type: 'coin', value: 1, x: x, y: y, size: 20 };
            items.push(item);
            const itemEl = document.createElement('div');
            itemEl.classList.add('item', 'coin');
            itemEl.dataset.id = item.id;
            itemEl.textContent = '💰';
            itemEl.style.left = `${item.x - item.size / 2}px`;
            itemEl.style.top = `${item.y - item.size / 2}px`;
            gameArea.appendChild(itemEl);
        }
    }
    
    function updateItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const itemEl = gameArea.querySelector(`.item[data-id="${item.id}"]`);

            if (!itemEl) continue;

            const dx = player.x - item.x;
            const dy = player.y - item.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 매그넷 효과
            if (dist < player.magnetRange) {
                item.x += (dx / dist) * 2; 
                item.y += (dy / dist) * 2;
                itemEl.style.left = `${item.x - item.size / 2}px`;
                itemEl.style.top = `${item.y - item.size / 2}px`;
            }

            // 아이템 획득
            if (dist < (player.size + item.size) / 2) {
                if (item.type === 'hp_pack') {
                    player.hp = Math.min(player.maxHp, player.hp + item.value);
                } else if (item.type === 'coin') {
                    // 코인 획득 시 코인 배율 적용
                    const coinAmount = Math.round(item.value * player.coinMultiplier);
                    player.coins += coinAmount;
                    
                    // 코인 획득 시 영구 스탯에 합산하고 저장 (실시간 반영)
                    globalStats.totalCoins += coinAmount;
                    localStorage.setItem('miniSlayerStats', JSON.stringify(globalStats));
                }
                
                itemEl.remove();
                items.splice(i, 1);
            }
        }
    }

    // ------------------- 충돌 및 레벨 업 -------------------

    function checkCollisions() {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const proj = projectiles[i];
            
            for (let j = monsters.length - 1; j >= 0; j--) {
                const monster = monsters[j];

                const dx = monster.x - proj.x;
                const dy = monster.y - proj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < (monster.size + 5) / 2) { 
                    monster.hp -= proj.damage;
                    
                    proj.element.remove(); 
                    projectiles.splice(i, 1);

                    if (monster.hp <= 0) {
                        player.kills++;
                        player.xp += monster.maxHp; 
                        
                        spawnItem(monster.x, monster.y); 

                        const monEl = gameArea.querySelector(`.monster[data-id="${monster.id}"]`);
                        monsters.splice(j, 1);
                        if (monEl) monEl.remove();
                        
                        checkLevelUp();
                        checkChapterClear(); // 챕터 클리어 확인
                    }
                    break;
                }
            }
        }
    }
    
    function checkLevelUp() {
        if (player.xp >= player.nextXp) {
            player.xp -= player.nextXp;
            player.level++;
            player.nextXp = Math.floor(player.nextXp * 1.5); 
            
            stopGame(); 
            displaySkillSelection();
        }
    }
    
    // ------------------- 스킬 선택 UI (확장) -------------------
    const SKILLS = [
        { name: "파워 샷", desc: "공격 대미지 +5", apply: (p) => p.attackDamage += 5 },
        { name: "신속의 발", desc: "이동 속도 +1", apply: (p) => p.moveSpeed += 1 },
        { name: "HP 부스트", desc: "최대 HP +20", apply: (p) => { p.maxHp += 20; p.hp = p.maxHp; } }, // HP 회복 포함
        { name: "매그넷", desc: "코인/XP 획득 범위 +30", apply: (p) => p.magnetRange += 30 },
        { name: "연사력 강화", desc: "공격 딜레이 -5", apply: (p) => p.attackDelay = Math.max(10, p.attackDelay - 5) },
        { name: "장거리 투사체", desc: "투사체 속도 +2", apply: (p) => p.projectileSpeed += 2 },
        { name: "광역 공격", desc: "투사체 크기 2배 (비주얼만)", apply: (p) => p.currentWeapon.name === "활 (Bow)" ? p.currentWeapon.damageMultiplier += 0.2 : p.currentWeapon.damageMultiplier += 0.2 } 
    ];

    function getWeaponSkills() {
        return WEAPONS.filter(w => w.name !== player.currentWeapon.name).map((w, index) => ({
            name: w.name, 
            desc: `${w.emoji} ${w.name}으로 교체 (데미지: ${w.damageMultiplier}x, 속도: ${w.speed})`, 
            type: 'weapon', 
            apply: (p) => { 
                p.currentWeapon = w; 
                p.attackDelay = w.delay; 
                p.projectileSpeed = w.speed; 
            }
        }));
    }

    function displaySkillSelection() {
        skillOptionsDiv.innerHTML = '';
        skillOverlay.style.display = 'flex';

        const weaponSkills = getWeaponSkills();
        const baseSkills = SKILLS;

        let allSkills = [...baseSkills, ...weaponSkills];
        
        const selectedSkills = [];
        for (let i = 0; i < 3 && allSkills.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * allSkills.length);
            selectedSkills.push(allSkills[randomIndex]);
            allSkills.splice(randomIndex, 1);
        }

        selectedSkills.forEach(skill => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `<h3>${skill.name}</h3><p>${skill.desc}</p>`;
            card.addEventListener('click', () => selectSkill(skill));
            skillOptionsDiv.appendChild(card);
        });
    }

    function selectSkill(skill) {
        skill.apply(player);
        skillOverlay.style.display = 'none';
        startGame(); 
    }

    // ------------------- 영구 업그레이드 상점 -------------------

    const UPGRADES = [
        { key: 'baseMaxHp', name: 'HP 갑옷', cost: 10, effect: '+20 시작 HP', next: (v) => v + 20, current: () => globalStats.baseMaxHp, base: 100, increase: 20, maxLevel: 5 },
        { key: 'baseDamage', name: '강철 검', cost: 15, effect: '+5 시작 공격력', next: (v) => v + 5, current: () => globalStats.baseDamage, base: 10, increase: 5, maxLevel: 5 },
        { key: 'baseSpeed', name: '부츠', cost: 10, effect: '+1 시작 이동 속도', next: (v) => v + 1, current: () => globalStats.baseSpeed, base: 3, increase: 1, maxLevel: 3 },
        { key: 'baseAttackDelay', name: '가벼운 손목', cost: 20, effect: '공격 딜레이 -5 (최소 20)', next: (v) => Math.max(20, v - 5), current: () => globalStats.baseAttackDelay, base: 50, increase: 5, maxLevel: 6 },
        { key: 'baseMagnetRange', name: '자석 링', cost: 8, effect: '기본 자석 범위 +10', next: (v) => v + 10, current: () => globalStats.baseMagnetRange, base: 50, increase: 10, maxLevel: 5 },
        // ✨ 신규 업그레이드 3종 추가
        { key: 'baseProjectileSpeed', name: '강화 투사체', cost: 15, effect: '투사체 속도 +1.0', next: (v) => v + 1, current: () => globalStats.baseProjectileSpeed, base: 5, increase: 1, maxLevel: 4 },
        { key: 'coinMultiplier', name: '행운의 코인', cost: 25, effect: '획득 코인 배율 +0.1', next: (v) => v + 0.1, current: () => globalStats.coinMultiplier, base: 1.0, increase: 0.1, maxLevel: 5 },
        { key: 'magnetRange', name: '흡수 범위', cost: 10, effect: '기본 흡수 범위 +20', next: (v) => v + 20, current: () => globalStats.baseMagnetRange, base: 50, increase: 20, maxLevel: 5 }
    ];

    function renderShop() {
        shopOptionsDiv.innerHTML = '';
        currentCoinDisplay.textContent = globalStats.totalCoins;

        UPGRADES.forEach(upgrade => {
            // 현재 레벨 계산
            let currentLevel;
            
            if (upgrade.key === 'baseAttackDelay') {
                 // base: 50, increase: 5. current: 50 -> Lv 0. current: 45 -> Lv 1.
                 // 공격 딜레이처럼 값이 줄어드는 스탯
                currentLevel = Math.floor(Math.max(0, (upgrade.base - upgrade.current()) / upgrade.increase)); 
            } else if (upgrade.key === 'coinMultiplier') {
                 // float 값 계산이므로 근사치 비교를 위해 toFixed 사용 후 parse
                 currentLevel = Math.floor(Math.max(0, (upgrade.current() - upgrade.base) / upgrade.increase));
            } else {
                // HP, DMG, Speed, Magnet, ProjSpeed처럼 값이 늘어나는 스탯
                currentLevel = Math.floor(Math.max(0, (upgrade.current() - upgrade.base) / upgrade.increase));
            }
            
            // NaN 체크 및 0으로 대체 (로컬 스토리지 오류 방지)
            if (isNaN(currentLevel)) currentLevel = 0;

            // 다음 업그레이드 비용 계산
            const currentCost = upgrade.cost * (currentLevel + 1);

            const isMaxLevel = currentLevel >= upgrade.maxLevel;
            // 비용이 NaN이거나 음수가 되지 않도록 체크
            const canAfford = globalStats.totalCoins >= currentCost && currentCost > 0;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'shop-item';
            
            // coinMultiplier는 배율을 표시하여 정보를 더 명확하게 제공
            let effectText = upgrade.effect;
            if (upgrade.key === 'coinMultiplier') {
                const currentMult = upgrade.current().toFixed(1);
                effectText = `획득 코인 배율: ${currentMult}x (${upgrade.effect})`;
            }

            itemDiv.innerHTML = `
                <div>
                    <strong>${upgrade.name} (Lv. ${currentLevel}/${upgrade.maxLevel})</strong>
                    <p>${isMaxLevel ? '최대 레벨 도달' : effectText}</p>
                </div>
                <button id="buy-${upgrade.key}" ${!canAfford || isMaxLevel ? 'disabled' : ''}>
                    ${isMaxLevel ? 'MAX' : `구매 (${currentCost}💰)`}
                </button>
            `;
            
            const button = itemDiv.querySelector('button');
            if (!isMaxLevel) {
                button.addEventListener('click', () => buyUpgrade(upgrade, currentCost));
            }
            shopOptionsDiv.appendChild(itemDiv);
        });
    }

    function buyUpgrade(upgrade, cost) {
        if (globalStats.totalCoins >= cost) {
            globalStats.totalCoins -= cost;
            globalStats[upgrade.key] = upgrade.next(globalStats[upgrade.key]);
            
            // 코인 배율은 소수점 문제 방지를 위해 toFixed로 한 번 정리
            if (upgrade.key === 'coinMultiplier') {
                 globalStats[upgrade.key] = parseFloat(globalStats[upgrade.key].toFixed(1));
            }
            
            localStorage.setItem('miniSlayerStats', JSON.stringify(globalStats));
            renderShop();
            updateUI(); 
        }
    }

    // ------------------- UI 업데이트 (상세 스탯 포함) -------------------

    function updateUI() {
        // 상단 패널
        hpBar.value = player.hp;
        hpBar.max = player.maxHp;
        xpBar.value = player.xp;
        xpBar.max = player.nextXp;
        levelDisplay.textContent = `Lv. ${player.level}`;
        scoreDisplay.textContent = `킬 수: ${player.kills} / ${chapterKillGoal}`; 
        waveDisplay.textContent = `웨이브: ${wave}`;
        chapterDisplay.textContent = `챕터: ${chapter}`; 
        weaponDisplay.textContent = `무기: ${player.currentWeapon.emoji}`; 
        coinDisplay.textContent = `💰 ${player.coins}`; 
        
        // 상세 스탯 패널
        // 플레이어의 실제 공격 딜레이를 기반으로 공격 속도 표시
        const finalAttackDelay = player.currentWeapon.delay * (player.attackDelay / 50); // 50은 영구 공속 기본값
        const attSpeedSec = (finalAttackDelay / 60).toFixed(2); 

        statHp.textContent = `HP: ${player.hp.toFixed(0)}/${player.maxHp}`;
        statDmg.textContent = `DMG: ${player.attackDamage.toFixed(0)} (${player.currentWeapon.damageMultiplier}x)`;
        statSpeed.textContent = `SPD: ${player.moveSpeed.toFixed(1)}`;
        statAttSpd.textContent = `ATT SPD: ${attSpeedSec}s`;
        statMagnet.textContent = `MAG: ${player.magnetRange}`;
        statProjSpeed.textContent = `PROJ: ${player.projectileSpeed.toFixed(1)}`; // ✨ 투사체 속도 표시
        
        // 총 코인 업데이트 (상점에서 사용)
        if (gameoverOverlay.style.display === 'flex' || chapterClearOverlay.style.display === 'flex') {
            currentCoinDisplay.textContent = globalStats.totalCoins;
        }
    }

    // ------------------- 이벤트 리스너 -------------------

    startButton.addEventListener('click', startGame);
    stopButton.addEventListener('click', stopGame);
    shopButton.addEventListener('click', showShopOnly); 
    
    // 재시작/돌아가기 버튼 로직
    restartButton.addEventListener('click', () => {
        if (restartButton.textContent.includes('다시 시작')) {
            // 게임 오버 상태에서 누른 경우: 죽은 챕터부터 시작
            initializeGame(globalStats.currentChapter);
            startGame(); 
        } else {
            // 상점 보기 상태에서 '게임으로 돌아가기'를 누른 경우
            gameoverOverlay.style.display = 'none';
        }
    }); 
    
    // 다음 챕터 버튼 이벤트 리스너
    nextChapterButton.addEventListener('click', advanceToNextChapter);
    
    // 처음 게임 로드 시: 저장된 챕터부터 시작
    initializeGame(globalStats.currentChapter);
});