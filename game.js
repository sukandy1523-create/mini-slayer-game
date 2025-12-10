// game.js
// config.js와 login.js가 먼저 로드되어야 합니다.

// ------------------- 유틸리티 함수 -------------------

function getChapterGoal(chap) {
    const goal = CHAPTER_GOALS.find(g => g.chapter === chap);
    if (goal) return goal.requiredKills;
    // 최대 챕터 이후는 마지막 챕터 목표를 사용
    return CHAPTER_GOALS[CHAPTER_GOALS.length - 1].requiredKills;
}

// 몬스터 클래스를 반환하는 유틸리티 함수
function getMonsterClass(chap) {
    const goal = CHAPTER_GOALS.find(g => g.chapter === chap);
    if (goal && goal.monsterClass) return goal.monsterClass;
    return 'monster-default'; // 기본 클래스
}


function applyGlobalStats(startChapter = 1) { 
    if (!globalStats) return;

    // 영구 스탯을 플레이어 객체에 적용
    player.maxHp = globalStats.baseMaxHp;
    player.hp = globalStats.baseMaxHp;
    player.attackDamage = globalStats.baseDamage;
    player.moveSpeed = globalStats.baseSpeed;
    player.attackDelay = globalStats.baseAttackDelay; 
    player.magnetRange = globalStats.baseMagnetRange; 
    player.projectileSpeed = globalStats.baseProjectileSpeed; 
    player.coinMultiplier = globalStats.coinMultiplier; 
    
    // 💡 신규 스탯 적용: 기본 회복량 (null 또는 undefined 방지)
    player.healAmount = globalStats.baseHealAmount || 0; 
    
    chapter = startChapter; 
    chapterKillGoal = getChapterGoal(chapter);
}

function updateUI() {
    if (!globalStats) {
         DOM.playerNameDisplay.textContent = `[로그인 필요]`;
         DOM.coinDisplay.textContent = `💰 0`;
         return;
    }
    
    DOM.hpBar.value = player.hp;
    DOM.hpBar.max = player.maxHp;
    DOM.xpBar.value = player.xp;
    DOM.xpBar.max = player.nextXp;
    DOM.levelDisplay.textContent = `Lv. ${player.level}`;
    
    if (isBossWave && bossMonster) {
        DOM.scoreDisplay.textContent = `BOSS HP: ${bossMonster.hp.toFixed(0)}/${bossMonster.maxHp.toFixed(0)}`;
    } else {
        DOM.scoreDisplay.textContent = `킬 수: ${player.kills} / ${chapterKillGoal}`; 
    }
    
    DOM.waveDisplay.textContent = `웨이브: ${wave}`;
    DOM.chapterDisplay.textContent = `챕터: ${chapter}`; 
    DOM.weaponDisplay.textContent = `무기: ${player.currentWeapon.emoji}`; 
    DOM.coinDisplay.textContent = `💰 ${player.coins}`; 
    
    const finalAttackDelay = player.currentWeapon.delay * (Math.max(10, player.attackDelay) / 50); // 💡 공격 딜레이 최소값 적용
    const attSpeedSec = (finalAttackDelay / 60).toFixed(2); 

    DOM.statHp.textContent = `HP: ${player.hp.toFixed(0)}/${player.maxHp}`;
    DOM.statDmg.textContent = `DMG: ${player.attackDamage.toFixed(0)} (${player.currentWeapon.damageMultiplier}x)`;
    DOM.statSpeed.textContent = `SPD: ${player.moveSpeed.toFixed(1)}`;
    DOM.statAttSpd.textContent = `ATT SPD: ${attSpeedSec}s`;
    DOM.statMagnet.textContent = `MAG: ${player.magnetRange}`;
    DOM.statProjSpeed.textContent = `PROJ: ${player.projectileSpeed.toFixed(1)}`;
    
    if (DOM.gameoverOverlay.style.display === 'flex' || DOM.chapterClearOverlay.style.display === 'flex') {
        DOM.currentCoinDisplay.textContent = globalStats.totalCoins;
    }
    
    // 💡 치트 버튼 표시 상태 업데이트
    updateCheatButtonVisibility();
}

// ------------------- 게임 제어 -------------------

function initializeGame(startChapter = 1) { 
    if (!currentUsername) return; 

    // 상태 초기화
    player = {
        x: DOM.gameArea.clientWidth / 2, y: DOM.gameArea.clientHeight / 2, size: 30, hp: 100, maxHp: 100, xp: 0, nextXp: 100, level: 1, kills: 0,
        moveSpeed: 3, currentWeapon: WEAPONS[0], attackDamage: 10, attackDelay: 50, attackTimer: 0, projectileSpeed: 5, magnetRange: 50,
        coins: 0
    };
    monsters = [];
    projectiles = [];
    items = []; 
    wave = 1;
    
    isBossWave = false; 
    bossMonster = null; 
    bossSpawned = false;
    bossProjectiles = []; 
    
    applyGlobalStats(startChapter); 

    clearInterval(gameLoop);
    clearInterval(waveTimer);
    gameLoop = null;
    
    updateUI(); 
    DOM.gameArea.querySelectorAll('.monster, .projectile, .item, .monster.boss, .boss-projectile').forEach(e => e.remove()); 
    // 모든 오버레이를 닫음
    DOM.gameoverOverlay.style.display = 'none';
    DOM.skillOverlay.style.display = 'none';
    DOM.chapterClearOverlay.style.display = 'none'; 
    DOM.loginOverlay.style.display = 'none';
    DOM.cheatOverlay.style.display = 'none';
    
    DOM.startButton.disabled = false;
    DOM.stopButton.disabled = true;
    
    DOM.character.style.left = `${player.x - player.size / 2}px`;
    DOM.character.style.top = `${player.y - player.size / 2}px`;

    isPlaying = false;
    isPaused = false;
}

function startGame() {
    if (!currentUsername) return; 
    if (isPlaying && !isPaused) return;

    isPlaying = true;
    isPaused = false;
    DOM.startButton.disabled = true;
    DOM.stopButton.disabled = false;
    
    if (!gameLoop) {
        gameLoop = setInterval(updateGame, 16); 
        startWaveTimer();
    }
}

function stopGame() {
    if (!isPlaying && !isPaused) return;
    
    isPaused = true;
    DOM.startButton.disabled = false;
    DOM.stopButton.disabled = true;
    clearInterval(gameLoop);
    gameLoop = null;
    clearInterval(waveTimer);
}

function endGame() {
    isPlaying = false;
    stopGame(); 
    
    // 💡 로그아웃 시 무적 모드 해제
    isInvincible = false;

    globalStats.currentChapter = chapter;
    saveUserStats(); 

    document.getElementById('final-message').textContent = `게임 오버! (레벨 ${player.level} / 챕터 ${chapter})`; 
    document.getElementById('final-score').textContent = `획득 코인: ${player.coins}`;
    
    renderShop(); 
    
    DOM.restartButton.textContent = `챕터 ${chapter} 부터 다시 시작`; 
    
    // ✨ 모든 오버레이를 닫고 gameoverOverlay만 강제 표시 (z-index 포함)
    DOM.skillOverlay.style.display = 'none';
    DOM.chapterClearOverlay.style.display = 'none';
    DOM.loginOverlay.style.display = 'none';
    DOM.cheatOverlay.style.display = 'none';
    
    DOM.gameoverOverlay.style.zIndex = '999999';
    DOM.gameoverOverlay.style.display = 'flex'; 
}

function showShopOnly() {
    stopGame(); 
    
    if (currentUsername) saveUserStats(); 

    document.getElementById('final-message').textContent = `🛡️ 영구 업그레이드 상점`;
    document.getElementById('final-score').textContent = ``; 
    
    renderShop();
    
    DOM.restartButton.textContent = '닫기 (게임으로 돌아가기)'; 
    
    // ✨ 상점 오버레이 표시
    DOM.gameoverOverlay.style.zIndex = '999999';
    DOM.gameoverOverlay.style.display = 'flex';
}

function startWaveTimer() {
    clearInterval(waveTimer);
    waveTimer = setInterval(() => {
        wave++;
        DOM.waveDisplay.textContent = `웨이브: ${wave}`;
    }, waveDuration);
}

function checkChapterClear() {
    if (!isBossWave && player.kills >= chapterKillGoal) {
        isBossWave = true;
        bossSpawned = false; 
        
        monsters.forEach(m => {
            const monEl = DOM.gameArea.querySelector(`.monster[data-id="${m.id}"]`);
            if (monEl) monEl.remove();
        });
        monsters = [];
        return;
    }
    
    if (isBossWave && bossMonster === null && bossSpawned) { 
        stopGame(); 

        const nextChapter = chapter + 1;
        globalStats.currentChapter = nextChapter;
        saveUserStats(); 

        DOM.chapterClearMessage.textContent = `🎉 챕터 ${chapter} 클리어! 보스 처치 완료! 🎉`;
        DOM.nextChapterButton.textContent = `챕터 ${nextChapter} 로 이동 (계속)`;
        DOM.chapterClearOverlay.style.display = 'flex';
    }
}

function collectAllItems() {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        
        if (item.type === 'hp_pack') {
            // 💡 신규 스탯 적용: 회복 팩 값에 healAmount를 더해 적용
            const healValue = item.value + player.healAmount;
            player.hp = Math.min(player.maxHp, player.hp + healValue); 
        } else if (item.type === 'coin') {
            const coinAmount = Math.round(item.value * player.coinMultiplier);
            player.coins += coinAmount;
            
            globalStats.totalCoins += coinAmount;
            saveUserStats(); 
        }
        
        const itemEl = DOM.gameArea.querySelector(`.item[data-id="${item.id}"]`);
        if (itemEl) itemEl.remove();
        
        items.splice(i, 1);
    }
    updateUI();
}

function advanceToNextChapter() {
    DOM.chapterClearOverlay.style.display = 'none';

    collectAllItems();

    DOM.gameArea.querySelectorAll('.monster, .projectile, .boss-projectile').forEach(e => e.remove());

    monsters = [];
    projectiles = [];
    bossProjectiles = []; 
    wave = 1; 
    
    // 💡 요청 사항: 챕터 클리어 시 킬수 리셋
    player.kills = 0; 

    isBossWave = false; 
    bossMonster = null;
    bossSpawned = false;

    chapter++;
    chapterKillGoal = getChapterGoal(chapter);
    
    updateUI();
    startGame();
}

// ------------------- 치트 함수 추가 -------------------

// 💡 개발자 전용: 치트 버튼의 표시 여부를 결정
function updateCheatButtonVisibility() {
    if (!DOM.cheatButton) return; 

    if (currentUsername === DEVELOPER_USERNAME) {
        DOM.cheatButton.style.display = 'block'; // 개발자일 때 표시
    } else {
        DOM.cheatButton.style.display = 'none'; // 일반 사용자일 때 숨김
    }
}

function showCheatMenu() {
    // 💡 보안 검사: 개발자만 접근 가능
    if (currentUsername !== DEVELOPER_USERNAME) return;
    
    stopGame(); // 게임 정지

    // 무적 모드 버튼 텍스트 업데이트
    DOM.cheatToggleInvincibleButton.textContent = isInvincible ? '무적 모드 (ON)' : '무적 모드 (OFF)';
    DOM.cheatToggleInvincibleButton.style.backgroundColor = isInvincible ? '#2ecc71' : '#e74c3c';
    
    DOM.cheatOverlay.style.zIndex = '999999';
    DOM.cheatOverlay.style.display = 'flex';
}

function handleInvincibleToggle() {
    // 💡 보안 검사: 개발자만 사용 가능
    if (currentUsername !== DEVELOPER_USERNAME) return;

    isInvincible = !isInvincible;
    DOM.cheatToggleInvincibleButton.textContent = isInvincible ? '무적 모드 (ON)' : '무적 모드 (OFF)';
    DOM.cheatToggleInvincibleButton.style.backgroundColor = isInvincible ? '#2ecc71' : '#e74c3c';
}

function cheatLevelUp() {
    // 💡 보안 검사: 개발자만 사용 가능
    if (currentUsername !== DEVELOPER_USERNAME) return;
    
    player.xp = player.nextXp; 
    checkLevelUp(); 
    DOM.cheatOverlay.style.display = 'none'; 
}

function cheatMaxCoins() {
    // 💡 보안 검사: 개발자만 사용 가능
    if (currentUsername !== DEVELOPER_USERNAME) return;

    if (!globalStats) return;
    const addedCoins = 10000;
    globalStats.totalCoins += addedCoins;
    player.coins += addedCoins;
    saveUserStats();
    updateUI();
}

function cheatWinChapter() {
    // 💡 보안 검사: 개발자만 사용 가능
    if (currentUsername !== DEVELOPER_USERNAME) return;

    if (isBossWave) {
        if (bossMonster) bossMonster.hp = 0;
    } else {
        player.kills = chapterKillGoal;
    }
    DOM.cheatOverlay.style.display = 'none';
    startGame();
}

// ------------------- 게임 루프 및 주요 업데이트 -------------------

function updateGame() {
    if (isPaused || !isPlaying) return;

    handleMovement(); 
    spawnMonsters(); 
    updateProjectiles();
    updateBossProjectiles(); 
    updateMonsters();
    updateItems(); 
    checkCollisions();
    handleAutoAttack();
    updateUI();

    if (player.hp <= 0) {
        endGame();
    }
}

function handleMovement() {
    // 키 상태 객체 'keys' 사용
    if (keys['w']) player.y -= player.moveSpeed;
    if (keys['s']) player.y += player.moveSpeed;
    if (keys['a']) player.x -= player.moveSpeed;
    if (keys['d']) player.x += player.moveSpeed;
    
    player.x = Math.max(player.size / 2, Math.min(DOM.gameArea.clientWidth - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(DOM.gameArea.clientHeight - player.size / 2, player.y));

    DOM.character.style.left = `${player.x - player.size / 2}px`;
    DOM.character.style.top = `${player.y - player.size / 2}px`;
}

function handleAutoAttack() {
    player.attackTimer++;
    // player.currentWeapon.delay와 player.attackDelay가 모두 공격 속도에 영향을 줍니다.
    const finalAttackDelay = player.currentWeapon.delay * (Math.max(10, player.attackDelay) / 50);

    if (player.attackTimer >= finalAttackDelay) { 
        player.attackTimer = 0;
        
        let target = null;
        
        // 💡 오류 수정: 보스가 존재하면 무조건 보스를 타겟으로 설정
        if (isBossWave && bossMonster) {
            target = bossMonster;
        } else if (monsters.length > 0) {
            // 일반 웨이브일 경우 가장 가까운 몬스터를 타겟으로 찾음
            let minDistance = Infinity;

            monsters.forEach(monster => {
                const dx = monster.x - player.x;
                const dy = monster.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistance) {
                    minDistance = dist;
                    target = monster;
                }
            });
        }

        if (target) {
            createProjectile(target);
        }
    }
}

function createProjectile(target) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const projEl = document.createElement('div');
    projEl.classList.add('projectile');
    
    // 💡 퀄리티 개선: 무기별 시각 효과를 CSS 클래스로 적용
    if (player.currentWeapon.effect === 'fire') {
        projEl.classList.add('fire-effect'); // CSS에서 정의한 파이어볼 효과 적용
    } else if (player.currentWeapon.emoji === "⚔️") { 
        projEl.classList.add('dual-blade-effect'); // CSS에서 정의한 쌍검 효과 적용
        projEl.style.width = '10px';
        projEl.style.height = '10px';
    }
    
    DOM.gameArea.appendChild(projEl);

    const proj = {
        x: player.x,
        y: player.y,
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
        
        proj.x += proj.dx;
        proj.y += proj.dy;

        proj.element.style.left = `${proj.x}px`;
        proj.element.style.top = `${proj.y}px`;

        if (proj.x < 0 || proj.x > DOM.gameArea.clientWidth || proj.y < 0 || proj.y > DOM.gameArea.clientHeight) {
            proj.element.remove();
            projectiles.splice(i, 1);
        }
    }
}

function bossAttack() {
    if (!bossMonster) return;
    
    const dx = player.x - bossMonster.x;
    const dy = player.y - bossMonster.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const projEl = document.createElement('div');
    projEl.classList.add('projectile', 'boss-projectile'); 
    projEl.style.backgroundColor = '#8e44ad'; 
    projEl.style.width = '10px';
    projEl.style.height = '10px';
    projEl.style.boxShadow = '0 0 15px #f1c40f'; 
    DOM.gameArea.appendChild(projEl);

    const bossProj = {
        x: bossMonster.x,
        y: bossMonster.y,
        dx: (dx / dist) * 3, 
        dy: (dy / dist) * 3,
        damage: bossMonster.damage * 0.5, 
        element: projEl 
    };
    bossProjectiles.push(bossProj);
    
    projEl.style.left = `${bossProj.x}px`;
    projEl.style.top = `${bossProj.y}px`;
}

function updateBossProjectiles() {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
        const proj = bossProjectiles[i];
        
        proj.x += proj.dx;
        proj.y += proj.dy;

        proj.element.style.left = `${proj.x}px`;
        proj.element.style.top = `${proj.y}px`;

        const dx = player.x - proj.x;
        const dy = player.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 플레이어와 충돌
        if (dist < (player.size + 10) / 2) { 
            // 💡 치트 적용: 무적 모드인 경우 데미지 무시
            if (!isInvincible) {
                player.hp -= proj.damage;
                player.hp = Math.max(0, player.hp);
            }
            
            proj.element.remove();
            bossProjectiles.splice(i, 1);
            continue;
        }

        // 화면 밖으로 나가면 제거
        if (proj.x < 0 || proj.x > DOM.gameArea.clientWidth || proj.y < 0 || proj.y > DOM.gameArea.clientHeight) {
            proj.element.remove();
            bossProjectiles.splice(i, 1);
        }
    }
}

function spawnMonsters() {
    if (isBossWave) {
        if (!bossMonster && !bossSpawned) {
            spawnBoss();
        }
        return; 
    }
    
    const chapterFactor = chapter;
    const maxMonsters = 8 + chapterFactor * 3; 
    if (monsters.length < maxMonsters && Math.random() < 0.05) { 
        
        const monster = {
            id: Date.now() + Math.random(),
            hp: 15 + wave * 3 + chapterFactor * 10, 
            maxHp: 15 + wave * 3 + chapterFactor * 10, 
            x: 0, y: 0, size: 25,
            speed: 0.6 + wave * 0.03 + chapterFactor * 0.1, 
            damage: 5 + chapterFactor * 2 
        };

        const side = Math.floor(Math.random() * 4);
        
        if (side === 0) { monster.x = Math.random() * DOM.gameArea.clientWidth; monster.y = -monster.size; } 
        else if (side === 1) { monster.x = Math.random() * DOM.gameArea.clientWidth; monster.y = DOM.gameArea.clientHeight + monster.size; } 
        else if (side === 2) { monster.x = -monster.size; monster.y = Math.random() * DOM.gameArea.clientHeight; } 
        else { monster.x = DOM.gameArea.clientWidth + monster.size; monster.y = Math.random() * DOM.gameArea.clientHeight; }
        
        monsters.push(monster);
        
        const monEl = document.createElement('div');
        monEl.classList.add('monster');
        
        // 💡 챕터별 몬스터 클래스 추가
        const chapClass = getMonsterClass(chapter);
        monEl.classList.add(chapClass); 
        
        monEl.dataset.id = monster.id; 
        monEl.style.left = `${monster.x - monster.size / 2}px`;
        monEl.style.top = `${monster.y - monster.size / 2}px`;
        monEl.textContent = '💀';
        DOM.gameArea.appendChild(monEl);
    }
}

function spawnBoss() {
    if (bossSpawned) return;
    
    const chapterFactor = chapter;
    
    const boss = {
        id: 'boss',
        hp: (15 + chapterFactor * 10) * 50, 
        maxHp: (15 + chapterFactor * 10) * 50, 
        x: DOM.gameArea.clientWidth / 2, y: DOM.gameArea.clientHeight / 2, 
        size: 60, 
        speed: 0.8 + chapterFactor * 0.05, 
        damage: (5 + chapterFactor * 2) * 3,
        // 💡 보강: 공격 딜레이 최소값 보장 (30 프레임, 약 0.5초)
        attackDelay: Math.max(30, 120 - (chapterFactor * 10)), 
        attackTimer: 0 
    };
    
    bossMonster = boss;
    bossSpawned = true;
    
    const bossEl = document.createElement('div');
    bossEl.classList.add('monster', 'boss'); 
    bossEl.dataset.id = boss.id;
    bossEl.style.width = `${boss.size}px`;
    bossEl.style.height = `${boss.size}px`;
    bossEl.style.lineHeight = `${boss.size}px`;
    bossEl.style.fontSize = `${boss.size * 0.6}px`;
    bossEl.textContent = '😈'; 
    
    bossEl.style.left = `${boss.x - boss.size / 2}px`;
    bossEl.style.top = `${boss.y - boss.size / 2}px`;

    DOM.gameArea.appendChild(bossEl);
}

function updateBoss() {
    if (!bossMonster) return;

    const bossEl = DOM.gameArea.querySelector(`.monster[data-id="${bossMonster.id}"]`);
    if (!bossEl) return;

    const dx = player.x - bossMonster.x;
    const dy = player.y - bossMonster.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // 💡 오류 수정: dist가 1보다 큰 경우에만 이동 수행 (0으로 나누기 방지 및 이동 활성화)
    if (dist > 1) { 
        // 보스 이동
        bossMonster.x += (dx / dist) * bossMonster.speed;
        bossMonster.y += (dy / dist) * bossMonster.speed;

        // DOM 업데이트
        bossEl.style.left = `${bossMonster.x - bossMonster.size / 2}px`;
        bossEl.style.top = `${bossMonster.y - bossMonster.size / 2}px`;
    }

    // 플레이어와 충돌 (대미지 및 밀어내기)
    if (dist < (player.size + bossMonster.size) / 2) {
         // 💡 치트 적용: 무적 모드인 경우 데미지 무시
        if (!isInvincible) {
            player.hp -= bossMonster.damage / 15; 
            player.hp = Math.max(0, player.hp); 
        }
    }

    // 보스 공격 타이머
    bossMonster.attackTimer++;
    // 💡 공격 딜레이 최소값 보장
    const effectiveAttackDelay = Math.max(30, bossMonster.attackDelay); 
    
    if (bossMonster.attackTimer >= effectiveAttackDelay) {
        bossMonster.attackTimer = 0;
        bossAttack(); 
    }
}

function updateMonsters() {
    if (isBossWave && bossMonster) {
        updateBoss();
        return;
    }

    for (let i = monsters.length - 1; i >= 0; i--) {
        const monster = monsters[i];
        const monEl = DOM.gameArea.querySelector(`.monster[data-id="${monster.id}"]`);
        
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
             // 💡 치트 적용: 무적 모드인 경우 데미지 무시
            if (!isInvincible) {
                player.hp -= monster.damage / 15; 
                player.hp = Math.max(0, player.hp); 
            }
            
            monster.x -= (dx / dist) * 2;
            monster.y -= (dy / dist) * 2;
        }
    }
}

function spawnItem(x, y) {
    if (Math.random() < 0.1) {
        const item = { id: Date.now() + Math.random(), type: 'hp_pack', value: 20, x: x, y: y, size: 20 };
        items.push(item);
        const itemEl = document.createElement('div');
        itemEl.classList.add('item');
        itemEl.dataset.id = item.id;
        itemEl.textContent = '+';
        itemEl.style.left = `${item.x - item.size / 2}px`;
        itemEl.style.top = `${item.y - item.size / 2}px`;
        DOM.gameArea.appendChild(itemEl);
    }

    if (Math.random() < 0.7) {
        const coinValue = bossMonster ? 50 * chapter : 1; 
        
        const item = { id: Date.now() + Math.random() + 1, type: 'coin', value: coinValue, x: x, y: y, size: 20 };
        items.push(item);
        const itemEl = document.createElement('div');
        itemEl.classList.add('item', 'coin');
        itemEl.dataset.id = item.id;
        itemEl.textContent = '💰';
        itemEl.style.left = `${item.x - item.size / 2}px`;
        itemEl.style.top = `${item.y - item.size / 2}px`;
        DOM.gameArea.appendChild(itemEl);
    }
}

function updateItems() {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const itemEl = DOM.gameArea.querySelector(`.item[data-id="${item.id}"]`);

        if (!itemEl) continue;

        const dx = player.x - item.x;
        const dy = player.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.magnetRange) {
            item.x += (dx / dist) * 2; 
            item.y += (dy / dist) * 2;
            itemEl.style.left = `${item.x - item.size / 2}px`;
            itemEl.style.top = `${item.y - item.size / 2}px`;
        }

        if (dist < (player.size + item.size) / 2) {
            if (item.type === 'hp_pack') {
                // 💡 신규 스탯 적용: 회복 팩 값에 healAmount를 더해 적용
                const healValue = item.value + player.healAmount;
                player.hp = Math.min(player.maxHp, player.hp + healValue);
            } else if (item.type === 'coin') {
                const coinAmount = Math.round(item.value * player.coinMultiplier);
                player.coins += coinAmount;
                
                globalStats.totalCoins += coinAmount;
                saveUserStats();
            }
            
            itemEl.remove();
            items.splice(i, 1);
        }
    }
}

function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        
        if (isBossWave && bossMonster) {
            const monster = bossMonster;
            
            const dx = monster.x - proj.x;
            const dy = monster.y - proj.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < (monster.size + 5) / 2) { 
                monster.hp -= proj.damage;
                
                proj.element.remove(); 
                projectiles.splice(i, 1); 

                if (monster.hp <= 0) {
                    player.kills++; 
                    player.xp += monster.maxHp * 0.5; 
                    
                    spawnItem(monster.x, monster.y); 

                    const monEl = DOM.gameArea.querySelector(`.monster[data-id="${monster.id}"]`);
                    if (monEl) monEl.remove();
                    
                    bossMonster = null; 
                    
                    // 💡 보강: 보스가 죽으면 해당 프레임에 보스 투사체도 즉시 정리
                    bossProjectiles.forEach(p => p.element.remove());
                    bossProjectiles = []; 
                    
                    checkLevelUp();
                    checkChapterClear(); 
                }
                break;
            }
            
        } else {
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

                        const monEl = DOM.gameArea.querySelector(`.monster[data-id="${monster.id}"]`);
                        monsters.splice(j, 1);
                        if (monEl) monEl.remove();
                        
                        checkLevelUp();
                        checkChapterClear(); 
                    }
                    break;
                }
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

function displaySkillSelection() {
    DOM.skillOptionsDiv.innerHTML = '';
    DOM.skillOverlay.style.display = 'flex';

    const weaponSkills = WEAPONS.filter(w => w.name !== player.currentWeapon.name).map((w, index) => ({
        name: w.name, 
        desc: `${w.emoji} ${w.name}으로 교체 (데미지: ${w.damageMultiplier}x, 속도: ${w.speed})`, 
        type: 'weapon', 
        apply: (p) => { 
            p.currentWeapon = w; 
            p.attackDelay = w.delay; 
            p.projectileSpeed = w.speed; 
        }
    }));
    
    const SKILLS = [
        { name: "파워 샷", desc: "공격 대미지 +5", apply: (p) => p.attackDamage += 5 },
        { name: "신속의 발", desc: "이동 속도 +1", apply: (p) => p.moveSpeed += 1 },
        { name: "HP 부스트", desc: "최대 HP +20", apply: (p) => { p.maxHp += 20; p.hp = p.maxHp; } }, 
        { name: "매그넷", desc: "코인/XP 획득 범위 +30", apply: (p) => p.magnetRange += 30 },
        { name: "연사력 강화", desc: "공격 딜레이 -5", apply: (p) => p.attackDelay = Math.max(10, p.attackDelay - 5) },
        { name: "장거리 투사체", desc: "투사체 속도 +2", apply: (p) => p.projectileSpeed += 2 },
        { name: "광역 공격", desc: "투사체 크기 2배 (비주얼만)", apply: (p) => p.currentWeapon.name === "활 (Bow)" ? p.currentWeapon.damageMultiplier += 0.2 : p.currentWeapon.damageMultiplier += 0.2 } 
    ];

    let allSkills = [...SKILLS, ...weaponSkills];
    
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
        DOM.skillOptionsDiv.appendChild(card);
    });
}

function selectSkill(skill) {
    skill.apply(player);
    DOM.skillOverlay.style.display = 'none';
    startGame(); 
}

function renderShop() {
    if (!globalStats) return; 

    DOM.shopOptionsDiv.innerHTML = '';
    DOM.currentCoinDisplay.textContent = globalStats.totalCoins;

    UPGRADES.forEach(upgrade => {
        let currentLevel;
        
        if (upgrade.key === 'baseAttackDelay') {
            // 💡 수정된 로직: 딜레이 감소량 (50 - current) 기준으로 레벨 계산
            const delayReduction = upgrade.base - upgrade.current();
            currentLevel = Math.floor(Math.max(0, delayReduction / upgrade.increase));
            
            // 만약 딜레이가 이미 10 (최소값)에 도달했다면, 레벨 카운트를 maxLevel로 고정하여 구매 버튼 비활성화
            if (upgrade.current() <= 10) {
                 currentLevel = upgrade.maxLevel;
            }
            
        } else if (upgrade.key === 'coinMultiplier') {
             currentLevel = Math.floor(Math.max(0, (upgrade.current() - upgrade.base) / upgrade.increase));
        } else {
            const currentValue = upgrade.current() === undefined || upgrade.current() === null ? upgrade.base : upgrade.current();
            currentLevel = Math.floor(Math.max(0, (currentValue - upgrade.base) / upgrade.increase));
        }
        
        if (isNaN(currentLevel)) currentLevel = 0;

        const currentCost = upgrade.cost * (currentLevel + 1);

        // 💡 maxLevel 도달 여부 계산을 명확히 함
        const isMaxLevel = currentLevel >= upgrade.maxLevel;
        const canAfford = globalStats.totalCoins >= currentCost && currentCost > 0;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'shop-item';
        
        let effectText = upgrade.effect;
        if (upgrade.key === 'coinMultiplier') {
            const currentMult = upgrade.current().toFixed(2);
            effectText = `획득 코인 배율: ${currentMult}x (${upgrade.effect})`;
        } else if (upgrade.key === 'currentChapter') {
             effectText = `현재 시작 챕터: ${upgrade.current()} (${upgrade.effect})`;
        } else if (upgrade.key === 'baseHealAmount') {
             effectText = `추가 회복량: +${upgrade.current()} (${upgrade.effect})`;
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
            // 현재 레벨을 전달하지 않고, 함수 내에서 다시 계산하도록 단순화
            button.addEventListener('click', () => buyUpgrade(upgrade, currentCost)); 
        }
        DOM.shopOptionsDiv.appendChild(itemDiv);
    });
}

function buyUpgrade(upgrade, cost) {
    
    // 구매 전 현재 레벨을 다시 계산하여 MaxLevel 도달 여부 확인
    let currentLevel;
    if (upgrade.key === 'baseAttackDelay') {
        const delayReduction = upgrade.base - upgrade.current();
        currentLevel = Math.floor(Math.max(0, delayReduction / upgrade.increase));
        if (upgrade.current() <= 10) {
             currentLevel = upgrade.maxLevel;
        }
    } else {
        const currentValue = upgrade.current() === undefined || upgrade.current() === null ? upgrade.base : upgrade.current();
        currentLevel = Math.floor(Math.max(0, (currentValue - upgrade.base) / upgrade.increase));
    }
    
    if (currentLevel >= upgrade.maxLevel) return; // MaxLevel이면 구매 불가

    if (globalStats.totalCoins >= cost) {
        globalStats.totalCoins -= cost;
        
        // 딜레이 감소 (Math.max(10, v - 5)가 config에 정의되어 있음)
        globalStats[upgrade.key] = upgrade.next(globalStats[upgrade.key]);
        
        if (upgrade.key === 'coinMultiplier') {
             globalStats[upgrade.key] = parseFloat(globalStats[upgrade.key].toFixed(2));
        }
        
        saveUserStats(); 
        renderShop();
        updateUI(); 
    }
}

// ------------------- 이벤트 리스너 연결 -------------------

document.addEventListener('DOMContentLoaded', () => {
    // 💡 초기화 시 치트 버튼을 숨깁니다.
    if (DOM.cheatButton) {
        DOM.cheatButton.style.display = 'none'; 
    }
    
    // 키 입력 리스너
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
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
    
    // 게임 제어 버튼
    DOM.startButton.addEventListener('click', startGame);
    DOM.stopButton.addEventListener('click', stopGame);
    DOM.shopButton.addEventListener('click', showShopOnly); 
    
    // 💡 치트 버튼 리스너
    DOM.cheatButton.addEventListener('click', showCheatMenu);
    
    // 재시작/돌아가기 버튼
    DOM.restartButton.addEventListener('click', () => {
        if (!currentUsername) return; 

        if (DOM.restartButton.textContent.includes('다시 시작')) {
            initializeGame(globalStats.currentChapter);
            startGame(); 
        } else {
            DOM.gameoverOverlay.style.display = 'none';
            // 상점을 닫고 게임이 일시정지 상태이므로 다시 시작할 수 있도록 startButton 활성화
            DOM.startButton.disabled = false;
        }
    }); 
    
    // 다음 챕터 버튼
    DOM.nextChapterButton.addEventListener('click', advanceToNextChapter);
    
    // 💡 치트 메뉴 버튼 리스너
    DOM.cheatCloseButton.addEventListener('click', () => {
        DOM.cheatOverlay.style.display = 'none';
        if (isPlaying) startGame();
    });
    DOM.cheatLevelUpButton.addEventListener('click', cheatLevelUp);
    DOM.cheatMaxCoinsButton.addEventListener('click', cheatMaxCoins);
    DOM.cheatToggleInvincibleButton.addEventListener('click', handleInvincibleToggle);
    DOM.cheatWinChapterButton.addEventListener('click', cheatWinChapter);
});