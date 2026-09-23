import { _decorator, Component, UITransform, Vec3 } from 'cc';
import { enemyMgr } from '../manager/enemyManager';
import { poolMgr } from '../manager/poolManager';
import { playerMgr } from '../manager/playerManager';
import type { StaticCollisionShape } from '../UIPage/UIGame';
const { ccclass, property } = _decorator;

@ccclass('bulletController')
export class bulletController extends Component {
    /**固定飞行方向（父节点本地坐标） */
    private moveDirection = new Vec3();
    /**直线飞行的剩余距离 */
    private straightMoveRemainDistance = 0;
    /** 本发子弹的飞行速度，由发射武器决定。 */
    private flightSpeed = 0;
    /**本发子弹命中敌人时造成的伤害 */
    private damage = 0;
    private targetPlayer = false;
    private obstacleCandidates: StaticCollisionShape[] = [];
    private moveStartWorld = new Vec3();
    private moveEndWorld = new Vec3();

    /**初始化为不锁定目标的直线飞行子弹 */
    initStraight(direction: Vec3, damage: number, attackRange: number, flightSpeed: number, targetPlayer = false) {
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
        this.targetPlayer = targetPlayer;
        this.flightSpeed = Math.max(0, flightSpeed);
        if (this.flightSpeed <= 0) {
            this.recycle();
            return;
        }
        // 子弹图片默认朝上。
        this.node.angle = Math.atan2(this.moveDirection.y, this.moveDirection.x) * 180 / Math.PI - 90;
    }

    /**放回对象池前清空本次射击状态 */
    onPoolPut() {
        this.moveDirection.set(0, 0, 0);
        this.straightMoveRemainDistance = 0;
        this.damage = 0;
        this.targetPlayer = false;
        this.flightSpeed = 0;
        this.obstacleCandidates.length = 0;
    }

    protected update(dt: number): void {
        if (this.straightMoveRemainDistance <= 0) {
            this.recycle();
            return;
        }

        // 最后一帧只移动剩余距离，确保子弹不会飞过配置的消失距离。
        const moveDistance = Math.min(this.flightSpeed * dt, this.straightMoveRemainDistance);
        this.node.getWorldPosition(this.moveStartWorld);
        const curPos = this.node.position;
        this.node.setPosition(
            curPos.x + this.moveDirection.x * moveDistance,
            curPos.y + this.moveDirection.y * moveDistance,
            curPos.z,
        );
        this.straightMoveRemainDistance -= moveDistance;
        this.node.getWorldPosition(this.moveEndWorld);
        if (this.checkHitObstacle()) {
            this.recycle();
            return;
        }
        if (this.targetPlayer ? this.checkHitPlayer() : this.checkHitEnemy()) {
            return;
        }
        if (this.straightMoveRemainDistance <= 0) {
            this.recycle();
        }
    }

    /**
     * 检查子弹本帧经过的世界坐标线段是否命中 colliderList 中的障碍物。
     * 先通过空间网格取得候选形状，再进行矩形粗筛和多边形精确检测。
     * @returns 命中任意障碍物时返回 true。
     */
    private checkHitObstacle() {
        const game = playerMgr.playerComp?.gameComp;
        if (!game) {
            this.obstacleCandidates.length = 0;
            return false;
        }
        const start = this.moveStartWorld;
        const end = this.moveEndWorld;
        const padding = 0.01;
        game.queryStaticColliders(
            Math.min(start.x, end.x) - padding, Math.min(start.y, end.y) - padding,
            Math.max(start.x, end.x) + padding, Math.max(start.y, end.y) + padding,
            this.obstacleCandidates,
        );
        for (const shape of this.obstacleCandidates) {
            if (!this.segmentHitsRect(start.x, start.y, end.x, end.y, shape)) continue;
            if (!shape.points || this.pointInPolygon(start.x, start.y, shape.points)
                || this.pointInPolygon(end.x, end.y, shape.points)) return true;
            for (let i = 0; i < shape.points.length; i++) {
                const a = shape.points[i];
                const b = shape.points[(i + 1) % shape.points.length];
                if (this.segmentsIntersect(start.x, start.y, end.x, end.y, a.x, a.y, b.x, b.y)) return true;
            }
        }
        return false;
    }

    /**
     * 使用线段裁剪方式检测线段与轴对齐矩形是否相交。
     * 多边形检测也先用其外接矩形调用此方法，快速排除不可能命中的形状。
     * @param x1 线段起点世界坐标 X。
     * @param y1 线段起点世界坐标 Y。
     * @param x2 线段终点世界坐标 X。
     * @param y2 线段终点世界坐标 Y。
     * @param box 障碍物的世界坐标外接矩形。
     */
    private segmentHitsRect(x1: number, y1: number, x2: number, y2: number, box: StaticCollisionShape) {
        let enter = 0;
        let exit = 1;
        const dx = x2 - x1;
        const dy = y2 - y1;
        for (let axis = 0; axis < 2; axis++) {
            const origin = axis === 0 ? x1 : y1;
            const delta = axis === 0 ? dx : dy;
            const min = axis === 0 ? box.minX : box.minY;
            const max = axis === 0 ? box.maxX : box.maxY;
            if (Math.abs(delta) < 0.000001) {
                if (origin < min || origin > max) return false;
                continue;
            }
            const first = (min - origin) / delta;
            const second = (max - origin) / delta;
            enter = Math.max(enter, Math.min(first, second));
            exit = Math.min(exit, Math.max(first, second));
            if (enter > exit) return false;
        }
        return true;
    }

    /**
     * 使用射线法判断世界坐标点是否在多边形内部，落在边界上也视为命中。
     * @param x 待检测点的世界坐标 X。
     * @param y 待检测点的世界坐标 Y。
     * @param points 按边界顺序排列的多边形世界坐标顶点。
     */
    private pointInPolygon(x: number, y: number, points: ReadonlyArray<{ x: number; y: number }>) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i];
            const b = points[j];
            const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
            if (Math.abs(cross) < 0.000001 && x >= Math.min(a.x, b.x) && x <= Math.max(a.x, b.x)
                && y >= Math.min(a.y, b.y) && y <= Math.max(a.y, b.y)) return true;
            if ((a.y > y) !== (b.y > y)
                && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    /**
     * 检测有限线段 AB 与有限线段 CD 是否相交。
     * 子弹的本帧飞行路径为 AB，多边形当前边为 CD。
     * 平行或共线时由端点位于多边形内的检测覆盖，因此这里直接返回 false。
     */
    private segmentsIntersect(ax: number, ay: number, bx: number, by: number,
        cx: number, cy: number, dx: number, dy: number) {
        const abx = bx - ax, aby = by - ay;
        const cdx = dx - cx, cdy = dy - cy;
        const denominator = abx * cdy - aby * cdx;
        if (Math.abs(denominator) < 0.000001) return false;
        const acx = cx - ax, acy = cy - ay;
        const alongBullet = (acx * cdy - acy * cdx) / denominator;
        const alongEdge = (acx * aby - acy * abx) / denominator;
        return alongBullet >= 0 && alongBullet <= 1 && alongEdge >= 0 && alongEdge <= 1;
    }

    /**
     * 以 UITransform 的世界包围盒进行 AABB 数学相交检测，不依赖物理碰撞组件。
     * 命中第一个存活敌人后立即回收子弹，确保一发子弹只造成一次伤害。
     */
    private checkHitEnemy() {
        const bulletTransform = this.getComponent(UITransform);
        if (!bulletTransform) return false;
        const bulletBounds = bulletTransform.getBoundingBoxToWorld();

        for (const enemy of enemyMgr.soldiersArr) {
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

    private checkHitPlayer() {
        const player = playerMgr.playerComp;
        if (!player?.node?.isValid || !player.node.activeInHierarchy || player.hp <= 0) return false;
        const bulletTransform = this.getComponent(UITransform);
        const hitNode = player.roleAnim?.node || player.node;
        const playerTransform = hitNode.getComponent(UITransform);
        if (!bulletTransform || !playerTransform
            || !bulletTransform.getBoundingBoxToWorld().intersects(playerTransform.getBoundingBoxToWorld())) return false;
        player.takeDamage(this.damage);
        this.recycle();
        return true;
    }

    /**回收子弹 */
    private recycle() {
        poolMgr.putBulletNode(this.node);
    }
}
