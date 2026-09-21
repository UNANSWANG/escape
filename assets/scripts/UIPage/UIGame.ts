import { _decorator, AnimationClip, Camera, Canvas, EventKeyboard, EventTouch, Input, input, instantiate, KeyCode, Label, Layout, Node, UITransform, Vec2, Vec3, NodeEventType, director, TiledMap, TiledObjectGroup, Prefab, Sprite, Tween, UIOpacity, tween, sp, view, Size, PolygonCollider2D } from 'cc';
import { uiMgr } from '../manager/UIManager';
import { pData } from '../manager/playerData';
import { UIBase } from './UIBase';
import { UIPath } from '../manager/pathConfig';
import { configData, GameEvent } from '../manager/configData';
import { gm } from '../manager/gm';
import { zoomButton } from '../extention/zoomButton';
import { ccTools } from '../extention/generalTools';
import { playerMgr } from '../manager/playerManager';
import { CameraController } from '../controller/CameraController';
import { enemyMgr } from '../manager/enemyManager';
import { enemyBaseController } from '../controller/enemy/enemyBaseController';
import { audioMgr } from '../manager/audioManager';
import { roleAnimName } from '../controller/role/roleController';
import { role0Skill2RemainEvent } from '../controller/role/role0';
import { addRoleScript } from '../controller/role/roleScriptFactory';
import { poolMgr } from '../manager/poolManager';
import { containerController } from '../controller/containerController';
import { sniperController } from '../controller/sniperController';
import { gunController } from '../controller/gunController';
import { weaponsConfig } from '../json/jsonWeapons';
import { videoMgr } from '../manager/videoManager';
const { ccclass, property } = _decorator;

/** 静态障碍物的世界坐标数据。points 为 null 时直接使用矩形包围盒。 */
export interface StaticCollisionShape {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    points: ReadonlyArray<{ x: number; y: number }> | null;
    edges: ReadonlyArray<{ x: number; y: number; nx: number; ny: number; tx: number; ty: number; length: number }>;
    queryStamp: number;
}

@ccclass('UIGame')
export class UIGame extends UIBase {
    @property(Node)
    setBtn: Node;

    @property(Node)
    roleNode: Node;

    @property(Node)
    rockerTouchNode: Node;

    @property(Node)
    gameUINode: Node;

    @property(Prefab)
    rolePre: Prefab;

    @property(Prefab)
    soldiersPre: Prefab;

    @property(Node)
    shootBtn: Node;

    @property(Node)
    reloadBtn: Node;

    @property(Node)
    skillBtn1: Node;

    @property(Node)
    skillBtn2: Node;

    @property(Node)
    knifeBtn: Node;

    @property(Node)
    bagBtn: Node;

    @property(Node)
    weaponBox_0: Node;

    @property(Node)
    weaponBox_1: Node;

    @property(Node)
    aimingBtn: Node;

    @property(Node)
    openBtn: Node;

    @property(Node)
    drugBtn_0: Node;

    @property(Node)
    drugBtn_1: Node;

    @property(Node)
    containerList: Node;

    @property(Node)
    colliderList: Node;

    @property(Label)
    skill2RemainLab: Label;

    ///
    ///需要获取的节点
    ///

    ///
    ///属性
    ///
    /**当前移动方向 */
    private currentMoveDirection: Vec3 = new Vec3();
    /**是否正在移动 */
    private isMoving = false;
    /**玩家本次输入请求的方向；技能锁定结束后用它恢复控制。 */
    private inputMoveDirection: Vec3 = new Vec3();
    /**上一帧是否由技能锁定移动方向。 */
    private wasMoveDirectionLocked = false;
    /**摇杆触摸是否正在控制移动；摇杆优先于键盘 */
    private isRockerControlling = false;
    /**当前按住的移动按键（W、A、S、D） */
    private pressedMoveKeys: Set<KeyCode> = new Set();
    /**键盘攻击键是否按住 */
    private isKeyboardAttackPressed = false;
    /**射击按钮是否按住 */
    private isShootButtonPressed = false;
    /**手动瞄准摇杆是否正在控制 */
    private isManualAimControlling = false;
    /**距离下一发子弹的剩余冷却时间（秒） */
    private shootCooldownRemaining = 0;
    /**换弹按钮遮罩。 */
    private reloadMask: Sprite = null;
    /** 当前绑定 reload-start 事件的枪械节点。 */
    private reloadEventGunNode: Node = null;
    /**技能1按钮遮罩。 */
    private skill1Mask: Sprite = null;
    /**技能2按钮遮罩。 */
    private skill2Mask: Sprite = null;
    /**摇杆初始位置 */
    private rockerInitPos: Vec3 = new Vec3(200, -56, 0);
    /**临时敌人与玩家的水平间距，保持在自动瞄准范围内以便测试 */
    private readonly tempEnemyOffsetX = 150;
    /**第二个临时敌人相对第一个敌人的垂直间距 */
    private readonly tempEnemyOffsetY = 150;
    /**当前是否正在攻击瞄准 */
    private isAttackAiming = false;
    /**本轮持续攻击锁定的目标；离开检测范围后仍保留至松开攻击键 */
    private autoAttackTarget: enemyBaseController = null;
    /**非攻击状态下的角色朝向 */
    private normalFacingRight = false;
    /**地图层相机，用于把瓦片世界坐标转成屏幕坐标 */
    private gameCamera: Camera = null;
    /**地图层相机控制器 */
    private gameCameraComp: CameraController = null;
    /**UI层相机，用于把屏幕坐标转回UI世界坐标 */
    private uiCamera: Camera = null;
    /**游戏摄像机到UI摄像机的视角比例 */
    private gameToUICameraScale = 1;

    ///
    ///临时变量，不参与重新开始游戏数据恢复
    ///
    /**触摸点对应的地图世界坐标 */
    private tempTouchWorldPos: Vec3 = new Vec3();
    /**触摸点对应的地图节点本地坐标 */
    private tempTouchMapLocalPos: Vec3 = new Vec3();
    /**玩家每帧移动偏移 */
    private tempPlayerMoveOffset: Vec3 = new Vec3();
    /**手动瞄准摇杆当前方向。 */
    private manualAimDirection: Vec3 = new Vec3();
    /**游戏是否暂停 */
    private isGamePause = false;
    /**当前游戏局序号，用于避免异步加载回写旧局 */
    private openVersion = 0;
    /**当前播放中的伤害飘字节点。 */
    private damageFloatNodes: Set<Node> = new Set();
    /**伤害飘字坐标转换复用对象。 */
    private tempDamageFloatWorldPos: Vec3 = new Vec3();
    private tempDamageFloatLocalPos: Vec3 = new Vec3();
    private tempDamageFloatWorldScale: Vec3 = new Vec3();
    /** 当前与玩家重叠的容器 */
    private currentContainer: containerController = null;
    /**是否正在等待药品激励广告结果，防止大小药品按钮重复拉起广告。 */
    private isDrugAdWatching = false;
    /** 静态障碍物使用世界坐标缓存；仅在场景障碍物变化时重建。 */
    private staticColliders: StaticCollisionShape[] = [];
    private readonly collisionCellSize = 256;
    private collisionCells: Map<string, StaticCollisionShape[]> = new Map();
    private collisionQueryStamp = 0;
    private tempColliderLocalPoint = new Vec3();
    private tempColliderWorldPoint = new Vec3();

    protected onLoad(): void {
        this.bindBtn();
        this.initButtonMasks();
        this.updateSkill2RemainLab(0, false);
        this.initCamera();
        audioMgr.initSceneAudio(this.node);
    }

    async onUI_Open(data?: any) {
        ++this.openVersion;
        this.addListener();
        this.refreshAimingBtnDisplay();
        this.restartGame();
    }

    onUI_Close(): void {
        audioMgr.stopSceneEffects();
        // 先提升版本号，使本局尚未完成的异步地图加载结果失效
        this.openVersion++;
        this.removeListener();
        this.clearData();
    }

    /**重新开始单局 */
    private async restartGame() {
        // 每次重开都先作废上一局的异步任务并立即清场，不能等新地图加载完成后再清理
        let version = ++this.openVersion;
        this.clearData();
        pData.levelInit();

        if (version != this.openVersion || !this.node.activeInHierarchy) {
            return;
        }

        this.initData();
    }

    /**添加监听 */
    addListener() {
        gm.Event.on(GameEvent.refreshGameLevel, this.restartGame, this);
        gm.Event.on(GameEvent.refreshGameCamera, this.refreshGameCamera, this);
        gm.Event.on(GameEvent.gamePause, this.onGamePause, this);
        gm.Event.on(GameEvent.gameResume, this.onGameResume, this);
        // 监听键盘按下
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        // 监听触摸事件
        this.rockerTouchNode.on(NodeEventType.TOUCH_START, this.onTouchRockerStart, this);
        this.rockerTouchNode.on(NodeEventType.TOUCH_MOVE, this.onTouchRockerMove, this);
        this.rockerTouchNode.on(NodeEventType.TOUCH_END, this.onTouchRockerEnd, this);
        this.rockerTouchNode.on(NodeEventType.TOUCH_CANCEL, this.onTouchRockerEnd, this);
    }

    /**删除监听 */
    removeListener() {
        gm.Event.off(GameEvent.refreshGameLevel, this.restartGame, this);
        gm.Event.off(GameEvent.refreshGameCamera, this.refreshGameCamera, this);
        gm.Event.off(GameEvent.gamePause, this.onGamePause, this);
        gm.Event.off(GameEvent.gameResume, this.onGameResume, this);
        // 监听键盘按下
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        // 监听触摸事件
        this.rockerTouchNode.off(NodeEventType.TOUCH_START, this.onTouchRockerStart, this);
        this.rockerTouchNode.off(NodeEventType.TOUCH_MOVE, this.onTouchRockerMove, this);
        this.rockerTouchNode.off(NodeEventType.TOUCH_END, this.onTouchRockerEnd, this);
        this.rockerTouchNode.off(NodeEventType.TOUCH_CANCEL, this.onTouchRockerEnd, this);
    }

    bindBtn() {
        this.setBtn.addComponent(zoomButton).onClick = this.clickSetBtn.bind(this);
        const autoAimBtn = this.shootBtn.getChildByName("btn");
        autoAimBtn?.addComponent(zoomButton);
        autoAimBtn?.on(NodeEventType.TOUCH_START, this.onShootButtonStart, this);
        autoAimBtn?.on(NodeEventType.TOUCH_END, this.onShootButtonEnd, this);
        autoAimBtn?.on(NodeEventType.TOUCH_CANCEL, this.onShootButtonEnd, this);

        const aimingRocker = this.shootBtn.getChildByName("rocker");
        aimingRocker?.on(NodeEventType.TOUCH_START, this.onManualAimRockerStart, this);
        aimingRocker?.on(NodeEventType.TOUCH_MOVE, this.onManualAimRockerMove, this);
        aimingRocker?.on(NodeEventType.TOUCH_END, this.onManualAimRockerEnd, this);
        aimingRocker?.on(NodeEventType.TOUCH_CANCEL, this.onManualAimRockerEnd, this);
        this.reloadBtn.addComponent(zoomButton).onClick = this.clickReloadBtn.bind(this);
        this.skillBtn1.addComponent(zoomButton).onClick = this.clickSkillBtn1.bind(this);
        this.skillBtn2.addComponent(zoomButton).onClick = this.clickSkillBtn2.bind(this);
        this.knifeBtn.addComponent(zoomButton).onClick = this.clickKnifeBtn.bind(this);
        this.bagBtn.addComponent(zoomButton).onClick = this.clickBagBtn.bind(this);
        this.openBtn.addComponent(zoomButton).onClick = this.clickOpenContainerBtn.bind(this);
        this.aimingBtn.addComponent(zoomButton).onClick = this.clickAimingBtn.bind(this);
        this.drugBtn_0.addComponent(zoomButton).onClick = this.clickDrugBtn.bind(this, false);
        this.drugBtn_1.addComponent(zoomButton).onClick = this.clickDrugBtn.bind(this, true);

        this.weaponBox_0.on(NodeEventType.TOUCH_END, this.onClickWeaponBox_0, this);
        this.weaponBox_1.on(NodeEventType.TOUCH_END, this.onClickWeaponBox_1, this);
    }

    /**初始化游戏摄像机 */
    initCamera() {
        let gameCamera = this.node.getChildByName("gameCamera");
        this.gameCameraComp = gameCamera?.getComponent(CameraController);
        this.gameCamera = gameCamera?.getComponent(Camera);

        let canvas = director.getScene()?.getChildByName("Canvas")?.getComponent(Canvas);
        this.uiCamera = canvas?.cameraComponent;
        this.updateGameToUICameraScale();
    }

    /**记录游戏摄像机与UI摄像机的视角比例 */
    private updateGameToUICameraScale() {
        if (!this.gameCamera || !this.uiCamera || this.gameCamera.orthoHeight <= 0) {
            this.gameToUICameraScale = 1;
            return;
        }

        this.gameToUICameraScale = this.uiCamera.orthoHeight / this.gameCamera.orthoHeight;
    }

    initData() {
        /**清除数据 */
        this.clearData();

        this.rebuildStaticColliders();

        this.initRockerArea();
        this.initPlayer();
        this.initEnemy();
        this.refreshDrugButtons();
        this.updateContainerOpenButton();
    }

    clearData() {
        this.unscheduleAllCallbacks();
        this.gameCameraComp?.unlockCameraPos();
        this.setGameViewScale(1);
        this.isGamePause = false;
        this.isKeyboardAttackPressed = false;
        this.isShootButtonPressed = false;
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.shootCooldownRemaining = 0;
        this.clearCurrentGunReloadEvent();
        this.stopReloadMaskCooldown();
        this.stopSkillMaskCooldown();
        this.updateSkill2RemainLab(0, false);
        this.stopAutoAim();
        this.clearDamageFloats();
        if (this.openBtn) this.openBtn.active = false;
        this.currentContainer = null;
        this.staticColliders.length = 0;
        this.collisionCells.clear();
        this.isDrugAdWatching = false;

        ccTools.destroyAllChild(this.roleNode);

        playerMgr.clearPlayer();
        enemyMgr.enemyArr = [];
        enemyMgr.enemyId = 0;
        enemyMgr.enemyBornPosArr = [];
        this.rockerReset(true);
    }

    /** colliderList 的直属子节点：有 PolygonCollider2D 时取顶点，否则取 UITransform 矩形。 */
    rebuildStaticColliders() {
        this.staticColliders.length = 0;
        this.collisionCells.clear();
        if (!this.colliderList) return;

        for (const node of this.colliderList.children) {
            if (!node.activeInHierarchy) continue;
            const transform = node.getComponent(UITransform);
            if (!transform) continue;
            const polygon = node.getComponent(PolygonCollider2D);
            const points: Array<{ x: number; y: number }> = [];
            // 组件可以在编辑器中关闭物理计算，顶点仍作为静态数据读取。
            if (polygon && polygon.points.length >= 3) {
                for (const point of polygon.points) {
                    this.pushColliderWorldPoint(node, point.x + polygon.offset.x, point.y + polygon.offset.y, points);
                }
            } else {
                const left = -transform.width * transform.anchorX;
                const bottom = -transform.height * transform.anchorY;
                const right = left + transform.width;
                const top = bottom + transform.height;
                this.pushColliderWorldPoint(node, left, bottom, points);
                this.pushColliderWorldPoint(node, right, bottom, points);
                this.pushColliderWorldPoint(node, right, top, points);
                this.pushColliderWorldPoint(node, left, top, points);
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const point of points) {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            }
            if (minX >= maxX || minY >= maxY) continue;
            // 没有多边形组件的轴对齐节点只需矩形相交检测。
            const axisAligned = !polygon && points.every((point) =>
                (Math.abs(point.x - minX) < 0.001 || Math.abs(point.x - maxX) < 0.001)
                && (Math.abs(point.y - minY) < 0.001 || Math.abs(point.y - maxY) < 0.001));
            let twiceArea = 0;
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                twiceArea += a.x * b.y - b.x * a.y;
            }
            const winding = twiceArea >= 0 ? 1 : -1;
            const edges: StaticCollisionShape['edges'][number][] = [];
            for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length];
                const length = Math.hypot(b.x - a.x, b.y - a.y);
                if (length <= 0.0001) continue;
                const tx = (b.x - a.x) / length, ty = (b.y - a.y) / length;
                edges.push({ x: a.x, y: a.y, nx: winding * ty, ny: -winding * tx, tx, ty, length });
            }
            const shape: StaticCollisionShape = {
                minX, minY, maxX, maxY, points: axisAligned ? null : points, edges, queryStamp: 0,
            };
            this.staticColliders.push(shape);
            const startX = Math.floor(minX / this.collisionCellSize);
            const endX = Math.floor(maxX / this.collisionCellSize);
            const startY = Math.floor(minY / this.collisionCellSize);
            const endY = Math.floor(maxY / this.collisionCellSize);
            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const key = `${x},${y}`;
                    let cell = this.collisionCells.get(key);
                    if (!cell) this.collisionCells.set(key, cell = []);
                    cell.push(shape);
                }
            }
        }
    }

    private pushColliderWorldPoint(node: Node, x: number, y: number, points: Array<{ x: number; y: number }>) {
        this.tempColliderLocalPoint.set(x, y, 0);
        Vec3.transformMat4(this.tempColliderWorldPoint, this.tempColliderLocalPoint, node.worldMatrix);
        points.push({ x: this.tempColliderWorldPoint.x, y: this.tempColliderWorldPoint.y });
    }

    /** 按移动路径范围取候选；精确碰撞由 roleController 计算。 */
    queryStaticColliders(minX: number, minY: number, maxX: number, maxY: number, out: StaticCollisionShape[]) {
        out.length = 0;
        const stamp = ++this.collisionQueryStamp;
        const startX = Math.floor(minX / this.collisionCellSize);
        const endX = Math.floor(maxX / this.collisionCellSize);
        const startY = Math.floor(minY / this.collisionCellSize);
        const endY = Math.floor(maxY / this.collisionCellSize);
        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const cell = this.collisionCells.get(`${x},${y}`);
                if (!cell) continue;
                for (const shape of cell) {
                    if (shape.queryStamp === stamp || shape.maxX <= minX || shape.minX >= maxX
                        || shape.maxY <= minY || shape.minY >= maxY) continue;
                    shape.queryStamp = stamp;
                    out.push(shape);
                }
            }
        }
        return out;
    }

    /**根据玩家与容器的包围盒重合状态显示或隐藏开启按钮 */
    private updateContainerOpenButton() {
        if (!this.openBtn) return;

        const playerNode = playerMgr.player;
        // 角色根节点没有 UITransform，使用脚下阴影的包围盒作为交互范围。
        const playerTransform = playerNode?.getChildByName('shadow')?.getComponent(UITransform)
            ?? playerNode?.getComponent(UITransform);
        if (!playerTransform || !this.containerList) {
            this.openBtn.active = false;
            return;
        }

        const playerBounds = playerTransform.getBoundingBoxToWorld();
        this.currentContainer = null;
        for (const containerNode of this.containerList.children) {
            if (!containerNode.activeInHierarchy || !containerNode.getComponent(containerController)) {
                continue;
            }
            const containerTransform = containerNode.getComponent(UITransform);
            if (containerTransform && playerBounds.intersects(containerTransform.getBoundingBoxToWorld())) {
                this.currentContainer = containerNode.getComponent(containerController);
                break;
            }
        }

        if (this.openBtn.active !== !!this.currentContainer) {
            this.openBtn.active = !!this.currentContainer;
        }
    }

    /**初始化玩家 */
    initPlayer() {
        playerMgr.player = instantiate(this.rolePre);
        this.roleNode.addChild(playerMgr.player);
        playerMgr.cameraFollow = true;
        this.initRolePos(playerMgr.player);
        const roleComp = addRoleScript(playerMgr.player, pData.roleId);
        playerMgr.setPlayerComp(roleComp);
        roleComp.node.on('skill-cooldown-start', this.playSkillMaskCooldown, this);
        roleComp.node.on(role0Skill2RemainEvent, this.updateSkill2RemainLab, this);
        roleComp.init(this, pData.roleId, 0);
        this.refreshWeaponNames();
        this.refreshWeaponNums();
        this.bindCurrentGunReloadEvent();
        roleComp.onCurrentWeaponEquipped();
    }

    /** 武器切换后，将换弹 UI 事件绑定到当前枪械，并移除旧枪监听。 */
    private bindCurrentGunReloadEvent() {
        this.clearCurrentGunReloadEvent();
        const gunNode = playerMgr.playerComp?.gunController?.node ?? null;
        gunNode?.on('reload-start', this.playReloadMaskCooldown, this);
        gunNode?.on('ammo-change', this.refreshWeaponNums, this);
        this.reloadEventGunNode = gunNode;
        if (this.reloadBtn) this.reloadBtn.active = !!gunNode;
    }

    /** 安全移除旧枪的换弹事件；节点已销毁时不能再调用其 off。 */
    private clearCurrentGunReloadEvent() {
        if (this.reloadEventGunNode?.isValid) {
            this.reloadEventGunNode.off('reload-start', this.playReloadMaskCooldown, this);
            this.reloadEventGunNode.off('ammo-change', this.refreshWeaponNums, this);
        }
        this.reloadEventGunNode = null;
    }

    /**在玩家右侧生成两个仅播放待机动画的临时敌人，第二个在第一个上方 */
    private initEnemy() {
        if (!this.soldiersPre || !playerMgr.player) {
            return;
        }

        const playerPos = playerMgr.player.position;
        this.createTestEnemy(playerPos.x + this.tempEnemyOffsetX, playerPos.y);
        this.createTestEnemy(playerPos.x + this.tempEnemyOffsetX, playerPos.y + this.tempEnemyOffsetY);
    }

    /**创建并登记一个测试敌人 */
    private createTestEnemy(x: number, y: number) {
        let enemyNode = instantiate(this.soldiersPre);
        this.roleNode.addChild(enemyNode);
        let enemyComp: enemyBaseController = enemyNode.getComponent(enemyBaseController);
        const enemyId = enemyMgr.enemyId++;

        // 敌人不添加 AI；仅初始化外观、名称和满血状态。
        if (enemyComp) {
            enemyComp.init(this, enemyId, 0);
            enemyMgr.enemyArr.push(enemyComp);
        }

        enemyNode.setPosition(x, y, 0);
    }

    /**初始化角色位置 */
    initRolePos(node) {
        node.setPosition(Vec3.ZERO);
    }

    /**在受击目标头顶播放伤害飘字，动画结束后回收至标签对象池。 */
    showDamageFloat(targetNode: Node, damage: number) {
        if (!targetNode?.isValid || !Number.isFinite(damage) || damage <= 0
            || !this.gameUINode?.isValid || !uiMgr.gameLabelItemPrefab) {
            return;
        }

        const uiTransform = this.gameUINode.getComponent(UITransform);
        if (!uiTransform) return;

        const targetBodyNode = targetNode.getChildByName('roleAnim') || targetNode;
        targetBodyNode.updateWorldTransform();
        targetBodyNode.getWorldPosition(this.tempDamageFloatWorldPos);
        targetBodyNode.getWorldScale(this.tempDamageFloatWorldScale);
        const targetTransform = targetBodyNode.getComponent(UITransform);
        const targetHeight = targetTransform?.height ?? 100;
        const topOffset = targetHeight * (1 - (targetTransform?.anchorY ?? 0.5));
        // 以人物顶部向下 10 像素为飘字基准高度。
        this.tempDamageFloatWorldPos.y += topOffset * Math.abs(this.tempDamageFloatWorldScale.y) - 10;
        uiTransform.convertToNodeSpaceAR(this.tempDamageFloatWorldPos, this.tempDamageFloatLocalPos);

        const floatNode = poolMgr.getGameLabelNode(uiMgr.gameLabelItemPrefab);
        const label = poolMgr.getGameNodeLabel(floatNode);
        if (!label) {
            poolMgr.putGameLabelNode(floatNode);
            return;
        }

        this.gameUINode.addChild(floatNode);
        // 在人物中心横向 ±30 像素内生成；生成位置所在一侧决定后续斜飞方向。
        const spawnOffsetX = (Math.random() * 2 - 1) * 30;
        const flyDirection = spawnOffsetX < 0 ? -1 : 1;
        const flyOffsetX = flyDirection * (24 + Math.random() * 40);
        floatNode.setPosition(this.tempDamageFloatLocalPos.x + spawnOffsetX, this.tempDamageFloatLocalPos.y, 0);
        floatNode.setScale(0.8, 0.8, 1);
        label.string = `${Math.ceil(damage)}`;

        const opacity = floatNode.getComponent(UIOpacity) || floatNode.addComponent(UIOpacity);
        opacity.opacity = 255;
        this.damageFloatNodes.add(floatNode);
        tween(floatNode)
            .by(0.1, { position: new Vec3(flyOffsetX * 0.2, 16, 0), scale: new Vec3(0.3, 0.3, 0) })
            .by(0.5, { position: new Vec3(flyOffsetX * 0.8, 64, 0) }, { easing: 'quadOut' })
            .call(() => this.recycleDamageFloat(floatNode))
            .start();
        tween(opacity)
            .delay(0.1)
            .to(0.5, { opacity: 0 })
            .start();
    }

    /**回收单个伤害飘字。 */
    private recycleDamageFloat(floatNode: Node) {
        if (!this.damageFloatNodes.delete(floatNode)) return;
        poolMgr.putGameLabelNode(floatNode);
    }

    /**清理当前局尚未结束的伤害飘字。 */
    private clearDamageFloats() {
        for (const floatNode of this.damageFloatNodes) {
            poolMgr.putGameLabelNode(floatNode);
        }
        this.damageFloatNodes.clear();
    }

    /**初始化摇杆区域 */
    initRockerArea() {
        let visibleSize = view.getVisibleSize();
        let rockerTrans = this.rockerTouchNode.getComponent(UITransform);
        rockerTrans.setContentSize(visibleSize.width / 2 - 320, rockerTrans.height);
    }

    /**响应全局游戏暂停 */
    private onGamePause() {
        this.isGamePause = true;
        this.isKeyboardAttackPressed = false;
        this.isShootButtonPressed = false;
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.syncPlayerAttackHeldState();
        this.stopAutoAim();
        this.rockerReset(true);
    }

    /**响应全局游戏继续 */
    private onGameResume() {
        this.isGamePause = false;
    }

    /**摇杆归位 */
    rockerReset(clearKeyboard = false) {
        if (clearKeyboard) {
            this.pressedMoveKeys.clear();
        }
        this.isRockerControlling = false;
        this.inputMoveDirection.set(0, 0, 0);

        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");
        rockerNode.setPosition(this.rockerInitPos);
        rockerPoint.position = Vec3.ZERO;

        if (this.isMoveDirectionLocked()) return;
        if (!this.refreshKeyboardMove()) {
            this.isMoving = false;
            this.currentMoveDirection.set(0, 0, 0);
            playerMgr.playerComp?.playRoleAnim(roleAnimName.idle, true);
        }
    }

    protected update(dt: number): void {
        if (this.isGamePause) {
            return;
        }

        this.shootCooldownRemaining = Math.max(0, this.shootCooldownRemaining - dt);

        const moveDirectionLocked = this.isMoveDirectionLocked();
        if (this.wasMoveDirectionLocked && !moveDirectionLocked) {
            this.restoreMoveInputAfterDirectionUnlock();
        }
        this.wasMoveDirectionLocked = moveDirectionLocked;

        // 移动玩家（不使用vec3计算）
        if (this.isMoving) {
            let speed = playerMgr.playerComp.moveSpeed;
            if (!moveDirectionLocked) playerMgr.playerComp?.playRoleAnim(roleAnimName.move, true);
            //玩家移动
            this.tempPlayerMoveOffset.set(this.currentMoveDirection.x * speed * dt, this.currentMoveDirection.y * speed * dt, 0);

            // 攻击瞄准期间由目标决定人物朝向；其余时间跟随移动方向。
            if (!this.isAttackAiming && this.currentMoveDirection.x !== 0) {
                this.normalFacingRight = this.currentMoveDirection.x > 0;
                playerMgr.playerComp?.setFacingByHorizontal(this.normalFacingRight ? 1 : -1);
            }
            playerMgr.playerComp.moveWithStaticCollision(
                this.tempPlayerMoveOffset.x, this.tempPlayerMoveOffset.y, this.tempPlayerMoveOffset);
        }

        this.updateContainerOpenButton();

        if (this.isAttacking()) {
            if (pData.isAutoAiming) {
                this.refreshAutoAim();
            }
            this.shootEnemy(dt);
        }
    }

    /**摇杆区域点击开始 */
    onTouchRockerStart(event: EventTouch) {
        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");

        this.isRockerControlling = true;
        this.inputMoveDirection.set(0, 0, 0);
        if (this.isMoveDirectionLocked()) return;
        this.isMoving = false;
        this.currentMoveDirection.set(0, 0, 0);
        let worldPos = event.getUILocation();
        this.tempTouchWorldPos.set(worldPos.x, worldPos.y, 0);
        this.rockerTouchNode.getComponent(UITransform).convertToNodeSpaceAR(this.tempTouchWorldPos, this.tempTouchMapLocalPos);
        rockerNode.setPosition(this.tempTouchMapLocalPos);
        rockerPoint.position = Vec3.ZERO;
    }

    /**摇杆区域移动 */
    onTouchRockerMove(event: EventTouch) {
        const maxDistance = 34;
        const moveMultiplier = 4; // 移动倍数，可以根据需要调整
        let rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        let rockerPoint = rockerNode.getChildByName("rockerPoint");

        let worldPos = event.getUILocation();
        this.tempTouchWorldPos.set(worldPos.x, worldPos.y, 0);
        rockerNode.getComponent(UITransform).convertToNodeSpaceAR(this.tempTouchWorldPos, this.tempTouchMapLocalPos);

        let directionX = this.tempTouchMapLocalPos.x;
        let directionY = this.tempTouchMapLocalPos.y;
        // 直接使用数值计算方向与限位，避免触摸移动时反复clone Vec3
        let directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        let extendedLength = directionLength * moveMultiplier;
        let currentRatio = Math.min(extendedLength / maxDistance, 1);
        let clampedScale = directionLength > 0 ? Math.min(moveMultiplier, maxDistance / directionLength) : 0;

        let dirVec = ccTools.GetDir(0, 0, directionX, directionY);
        this.inputMoveDirection.set(dirVec.x * currentRatio, dirVec.y * currentRatio, 0);
        if (!this.isMoveDirectionLocked()) {
            this.isMoving = true;
            this.currentMoveDirection.set(this.inputMoveDirection);
        }

        // 设置摇杆点的位置
        rockerPoint.setPosition(directionX * clampedScale, directionY * clampedScale, 0);
    }

    /**摇杆区域点击结束 */
    onTouchRockerEnd(event: any) {
        this.rockerReset();
    }

    /**将当前 W/A/S/D 按键状态转换为最大幅度的摇杆方向 */
    private refreshKeyboardMove() {
        if (this.isRockerControlling) {
            return false;
        }

        const directionX = (this.pressedMoveKeys.has(KeyCode.KEY_D) ? 1 : 0) - (this.pressedMoveKeys.has(KeyCode.KEY_A) ? 1 : 0);
        const directionY = (this.pressedMoveKeys.has(KeyCode.KEY_W) ? 1 : 0) - (this.pressedMoveKeys.has(KeyCode.KEY_S) ? 1 : 0);
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength === 0) {
            return false;
        }

        const normalizedX = directionX / directionLength;
        const normalizedY = directionY / directionLength;
        this.inputMoveDirection.set(normalizedX, normalizedY, 0);
        if (this.isMoveDirectionLocked()) return true;
        this.currentMoveDirection.set(normalizedX, normalizedY, 0);
        this.isMoving = true;

        // 键盘输入时将摇杆点直接推至该方向的最边缘。
        const rockerNode = this.rockerTouchNode.getChildByName("rockerNode");
        const rockerPoint = rockerNode.getChildByName("rockerPoint");
        rockerNode.setPosition(this.rockerInitPos);
        rockerPoint.setPosition(normalizedX * 34, normalizedY * 34, 0);
        return true;
    }

    /**攻击期间优先锁定范围内最近的敌人；范围为空时保留本轮原锁定 */
    private refreshAutoAim() {
        const nearestTarget = playerMgr.playerComp?.findNearestEnemyInAttackRange();
        if (nearestTarget) {
            this.autoAttackTarget = nearestTarget;
        }

        if (!this.autoAttackTarget || !this.isValidAttackTarget(this.autoAttackTarget) || !playerMgr.player) {
            this.autoAttackTarget = null;
            this.isAttackAiming = false;
            // 本轮攻击未锁定目标时，不能沿用上一次攻击留下的目标坐标。
            playerMgr.playerComp?.clearGunAimTarget();
            return;
        }

        // 枪械对准目标坐标；刀只根据目标的左右方向调整人物朝向。
        this.isAttackAiming = playerMgr.playerComp?.aimGunAt(this.autoAttackTarget.node) ?? false;
    }

    /**锁定目标是否仍可攻击；锁定后不再受自动瞄准范围限制 */
    private isValidAttackTarget(target: enemyBaseController) {
        return !!target && target.node?.isValid && target.node.activeInHierarchy && target.hp > 0;
    }

    /**结束瞄准；仅在主动移动时恢复移动朝向，保留枪最后一次瞄准角度 */
    private stopAutoAim() {
        this.unschedule(this.stopAutoAim);
        this.isAttackAiming = false;
        this.autoAttackTarget = null;
        playerMgr.playerComp?.clearGunAimTarget();
        if (this.isMoving && this.currentMoveDirection.x !== 0) {
            this.normalFacingRight = this.currentMoveDirection.x > 0;
            playerMgr.playerComp?.setFacingByHorizontal(this.normalFacingRight ? 1 : -1);
        }
    }

    /**刷新游戏摄像机视角 */
    refreshGameCamera() {
        this.updateGameToUICameraScale();
    }

    /** 设置游戏地图的可视范围倍率；狙击枪装备时传入 1.2。 */
    setGameViewScale(scale: number) {
        this.gameCameraComp?.setViewScale(scale);
    }

    /**射击敌人  */
    shootEnemy(deltaTime = 0) {
        if (this.shootCooldownRemaining > 0) {
            return;
        }

        if (pData.isAutoAiming) {
            this.refreshAutoAim();
        }
        const roleComp = playerMgr.playerComp;
        // 手动瞄准的狙击枪只蓄力，松手时由 setAttackHeld 完成开火；自动模式维持蓄满即开火。
        if (!roleComp?.attack(deltaTime, pData.isAutoAiming)) {
            return;
        }

        this.refreshWeaponNums();

        const weaponComp = roleComp.weaponsController;
        if (weaponComp) {
            this.shootCooldownRemaining = weaponComp.attackInterval;
        }
    }

    /**初始化四个功能按钮的遮罩，开局不显示冷却状态。 */
    private initButtonMasks() {
        const buttons = [this.reloadBtn, this.skillBtn1, this.skillBtn2, this.knifeBtn];
        for (const button of buttons) {
            const mask = button?.getChildByName('mask')?.getComponent(Sprite) ?? null;
            if (!mask) continue;
            Tween.stopAllByTarget(mask);
            mask.fillRange = 0;
            if (button === this.reloadBtn) this.reloadMask = mask;
            if (button === this.skillBtn1) this.skill1Mask = mask;
            if (button === this.skillBtn2) this.skill2Mask = mask;
        }
    }

    /**根据角色技能2事件实时刷新倒计时；非 role0 或技能未生效时保持隐藏。 */
    private updateSkill2RemainLab(remainTime: number, isVisible: boolean) {
        if (!this.skill2RemainLab) return;
        this.skill2RemainLab.node.active = isVisible;
        if (isVisible) this.skill2RemainLab.string = `${Math.ceil(Math.max(0, remainTime))}`;
    }

    /**按角色技能配置的冷却时间播放对应按钮遮罩。 */
    private playSkillMaskCooldown(skillIndex: 1 | 2, cooldown: number) {
        const mask = skillIndex === 1 ? this.skill1Mask : this.skill2Mask;
        if (!mask) return;
        Tween.stopAllByTarget(mask);
        mask.fillRange = 1;
        if (cooldown > 0) {
            tween(mask).to(cooldown, { fillRange: 0 }).start();
        } else {
            mask.fillRange = 0;
        }
    }

    /**停止技能冷却补间并清空两个技能遮罩。 */
    private stopSkillMaskCooldown() {
        for (const mask of [this.skill1Mask, this.skill2Mask]) {
            if (!mask) continue;
            Tween.stopAllByTarget(mask);
            mask.fillRange = 0;
        }
    }

    /**使用换弹动画时长，让遮罩从满值直接补间至空值。 */
    private playReloadMaskCooldown(reloadTime: number) {
        // 只有枪械确认进入换弹后才打断，点击无效换弹不会中断打药。
        playerMgr.playerComp?.interruptDrugUse();
        if (!this.reloadMask) return;
        Tween.stopAllByTarget(this.reloadMask);
        this.reloadMask.fillRange = 1;
        if (reloadTime > 0) {
            tween(this.reloadMask).to(reloadTime, { fillRange: 0 }).start();
        } else {
            this.reloadMask.fillRange = 0;
        }
    }

    /**停止冷却补间并清空遮罩。 */
    private stopReloadMaskCooldown() {
        if (!this.reloadMask) return;
        Tween.stopAllByTarget(this.reloadMask);
        this.reloadMask.fillRange = 0;
    }

    /**是否正通过键盘或射击按钮持续攻击 */
    private isAttacking() {
        return this.isKeyboardAttackPressed || this.isShootButtonPressed;
    }

    /** 背包打开时不响应游戏键盘操作 */
    private isBackpackOpen() {
        return uiMgr.isPageOpen(UIPath.UIBackpack);
    }

    /** 打开背包时清除已按住的键盘移动与攻击状态 */
    private clearKeyboardGameInput() {
        this.pressedMoveKeys.clear();
        this.isKeyboardAttackPressed = false;
        // 清掉狙击枪蓄力，避免打开背包时同步松键导致开火。
        playerMgr.playerComp?.weaponsController?.node.getComponent(sniperController)?.cancelCharge();
        this.syncPlayerAttackHeldState();
        if (!this.isRockerControlling) {
            this.isMoving = false;
            this.currentMoveDirection.set(0, 0, 0);
            playerMgr.playerComp?.playRoleAnim(roleAnimName.idle, true);
        }
        if (!this.isAttacking()) this.stopAutoAim();
    }

    /**攻击按键状态变化时通知角色；不在 update 中重复刷新。 */
    private syncPlayerAttackHeldState() {
        const isAttacking = this.isAttacking();
        // 冷却期间仍记录按住状态，但狙击枪不应提前显示下一轮蓄力辅助线。
        const roleComp = playerMgr.playerComp;
        const isFiredOnRelease = roleComp?.setAttackHeld(
            isAttacking,
            !isAttacking || this.shootCooldownRemaining <= 0,
        );
        if (isFiredOnRelease) this.startCurrentWeaponAttackCooldown(roleComp);
    }

    /** 松手提前开火同样需要进入当前武器的攻击间隔。 */
    private startCurrentWeaponAttackCooldown(roleComp = playerMgr.playerComp) {
        const weaponComp = roleComp?.weaponsController;
        if (weaponComp) this.shootCooldownRemaining = weaponComp.attackInterval;
        this.refreshWeaponNums();
    }

    /**按装备栏主、副武器 id 刷新两个武器框名称。 */
    refreshWeaponNames() {
        const weaponBoxes = [this.weaponBox_0, this.weaponBox_1];
        weaponBoxes.forEach((weaponBox, slotIndex) => {
            const nameLab = weaponBox?.getChildByName('nameLab')?.getComponent(Label);
            if (!nameLab) return;
            const weaponData = weaponsConfig.getDataById(pData.equipmentIds[slotIndex]);
            nameLab.string = weaponData?.name ?? '';
        });
    }

    /**刷新主、副武器的当前弹匣数量，备用弹药显示为无限。 */
    refreshWeaponNums() {
        const weaponBoxes = [this.weaponBox_0, this.weaponBox_1];
        weaponBoxes.forEach((weaponBox, slotIndex) => {
            const numLab = weaponBox?.getChildByName('numLab')?.getComponent(Label);
            if (!numLab) return;
            const weapon = playerMgr.playerComp?.getWeaponController(slotIndex);
            const gun = weapon?.node.getComponent(gunController);
            numLab.string = `${gun?.ammo ?? 0}/∞`;
        });
    }

    /**射击按钮按下：立即尝试射击，按住期间由 update 持续射击 */
    private onShootButtonStart() {
        // 攻击输入按下即视为动作开始；狙击枪进入瞄准/蓄力时也应立即打断打药。
        playerMgr.playerComp?.interruptDrugUse();
        const wasAttacking = this.isAttacking();
        this.isShootButtonPressed = true;
        this.syncPlayerAttackHeldState();
        if (!wasAttacking && pData.isAutoAiming) {
            this.refreshAutoAim();
        }
        this.shootEnemy();
    }

    /**射击按钮松开或取消：停止持续射击 */
    private onShootButtonEnd() {
        this.isShootButtonPressed = false;
        this.syncPlayerAttackHeldState();
        if (!this.isAttacking()) {
            this.stopAutoAim();
        }
    }

    /**手动瞄准摇杆按下：确定方向后开始持续攻击。 */
    private onManualAimRockerStart(event: EventTouch) {
        if (pData.isAutoAiming) return;
        this.isManualAimControlling = true;
        this.updateManualAimDirection(event);
        this.onShootButtonStart();
    }

    /**手动瞄准摇杆移动：更新摇杆点和枪口方向。 */
    private onManualAimRockerMove(event: EventTouch) {
        if (!this.isManualAimControlling || pData.isAutoAiming) return;
        this.updateManualAimDirection(event);
    }

    /**手动瞄准摇杆松开：归位并停止攻击。 */
    private onManualAimRockerEnd() {
        if (!this.isManualAimControlling) return;
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.onShootButtonEnd();
    }

    /**根据手动瞄准摇杆触点更新枪口朝向。 */
    private updateManualAimDirection(event: EventTouch) {
        const aimingRocker = this.shootBtn?.getChildByName("rocker");
        const rockerPoint = aimingRocker?.getChildByName("rockerPoint");
        const rockerTransform = aimingRocker?.getComponent(UITransform);
        if (!aimingRocker || !rockerPoint || !rockerTransform) return;

        const touchPos = event.getUILocation();
        this.tempTouchWorldPos.set(touchPos.x, touchPos.y, 0);
        rockerTransform.convertToNodeSpaceAR(this.tempTouchWorldPos, this.tempTouchMapLocalPos);

        const directionX = this.tempTouchMapLocalPos.x;
        const directionY = this.tempTouchMapLocalPos.y;
        const directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        // 与移动摇杆保持一致的圆点最大偏移，摇杆本体不添加缩放效果。
        const maxDistance = 34;
        const positionScale = directionLength > 0 ? Math.min(1, maxDistance / directionLength) : 0;
        rockerPoint.setPosition(directionX * positionScale, directionY * positionScale, 0);
        if (directionLength === 0) return;

        this.manualAimDirection.set(directionX / directionLength, directionY / directionLength, 0);
        this.isAttackAiming = playerMgr.playerComp?.aimGunInDirection(this.manualAimDirection) ?? false;
    }

    /**将手动瞄准摇杆的摇杆点归位。 */
    private resetManualAimRocker() {
        const rockerPoint = this.shootBtn?.getChildByName("rocker")?.getChildByName("rockerPoint");
        rockerPoint?.setPosition(0, 0, 0);
    }

    /** 切换角色武器，并清除旧武器的瞄准和冷却状态。 */
    private switchWeapon(slotIndex: number) {
        const roleComp = playerMgr.playerComp;
        if (!roleComp?.equipWeapon(slotIndex)) return;
        this.shootCooldownRemaining = 0;
        if (this.isAttacking()) {
            // 枪械立即重算到目标的朝向和角度；刀会保留 equipWeapon 中同步的默认姿态。
            if (pData.isAutoAiming) {
                this.refreshAutoAim();
            } else if (this.isManualAimControlling) {
                this.isAttackAiming = roleComp.aimGunInDirection(this.manualAimDirection);
            }
        } else {
            this.stopAutoAim();
            roleComp.syncCurrentWeaponDefaultPose();
        }
        this.bindCurrentGunReloadEvent();
        roleComp.onCurrentWeaponEquipped();
    }

    /**供角色技能查询：当前是否正通过摇杆或方向键提供有效移动方向。 */
    hasMoveDirectionInput() {
        if (this.isRockerControlling) {
            return this.inputMoveDirection.x !== 0 || this.inputMoveDirection.y !== 0;
        }
        return this.pressedMoveKeys.size > 0 && (this.currentMoveDirection.x !== 0 || this.currentMoveDirection.y !== 0);
    }

    /**技能方向锁定结束后，立即按当前仍按住的输入恢复可控移动。 */
    private restoreMoveInputAfterDirectionUnlock() {
        if (this.isRockerControlling) {
            this.currentMoveDirection.set(this.inputMoveDirection);
            this.isMoving = this.inputMoveDirection.x !== 0 || this.inputMoveDirection.y !== 0;
            return;
        }
        if (!this.refreshKeyboardMove()) this.rockerReset();
    }

    /**当前角色是否正在锁定移动方向。 */
    private isMoveDirectionLocked() {
        return playerMgr.playerComp?.isMoveDirectionLocked ?? false;
    }

    /**刷新自动瞄准开关与射击按钮显示 */
    private refreshAimingBtnDisplay() {
        const aimingSelect = this.aimingBtn
            ?.getChildByName("aimingNode")
            ?.getChildByName("aimingSelect");
        if (aimingSelect) {
            const position = aimingSelect.position;
            aimingSelect.setPosition(pData.isAutoAiming ? -25 : 25, position.y, position.z);
        }

        // 自动瞄准使用普通射击按钮；手动瞄准时显示瞄准摇杆。
        const autoAimBtn = this.shootBtn?.getChildByName("btn");
        const aimingRocker = this.shootBtn?.getChildByName("rocker");
        if (autoAimBtn) {
            autoAimBtn.active = pData.isAutoAiming;
        }
        if (aimingRocker) {
            aimingRocker.active = !pData.isAutoAiming;
        }
    }

    ///
    ///点击函数
    ///

    /**监听按钮点击事件 */
    onKeyDown(event: EventKeyboard) {
        if (this.isBackpackOpen()) {
            if (event.keyCode === KeyCode.KEY_B) this.clickBagBtn();
            return;
        }

        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.KEY_A:
            case KeyCode.KEY_S:
            case KeyCode.KEY_D:
                this.pressedMoveKeys.add(event.keyCode);
                this.refreshKeyboardMove();
                break;
            case KeyCode.KEY_J: {
                // 键盘攻击按下即打断，包含狙击枪尚未开火的瞄准/蓄力阶段。
                playerMgr.playerComp?.interruptDrugUse();
                const wasAttacking = this.isAttacking();
                this.isKeyboardAttackPressed = true;
                this.syncPlayerAttackHeldState();
                if (!wasAttacking && pData.isAutoAiming) {
                    this.refreshAutoAim();
                }
                this.shootEnemy();
                break;
            }
            case KeyCode.KEY_R:
                // 主动换弹；枪械组件会自行拦截满弹或换弹中的重复请求。
                playerMgr.playerComp?.gunController?.reload();
                break;
            case KeyCode.KEY_P:
                this.clickAimingBtn();
                break;
            case KeyCode.DIGIT_1:
                this.switchWeapon(0);
                break;
            case KeyCode.DIGIT_2:
                this.switchWeapon(1);
                break;
            case KeyCode.DIGIT_3:
                this.switchWeapon(2);
                break;
            case KeyCode.SPACE:
                this.clickSkillBtn1();
                break;
            case KeyCode.KEY_K:
                this.clickSkillBtn2();
                break;
            case KeyCode.KEY_B:
                this.clickBagBtn();
                break;
            case KeyCode.KEY_F:
                if (this.openBtn?.activeInHierarchy) this.clickOpenContainerBtn();
                break;
        }
    }

    /**监听键盘松开，恢复剩余按键的方向或停止移动 */
    onKeyUp(event: EventKeyboard) {
        if (this.isBackpackOpen()) return;

        switch (event.keyCode) {
            case KeyCode.KEY_W:
            case KeyCode.KEY_A:
            case KeyCode.KEY_S:
            case KeyCode.KEY_D:
                this.pressedMoveKeys.delete(event.keyCode);
                if (!this.isRockerControlling && !this.refreshKeyboardMove()) {
                    this.rockerReset();
                }
                break;
            case KeyCode.KEY_J:
                this.isKeyboardAttackPressed = false;
                this.syncPlayerAttackHeldState();
                if (!this.isAttacking()) {
                    this.stopAutoAim();
                }
                break;
        }
    }

    /**点击换弹按钮 */
    clickReloadBtn() {
        // 主动换弹；枪械组件会自行拦截满弹或换弹中的重复请求。
        playerMgr.playerComp?.gunController?.reload();
    }

    /**点击技能按钮1 */
    clickSkillBtn1() {
        const roleComp = playerMgr.playerComp;
        if (roleComp?.useSkill1()) roleComp.interruptDrugUse();
    }

    /**点击技能按钮2 */
    clickSkillBtn2() {
        const roleComp = playerMgr.playerComp;
        if (roleComp?.useSkill2()) roleComp.interruptDrugUse();
    }

    /**点击小/大药品；库存为空时观看广告，成功后补充数量并自动使用一次。 */
    private clickDrugBtn(isBig: boolean) {
        const roleComp = playerMgr.playerComp;
        if (!roleComp || roleComp.usingDrug) return;

        if (this.getDrugCount(isBig) > 0) {
            this.startUseDrug(isBig);
            return;
        }
        if (this.isDrugAdWatching) return;

        this.isDrugAdWatching = true;
        const gameVersion = this.openVersion;
        videoMgr.watchVideo(68, () => {
            this.isDrugAdWatching = false;
            const rewardCount = isBig ? configData.drugDrugAdCountBig : configData.drugDrugAdCount;
            this.setDrugCount(isBig, this.getDrugCount(isBig) + Math.max(0, rewardCount));
            this.refreshDrugButtons();
            if (gameVersion === this.openVersion && this.node.activeInHierarchy) this.startUseDrug(isBig);
        }, () => {
            this.isDrugAdWatching = false;
        });
    }

    /**开始打药；药品仅在完整读条结束后扣除，被动作打断不会消耗。 */
    private startUseDrug(isBig: boolean) {
        if (this.getDrugCount(isBig) <= 0) return false;
        const roleComp = playerMgr.playerComp;
        const useTime = isBig ? configData.drugDrugUseTimeBig : configData.drugDrugUseTime;
        const healPercent = isBig ? configData.drugDrugHpBig : configData.drugDrugHp;
        return roleComp?.useDrug(useTime, healPercent, () => {
            this.setDrugCount(isBig, this.getDrugCount(isBig) - 1);
            this.refreshDrugButtons();
        }) ?? false;
    }

    /**刷新两个药品按钮的数量/广告状态。 */
    private refreshDrugButtons() {
        this.refreshDrugButton(this.drugBtn_0, pData.drugDrugCount);
        this.refreshDrugButton(this.drugBtn_1, pData.drugDrugCountBig);
    }

    private refreshDrugButton(button: Node, count: number) {
        const availableCount = Math.max(0, Math.floor(count));
        const numNode = button?.getChildByName('numNode');
        const adNode = button?.getChildByName('ad');
        if (numNode) numNode.active = availableCount > 0;
        if (adNode) adNode.active = availableCount <= 0;
        const numLab = numNode?.getChildByName('numLab')?.getComponent(Label);
        if (numLab) numLab.string = `${availableCount}`;
    }

    private getDrugCount(isBig: boolean) {
        return isBig ? pData.drugDrugCountBig : pData.drugDrugCount;
    }

    private setDrugCount(isBig: boolean, count: number) {
        const validCount = Math.max(0, Math.floor(count));
        if (isBig) {
            pData.drugDrugCountBig = validCount;
        } else {
            pData.drugDrugCount = validCount;
        }
    }

    /**点击刀按钮 */
    clickKnifeBtn() {
        this.switchWeapon(2);
    }

    /**点击背包按钮 */
    clickBagBtn() {
        if (uiMgr.isPageOpen(UIPath.UIBackpack)) {
            uiMgr.closePage(UIPath.UIBackpack);
            return;
        }
        this.clearKeyboardGameInput();
        uiMgr.openPage(UIPath.UIBackpack);
    }

    /**点击打开容器按钮 */
    clickOpenContainerBtn() {
        if (!this.currentContainer) return;
        this.clearKeyboardGameInput();
        uiMgr.openPage(UIPath.UIBackpack, {
            showSearchNode: true,
            itemData: this.currentContainer.getItemData(),
            revealedItemStates: this.currentContainer.getRevealedItemStates(),
        });
    }

    /**点击武器框0 */
    onClickWeaponBox_0() {
        this.switchWeapon(0);
        return;
    }

    /**点击武器框1 */
    onClickWeaponBox_1() {
        this.switchWeapon(1);
        return;
    }

    /**点击自动瞄准按钮 */
    clickAimingBtn() {
        pData.setAutoAiming(!pData.isAutoAiming);
        this.isManualAimControlling = false;
        this.manualAimDirection.set(0, 0, 0);
        this.resetManualAimRocker();
        this.refreshAimingBtnDisplay();
        this.stopAutoAim();
    }

    /**点击设置按钮 */
    clickSetBtn() {
        uiMgr.openPage(UIPath.UISetting, { mode: 1 });
        gm.gamePause();
    }
}
