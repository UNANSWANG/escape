import { _decorator, Component, Vec3 } from 'cc';
import { configData } from '../manager/configData';
import { poolMgr } from '../manager/poolManager';
const { ccclass, property } = _decorator;

@ccclass('bulletController')
export class bulletController extends Component {
    /**固定飞行方向（父节点本地坐标） */
    private moveDirection = new Vec3();
    /**固定飞行的剩余存活时间 */
    private straightMoveRemainTime = 0;
    /**无锁定子弹的最长存活时间 */
    private readonly straightMoveLifeTime = 2;

    /**初始化为不锁定目标的直线飞行子弹 */
    initStraight(direction: Vec3) {
        const directionLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (directionLength <= 0) {
            this.recycle();
            return;
        }

        this.straightMoveRemainTime = this.straightMoveLifeTime;
        this.moveDirection.set(direction.x / directionLength, direction.y / directionLength, 0);
        // 子弹图片默认朝上。
        this.node.angle = Math.atan2(this.moveDirection.y, this.moveDirection.x) * 180 / Math.PI - 90;
    }

    /**放回对象池前清空本次射击状态 */
    onPoolPut() {
        this.moveDirection.set(0, 0, 0);
        this.straightMoveRemainTime = 0;
    }

    protected update(dt: number): void {
        this.straightMoveRemainTime -= dt;
        if (this.straightMoveRemainTime <= 0) {
            this.recycle();
            return;
        }

        const moveDistance = configData.bulletSpeed * dt;
        const curPos = this.node.position;
        this.node.setPosition(
            curPos.x + this.moveDirection.x * moveDistance,
            curPos.y + this.moveDirection.y * moveDistance,
            curPos.z,
        );
    }

    /**回收子弹 */
    private recycle() {
        poolMgr.putBulletNode(this.node);
    }
}
