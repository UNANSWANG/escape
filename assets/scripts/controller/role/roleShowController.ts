import { _decorator, Component, Node, sp, Sprite, UITransform, Vec3 } from 'cc';
import { ccStorageTools } from '../../extention/storageTools';
import { GameEvent, SaveKey } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { ccTools } from '../../extention/generalTools';
import { weaponsConfig } from '../../json/jsonWeapons';
import { equipmentConfig } from '../../json/jsonEquipment';
import { pData } from '../../manager/playerData';
import { imgPath, spinePath } from '../../manager/pathConfig';
const { ccclass } = _decorator;

@ccclass('roleShowController')
export class roleShowController extends Component {
    /** 当前展示的是否为玩家自身数据。 */
    private isPlayerData = true;
    /** 是否显示头盔和护甲，不影响武器。 */
    private showEquipment = true;
    private displayRoleId = 0;
    /** 商城预览角色独立指定，装备仍可沿用玩家数据。 */
    private previewRoleId: number = null;
    private loadedAppearanceRoleId: number = null;
    private appearanceLoad: { roleId: number; promise: Promise<void> } = null;
    /** AI 展示使用独立的头盔、护甲 itemId。 */
    private displayEquipmentIds: number[] = [-1, -1, -1, -1, -1];
    /** AI 展示使用独立武器 itemId；玩家按主武器、副武器、近战的顺序展示。 */
    private displayWeaponId = -1;
    private loadedWeaponId: number = null;
    private roleAnim: sp.Skeleton = null;
    private weaponNode: Node = null;
    private weaponSocketBone: any = null;
    private tempSocketLocalPos = new Vec3();
    private tempSocketWorldPos = new Vec3();
    private tempSocketParentLocalPos = new Vec3();

    /** 控制头盔和护甲显示，武器保持正常显示。 */
    setShowEquipment(visible: boolean): void {
        if (this.showEquipment === visible) return;
        this.showEquipment = visible;
        this.refreshEquipmentDisplay();
    }

    /** 设置独立展示的角色，匹配 AI 时不读取玩家角色。 */
    setRoleId(roleId: number): void {
        this.displayRoleId = roleId;
        this.refreshRoleSpine();
    }

    /** 设置商城当前浏览的角色，不改变玩家出战角色和装备来源。 */
    setPreviewRoleId(roleId: number): void {
        this.previewRoleId = roleId;
        this.refreshRoleSpine();
    }

    /** 同一角色复用外观和进行中的请求，重复显示不会重载 Spine 或左右手。 */
    refreshRoleSpine(): Promise<void> {
        const roleId = this.previewRoleId ?? (this.isPlayerData ? pData.roleId : this.displayRoleId);
        if (this.appearanceLoad?.roleId === roleId) return this.appearanceLoad.promise;
        if (!this.appearanceLoad && this.loadedAppearanceRoleId === roleId) return Promise.resolve();
        this.loadedAppearanceRoleId = null;
        const promise = this.loadRoleAppearance(roleId).then(() => {
            if (this.appearanceLoad?.promise === promise) this.appearanceLoad = null;
        }, (error) => {
            if (this.appearanceLoad?.promise === promise) this.appearanceLoad = null;
            throw error;
        });
        this.appearanceLoad = { roleId, promise };
        return promise;
    }

    /** 初始化或更换角色时，一起加载 Spine 和左右手图片。 */
    private async loadRoleAppearance(roleId: number): Promise<void> {
        const skeleton = this.node.getChildByName('roleAnim')?.getComponent(sp.Skeleton);
        if (!skeleton) return;
        const animation = skeleton.getCurrent(0)?.animation?.name || 'idle';
        this.weaponSocketBone = null;
        const weaponNode = this.node.getChildByName('weapon');
        const [loaded] = await Promise.all([
            ccTools.loadSpine(skeleton, spinePath.role + roleId),
            ccTools.loadImg(weaponNode?.getChildByPath('left/img')?.getComponent(Sprite), imgPath.roleLeftHand + roleId),
            ccTools.loadImg(weaponNode?.getChildByPath('right/img')?.getComponent(Sprite), imgPath.roleRightHand + roleId),
        ]);
        if (!loaded || !this.isValid || this.appearanceLoad?.roleId !== roleId) return;
        this.loadedAppearanceRoleId = roleId;
        skeleton.setAnimation(0, skeleton.findAnimation(animation) ? animation : 'idle', true);
        this.bindWeaponToRole(skeleton);
    }

    private onRoleChanged(): void {
        if (this.isPlayerData && this.previewRoleId === null) this.refreshRoleSpine();
    }

    /** 切换展示数据来源时同步刷新装备显示。 */
    setIsPlayerData(isPlayerData: boolean): void {
        this.isPlayerData = isPlayerData;
        this.refreshRoleSpine();
        this.refreshEquipmentDisplay();
        this.refreshWeaponSpine();
    }

    setEquipmentIds(helmetId: number, armorId: number): void {
        this.displayEquipmentIds[3] = helmetId;
        this.displayEquipmentIds[4] = armorId;
        this.refreshEquipmentDisplay();
    }

    setWeaponId(weaponId: number): void {
        this.displayWeaponId = weaponId;
        this.refreshWeaponSpine();
    }

    private get currentWeaponId(): number {
        return this.isPlayerData ? (pData.equipmentIds.slice(0, 3).find(id => id >= 0) ?? -1) : this.displayWeaponId;
    }

    /** 按武器 itemId 查找配置；连续换装由 loadSpine 的请求版本保证顺序。 */
    async refreshWeaponSpine(): Promise<void> {
        const skeleton = this.node.getChildByName('weapon')?.getComponent(sp.Skeleton);
        if (!skeleton) return;
        const weaponId = this.currentWeaponId;
        this.loadedWeaponId = weaponId;
        ccTools.cancelAssetLoad(skeleton);
        skeleton.skeletonData = null;
        const weaponData = weaponsConfig.getDataByItemId(weaponId);
        skeleton.node.active = !!weaponData;
        if (!weaponData) return;
        const rightNode = skeleton.node.getChildByName('right');
        if (rightNode) rightNode.active = weaponData.type !== 0;
        const loaded = await ccTools.loadSpine(skeleton, spinePath.weapon + weaponData.itemId);
        if (loaded) skeleton.setAnimation(0, 'idle', true);
    }

    private onTableLoad(tableName: string): void {
        if (tableName === 'weapons') this.refreshWeaponSpine();
        if (tableName === 'equipment') this.refreshEquipmentDisplay();
    }

    protected onLoad(): void {
        this.refreshEquipmentDisplay();
        gm.Event.on(GameEvent.refreshEquipmentDisplay, this.refreshEquipmentDisplay, this);
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
        gm.Event.on(GameEvent.refreshRoleSkin, this.onRoleChanged, this);
    }

    /**每次显示角色时，角色和展示武器都默认循环播放待机动画。 */
    protected onEnable(): void {
        this.refreshRoleSpine();
        this.refreshEquipmentDisplay();
        this.refreshWeaponSpine();
        for (const name of ['roleAnim', 'weapon']) {
            const skeleton = this.node.getChildByName(name)?.getComponent(sp.Skeleton);
            if (skeleton?.skeletonData) skeleton.setAnimation(0, 'idle', true);
        }
    }

    protected onDestroy(): void {
        gm.Event.off(GameEvent.refreshEquipmentDisplay, this.refreshEquipmentDisplay, this);
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
        gm.Event.off(GameEvent.refreshRoleSkin, this.onRoleChanged, this);
    }

    /** 玩家自身跟随仓库装备显示设置，AI 始终显示装备图片。 */
    private refreshEquipmentDisplay(): void {
        const equipmentIds = this.isPlayerData ? pData.equipmentIds : this.displayEquipmentIds;
        const isVisible = this.showEquipment && (!this.isPlayerData || ccStorageTools.getNumberData(SaveKey.isShowEquipment) !== 1);
        const roleAnimNode = this.node.getChildByName('roleAnim');
        ['head', 'armor'].forEach((name, index) => {
            const sprite = roleAnimNode?.getChildByName(name)?.getChildByName('img')?.getComponent(Sprite);
            if (!sprite) return;
            const equipmentData = equipmentConfig.getDataByItemId(equipmentIds[index + 3]);
            ccTools.cancelAssetLoad(sprite);
            sprite.spriteFrame = null;
            sprite.node.active = isVisible && !!equipmentData;
            if (isVisible && equipmentData) ccTools.loadImg(sprite, imgPath.equipment + equipmentData.itemId);
        });
    }

    protected start(): void {
        this.bindWeaponToRole();
    }

    /** 将 weapon 节点绑定到角色 Spine 的 weapons 挂点；更换角色骨骼后需重新调用。 */
    bindWeaponToRole(roleAnim: sp.Skeleton = this.node.getChildByName('roleAnim')?.getComponent(sp.Skeleton)) {
        this.roleAnim = roleAnim;
        this.weaponNode = this.node.getChildByName('weapon');
        this.weaponSocketBone = this.roleAnim?.findBone('weapons') ?? null;
        if (!this.weaponNode || !this.weaponSocketBone) return false;
        this.syncWeaponPosition();
        return true;
    }

    protected lateUpdate(): void {
        if (this.currentWeaponId !== this.loadedWeaponId) this.refreshWeaponSpine();
        // 骨骼数据尚未准备好时继续尝试绑定，兼容异步加载的展示角色。
        if (!this.weaponSocketBone) {
            this.bindWeaponToRole(this.roleAnim ?? undefined);
            return;
        }
        this.syncWeaponPosition();
    }

    /** 同步挂点位置，保留展示武器自身的旋转和缩放。 */
    private syncWeaponPosition(): void {
        if (!this.weaponSocketBone || !this.roleAnim?.node?.isValid || !this.weaponNode?.isValid || !this.weaponNode.parent) return;
        this.roleAnim.node.updateWorldTransform();
        this.tempSocketLocalPos.set(this.weaponSocketBone.worldX, this.weaponSocketBone.worldY, 0);
        Vec3.transformMat4(this.tempSocketWorldPos, this.tempSocketLocalPos, this.roleAnim.node.worldMatrix);
        const parentTransform = this.weaponNode.parent.getComponent(UITransform);
        if (parentTransform) {
            parentTransform.convertToNodeSpaceAR(this.tempSocketWorldPos, this.tempSocketParentLocalPos);
            this.weaponNode.setPosition(this.tempSocketParentLocalPos);
        } else {
            this.weaponNode.setWorldPosition(this.tempSocketWorldPos);
        }
    }
}
