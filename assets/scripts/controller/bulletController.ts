import { _decorator, Component, UITransform, Vec3 } from 'cc';
import { configData } from '../manager/configData';
import { enemyMgr } from '../manager/enemyManager';
import { poolMgr } from '../manager/poolManager';
const { ccclass, property } = _decorator;

@ccclass('bulletController')
export class bulletController extends Component {
    /**固定飞行方向（父节点本地坐标） */
    private moveDirection = new Vec3();
    /**直线飞行的剩余距离 */
    private straightMoveRemainDistance = 0;
    /**本发子弹命中敌人时造成的伤害 */
    private damage = 0;

    /**初始化为不锁定目标的直线飞行子弹 */
    initStraight(direction: Vec3, damage: number, attackRange: number) {
        const directionLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (directionLength <= 0) {
            this.recycle();
            return;
        }

        this.straightMoveRemainDistance = Math.max(0, attackRange);
        if (this.straightMoveRemainDistance <= 0) {
            this.recycle();
            return;
        }

        this.moveDirection.set(direction.x / directionLength, direction.y / directionLength, 0);
        this.damage = Math.max(0, damage);
        // 子弹图片默认朝上。
        this.node.angle = Math.atan2(this.moveDirection.y, this.moveDirection.x) * 180 / Math.PI - 90;
    }

    /**放回对象池前清空本次射击状态 */
    onPoolPut() {
        this.moveDirection.set(0, 0, 0);
        this.straightMoveRemainDistance = 0;
        this.damage = 0;
    }

    protected update(dt: number): void {
        if (this.straightMoveRemainDistance <= 0) {
            this.recycle();
            return;
        }

        // 最后一帧只移动剩余距离，确保子弹不会飞过配置的消失距离。
        const moveDistance = Math.min(configData.bulletSpeed * dt, this.straightMoveRemainDistance);
        const curPos = this.node.position;
        this.node.setPosition(
            curPos.x + this.moveDirection.x * moveDistance,
            curPos.y + this.moveDirection.y * moveDistance,
            curPos.z,
        );
        this.straightMoveRemainDistance -= moveDistance;
        if (this.checkHitEnemy()) {
            return;
        }
        if (this.straightMoveRemainDistance <= 0) {
            this.recycle();
        }
    }

    /**
     * 以 UITransform 的世界包围盒进行 AABB 数学相交检测，不依赖物理碰撞组件。
     * 命中第一个存活敌人后立即回收子弹，确保一发子弹只造成一次伤害。
     */
    private checkHitEnemy() {
        const bulletTransform = this.getComponent(UITransform);
        if (!bulletTransform) return false;
        const bulletBounds = bulletTransform.getBoundingBoxToWorld();

        for (const enemy of enemyMgr.enemyArr) {
            if (!enemy?.node?.isValid || !enemy.node.activeInHierarchy || enemy.hp <= 0) continue;
            // 只用角色本体作为受击范围，避免血条和名字也触发命中。
            const hitNode = enemy.roleAnim?.node || enemy.node;
            const enemyTransform = hitNode.getComponent(UITransform);
            if (!enemyTransform || !bulletBounds.intersects(enemyTransform.getBoundingBoxToWorld())) continue;

            enemy.takeDamage(this.damage);
            this.recycle();
            return true;
        }
        return false;
    }

    /**回收子弹 */
    private recycle() {
        poolMgr.putBulletNode(this.node);
    }
}
