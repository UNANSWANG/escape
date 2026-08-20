import { _decorator, Node, Animation, Color, Label, sp, Sprite, SpriteFrame } from 'cc';
import { UIBase } from './UIBase';
import { audioPath, imgPath, spinePath, UIPath } from '../manager/pathConfig';
import { uiMgr } from '../manager/UIManager';
import { zoomButton } from '../extention/zoomButton';
import { configData } from '../manager/configData';
import { pData } from '../manager/playerData';
import { ccTools } from '../extention/generalTools';
import { roleSkinConfig } from '../json/jsonRoleSkin';
import { nicknameConfig } from '../json/jsonNickname';
import { audioMgr } from '../manager/audioManager';
const { ccclass, property } = _decorator;

type MatchTarget = {
    node: Node;
    type: "role" | "enemy";
    roleIndex?: number;
};

@ccclass('UIMatch')
export class UIMatch extends UIBase {
    @property(Node)
    closeBtn: Node;

    @property(Node)
    readyBtn: Node;

    @property(Node)
    readyedBtn: Node;

    @property(Label)
    timeLab: Label;

    @property(Label)
    titleLab: Label;

    @property(Node)
    enemyItem: Node;

    @property(Node)
    roleLayout: Node;

    /**匹配经过时间 */
    private matchTime = 0;
    /**当前匹配项剩余等待时间 */
    private currentMatchDelay = 0;
    /**当前待匹配项索引 */
    private currentMatchIndex = 0;
    /**是否正在匹配人机 */
    private isMatching = false;
    /**玩家是否已准备 */
    private isReady = false;
    /**是否正在进入游戏 */
    private isOpeningGame = false;
    /**游戏资源是否预加载完成 */
    private isGamePreloadComplete = false;
    /**预加载回调序号，用于忽略页面关闭后的旧回调 */
    private gamePreloadVersion = 0;
    /**待匹配项，包含一个敌人和五个机器人 */
    private matchTargets: MatchTarget[] = [];
    /**五个机器人的皮肤，索引与游戏内机器人顺序一致 */
    private roleSkinIds: number[] = [];
    /**五个机器人的昵称，索引与皮肤和游戏内机器人顺序一致 */
    private roleNicknames: string[] = [];
    /**敌人皮肤 */
    private enemySkinId = 0;
    /**敌人昵称 */
    private enemyNickname = "";
    /**本次匹配可随机使用的昵称池 */
    private nicknamePool: string[] = [];
    /**预制体默认的未知角色图片 */
    private unknownRoleSpriteFrame: SpriteFrame = null;
    /**玩家名称颜色 #F1DA2F */
    private playerNameColor = new Color(241, 218, 47, 255);
    /**人机名称颜色 #C9D1DC */
    private robotNameColor = new Color(201, 209, 220, 255);

    protected onLoad(): void {
        this.unknownRoleSpriteFrame = this.roleLayout.children[0]?.getChildByName("roleImg")?.getComponent(Sprite)?.spriteFrame || null;
        this.bindBtn();
    }

    onUI_Open() {
        let anim = this.getComponent(Animation);
        anim.play();
        this.initData();
        this.preLoadGame();
    }

    initData() {
        this.matchTime = 0;
        this.currentMatchIndex = 0;
        this.currentMatchDelay = 0;
        this.isMatching = false;
        this.isReady = false;
        this.isOpeningGame = false;
        this.isGamePreloadComplete = false;
        this.matchTargets = [];
        this.roleSkinIds = [];
        this.roleNicknames = [];
        this.enemyNickname = "";
        this.nicknamePool = [];

        this.readyBtn.active = true;
        this.readyedBtn.active = false;
        
        this.refreshTimeLab();

        let roleNodes = this.roleLayout.children;
        for (let i = 0; i < roleNodes.length; i++) {
            let roleImg = roleNodes[i].getChildByName("roleImg")?.getComponent(Sprite);
            if (roleImg && this.unknownRoleSpriteFrame) {
                roleImg.spriteFrame = this.unknownRoleSpriteFrame;
                roleImg.node.setScale(1, 1, 1);
            }
            let selectNode = roleNodes[i].getChildByName("select");
            if (selectNode) {
                selectNode.active = false;
            }
            let nameLab = roleNodes[i].getChildByName("nameLab")?.getComponent(Label);
            if (nameLab) {
                nameLab.string = "???";
                nameLab.color = this.robotNameColor;
            }
        }

        let enemyImgNode = this.enemyItem.getChildByName("roleImg");
        if (enemyImgNode) {
            enemyImgNode.active = true;
        }
        let bossNode = this.enemyItem.getChildByName("bossNode");
        let bossAnimNode = bossNode?.getChildByName("bossAnim");
        let bossAnim = bossAnimNode?.getComponent(sp.Skeleton);
        if (bossAnim) {
            ccTools.cancelAssetLoad(bossAnim);
            bossAnim.skeletonData = null;
        }
        if (bossNode) {
            bossNode.active = false;
        }
        let enemyNameLab = this.enemyItem.getChildByName("nameLab")?.getComponent(Label);
        if (enemyNameLab) {
            enemyNameLab.string = "???";
        }

        if (roleNodes.length <= 0) {
            console.error("匹配界面没有角色位置");
            return;
        }

        // 玩家进入界面后立即随机到六个位置中的一个。
        let playerIndex = ccTools.getRandomNum(0, roleNodes.length);
        let playerNode = roleNodes[playerIndex];
        let playerImg = playerNode.getChildByName("roleImg")?.getComponent(Sprite);
        if (playerImg) {
            playerImg.node.setScale(0.7, 0.7, 1);
            ccTools.loadImg(playerImg, imgPath.roleBodyFull + pData.skinId);
        }
        let playerSelect = playerNode.getChildByName("select");
        if (playerSelect) {
            playerSelect.active = true;
        }
        let playerNameLab = playerNode.getChildByName("nameLab")?.getComponent(Label);
        if (playerNameLab) {
            playerNameLab.string = "你";
            playerNameLab.color = this.playerNameColor;
        }

        let roleIndex = 0;
        for (let i = 0; i < roleNodes.length; i++) {
            if (i == playerIndex) {
                continue;
            }
            this.matchTargets.push({
                node: roleNodes[i],
                type: "role",
                roleIndex: roleIndex++,
            });
        }
        this.matchTargets.push({ node: this.enemyItem, type: "enemy" });
        ccTools.shuffleArray(this.matchTargets);
        this.initNicknamePool();

        this.isMatching = this.matchTargets.length > 0;
        if (this.isMatching) {
            this.currentMatchDelay = this.getRandomMatchDelay();
        }
    }

    /**为本次匹配创建去重后的临时昵称池 */
    private initNicknamePool() {
        let nicknameSet = new Set<string>();
        let nicknameData = nicknameConfig.roleNicknameAllData || [];
        for (let i = 0; i < nicknameData.length; i++) {
            let nickname = nicknameData[i]?.nickname?.trim();
            if (nickname) {
                nicknameSet.add(nickname);
            }
        }

        this.nicknamePool = Array.from(nicknameSet);

        if (this.nicknamePool.length < this.matchTargets.length) {
            console.error("昵称表中的不重复昵称不足，无法为全部人机分配昵称");
        }
    }

    /**随机获取昵称并从本局昵称池移除，保证本局不重复 */
    private getRandomNickname() {
        if (this.nicknamePool.length <= 0) {
            return "";
        }
        let randomIndex = ccTools.getRandomNum(0, this.nicknamePool.length);
        return this.nicknamePool.splice(randomIndex, 1)[0];
    }

    /**在匹配期间预加载游戏资源 */
    private preLoadGame() {
        let version = ++this.gamePreloadVersion;
        uiMgr.preLoadGame().then(() => {
            if (version != this.gamePreloadVersion || !this.node.activeInHierarchy) {
                return;
            }
            this.isGamePreloadComplete = true;
            this.tryOpenGame();
        }).catch((error) => {
            if (version == this.gamePreloadVersion) {
                console.error("游戏资源预加载失败", error);
            }
        });
    }

    protected update(dt: number): void {
        if (!this.isMatching) {
            return;
        }

        this.matchTime += dt;
        this.currentMatchDelay -= dt;
        this.refreshTimeLab();

        if (this.currentMatchDelay > 0) {
            return;
        }

        this.finishCurrentMatch();
        this.currentMatchIndex++;
        if (this.currentMatchIndex >= this.matchTargets.length) {
            this.isMatching = false;
            this.scheduleOnce(() => {
                this.tryOpenGame();
            }, 1);
            return;
        }

        this.currentMatchDelay = this.getRandomMatchDelay();
    }

    /**随机一个单项匹配等待时间 */
    private getRandomMatchDelay() {
        let min = Math.max(0, Number(configData.roleMatchTime?.[0]) || 0);
        let max = Math.max(min, Number(configData.roleMatchTime?.[1]) || min);
        return min + Math.random() * (max - min);
    }

    /**完成当前人机或敌人的匹配 */
    private finishCurrentMatch() {
        let target = this.matchTargets[this.currentMatchIndex];
        if (!target) {
            return;
        }

        let nameLab = target.node.getChildByName("nameLab")?.getComponent(Label);
        let nickname = this.getRandomNickname();
        if (nameLab && nickname) {
            nameLab.string = nickname;
        }

        if (target.type == "enemy") {
            this.enemySkinId = ccTools.getRandomNum(0, configData.enemySkinCount);
            this.enemyNickname = nickname;
            this.showBossAnim(target.node, this.enemySkinId);
            return;
        }

        let roleImg = target.node.getChildByName("roleImg")?.getComponent(Sprite);
        if (!roleImg) {
            return;
        }

        let skinData = roleSkinConfig.roleSkinAllData || [];
        let skinId = skinData.length > 0
            ? skinData[ccTools.getRandomNum(0, skinData.length)].skinId
            : ccTools.getRandomNum(0, configData.roleSkinCount);
        this.roleSkinIds[target.roleIndex] = skinId;
        this.roleNicknames[target.roleIndex] = nickname;
        roleImg.node.setScale(0.7, 0.7, 1);
        ccTools.loadImg(roleImg, imgPath.roleBodyFull + skinId);
    }

    /**Boss匹配完成后隐藏图片并播放待机动画 */
    private async showBossAnim(enemyNode: Node, skinId: number) {
        let roleImgNode = enemyNode.getChildByName("roleImg");
        let bossNode = enemyNode.getChildByName("bossNode");
        let bossAnimNode = bossNode?.getChildByName("bossAnim");
        let bossAnim = bossAnimNode?.getComponent(sp.Skeleton);
        if (roleImgNode) {
            roleImgNode.active = false;
        }
        if (!bossNode || !bossAnimNode || !bossAnim) {
            console.error("匹配界面没有找到bossAnim节点或Skeleton组件");
            return;
        }

        let bossScale = skinId == 2 ? 2.6 : 3;
        bossNode.setScale(bossScale, bossScale, 1);
        bossNode.active = true;
        bossAnim.skeletonData = null;
        let isLoaded = await ccTools.loadSpine(bossAnim, spinePath.boss + skinId);
        if (!isLoaded || !bossNode.activeInHierarchy) {
            return;
        }

        bossAnim.setAnimation(0, "idle", true);
    }

    /**刷新匹配耗时，匹配完成后不再调用以保持最终时间 */
    private refreshTimeLab() {
        this.timeLab.string = this.matchTime < 1
            ? "匹配中..."
            : `匹配中${Math.floor(this.matchTime)}s`;
    }

    bindBtn() {
        this.closeBtn.addComponent(zoomButton).onClick = this.clickCloseBtn.bind(this);
        let readyComp = this.readyBtn.addComponent(zoomButton);
        readyComp.onClick = this.clickReadyBtn.bind(this);
        readyComp.setPlayClickSound(false);
    }

    openGame() {
        uiMgr.startGame({
            roleSkinIds: this.roleSkinIds.concat(),
            roleNicknames: this.roleNicknames.concat(),
            enemySkinId: this.enemySkinId,
            enemyNickname: this.enemyNickname,
        });
        this.onClose();
    }

    /**准备、匹配和游戏资源预加载全部完成后进入游戏 */
    private tryOpenGame() {
        if (!this.isReady || this.isMatching || !this.isGamePreloadComplete || this.isOpeningGame) {
            return;
        }
        this.isOpeningGame = true;
        this.openGame();
    }

    ///
    ///点击事件
    ///

    /**点击关闭 */
    clickCloseBtn() {
        this.onClose();
        //匹配页由关闭按钮退出时回到主页并触发列车进站；进入游戏的关闭流程不会调用这里。
        uiMgr.openPage(UIPath.UIMain);
    }

    /**点击准备 */
    clickReadyBtn() {
        if (this.isReady) {
            return;
        }

        audioMgr.playEffect(audioPath.clickPrepare);
        this.isReady = true;
        this.readyBtn.active = false;
        this.readyedBtn.active = true;
        this.tryOpenGame();
    }

    onUI_Close() {
        this.gamePreloadVersion++;
        this.isMatching = false;
        this.isGamePreloadComplete = false;
        let bossAnim = this.enemyItem?.getChildByName("bossNode").getChildByName("bossAnim")?.getComponent(sp.Skeleton);
        if (bossAnim) {
            ccTools.cancelAssetLoad(bossAnim);
        }
    }

    onClose() {
        uiMgr.closePage(UIPath.UIMatch);
    }
}
