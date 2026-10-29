import { _decorator, Component, Node, sp, UITransform, Vec3 } from 'cc';
import { ccStorageTools } from '../../extention/storageTools';
import { GameEvent, SaveKey } from '../../manager/configData';
import { gm } from '../../manager/gm';
import { ccTools } from '../../extention/generalTools';
import { weaponsConfig } from '../../json/jsonWeapons';
import { pData } from '../../manager/playerData';
import { spinePath } from '../../manager/pathConfig';
const { ccclass } = _decorator;

@ccclass('roleShowController')
export class roleShowController extends Component {
    /** 当前展示的是否为玩家自身数据。 */
    private isPlayerData = true;

    /** 切换展示数据来源时同步刷新装备显示。 */
    setIsPlayerData(isPlayerData: boolean): void {
        this.isPlayerData = isPlayerData;
        this.refreshEquipmentDisplay();
        this.refreshWeaponSpine();
    }

    /** AI 展示使用独立武器 id；玩家按主武器、副武器、近战的顺序展示。 */
    private displayWeaponId = -1;
    private loadedWeaponId: number = null;

    setWeaponId(weaponId: number): void {
        this.displayWeaponId = weaponId;
        this.refreshWeaponSpine();
    }

    private get currentWeaponId(): number {
        return this.isPlayerData ? (pData.equipmentIds.slice(0, 3).find(id => id >= 0) ?? -1) : this.displayWeaponId;
    }

    /** 按武器配置 id 查找 itemId；连续换装由 loadSpine 的请求版本保证顺序。 */
    async refreshWeaponSpine(): Promise<void> {
        const skeleton = this.node.getChildByName('weapon')?.getComponent(sp.Skeleton);
        if (!skeleton) return;
        const weaponId = this.currentWeaponId;
        this.loadedWeaponId = weaponId;
        ccTools.cancelAssetLoad(skeleton);
        skeleton.skeletonData = null;
        const weaponData = weaponsConfig.getDataById(weaponId);
        skeleton.node.active = !!weaponData;
        if (!weaponData) return;
        const rightNode = skeleton.node.getChildByName('right');
        if (rightNode) rightNode.active = weaponData.type !== 0;
        const loaded = await ccTools.loadSpine(skeleton, spinePath.weapon + weaponData.itemId);
        if (loaded) skeleton.setAnimation(0, 'idle', true);
    }

    private onTableLoad(tableName: string): void {
        if (tableName === 'weapons') this.refreshWeaponSpine();
    }

    private roleAnim: sp.Skeleton = null;
    private weaponNode: Node = null;
    private weaponSocketBone: any = null;
    private tempSocketLocalPos = new Vec3();
    private tempSocketWorldPos = new Vec3();
    private tempSocketParentLocalPos = new Vec3();

    protected onLoad(): void {
        this.refreshEquipmentDisplay();
        gm.Event.on(GameEvent.refreshEquipmentDisplay, this.refreshEquipmentDisplay, this);
        gm.Event.on(GameEvent.loadTable, this.onTableLoad, this);
    }

    /**每次显示角色时，角色和展示武器都默认循环播放待机动画。 */
    protected onEnable(): void {
        this.refreshWeaponSpine();
        for (const name of ['roleAnim', 'weapon']) {
            const skeleton = this.node.getChildByName(name)?.getComponent(sp.Skeleton);
            if (skeleton?.skeletonData) skeleton.setAnimation(0, 'idle', true);
        }
    }

    protected onDestroy(): void {
        gm.Event.off(GameEvent.refreshEquipmentDisplay, this.refreshEquipmentDisplay, this);
        gm.Event.off(GameEvent.loadTable, this.onTableLoad, this);
    }

    /** 玩家自身跟随仓库装备显示设置，AI 始终显示装备图片。 */
    private refreshEquipmentDisplay(): void {
        const isVisible = !this.isPlayerData || ccStorageTools.getNumberData(SaveKey.isShowEquipment) !== 1;
        const roleAnimNode = this.node.getChildByName('roleAnim');
        for (const name of ['head', 'armor']) {
            const imageNode = roleAnimNode?.getChildByName(name)?.getChildByName('img');
            if (imageNode) imageNode.active = isVisible;
        }
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
