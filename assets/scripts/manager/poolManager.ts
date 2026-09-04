import { _decorator, Component, instantiate, Node, NodePool, Prefab, sp, Sprite, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { gameAnimController } from '../controller/gameAnimController';
import { bulletController } from '../controller/bulletController';
const { ccclass, property } = _decorator;
const PRODUCE_TIPS_POOL_LIMIT = 48;
const BULLET_POOL_LIMIT = 128;
const GAME_NODE_POOL_LIMIT = 64;
const GAME_SPRITE_POOL_LIMIT = 64;
const GAME_SPINE_POOL_LIMIT = 32;
const TILE_ITEM_POOL_LIMIT = 256;
const PROPS_NODE_POOL_LIMIT = 32;
const GAME_ANIM_POOL_LIMIT = 64;

//对象池管理类
@ccclass('poolManager')
export class poolManager extends Component {
    /**生产提示对象池 */
    produceTipsPool: NodePool = new NodePool();
    /**子弹对象池 */
    bulletPool: NodePool = new NodePool();
    /**游戏节点对象池 */
    gameNodePool: NodePool = new NodePool();
    /**游戏图片节点对象池 */
    gameSpriteNodePool: NodePool = new NodePool();
    /**游戏Spine节点对象池 */
    gameSpineNodePool: NodePool = new NodePool();
    /**瓦片对象池 */
    tileItemPool: NodePool = new NodePool();
    /**按道具脚本类型拆分的节点对象池 */
    private propsNodePoolMap: Map<string, NodePool> = new Map();
    gameAnimNodePool: NodePool = new NodePool();

    /**初始化点的对象池 */
    initPointNodePool() {
        
    }

    /**获取生产提示节点 */
    getProduceTipsNode(prefab: Prefab) {
        return this.getNode(this.produceTipsPool, prefab);
    }

    /**回收生产提示节点并清理运行状态 */
    putProduceTipsNode(node: Node) {
        this.resetNode(node);
        this.putNodeWithLimit(this.produceTipsPool, node, PRODUCE_TIPS_POOL_LIMIT);
    }

    /**获取子弹节点 */
    getBulletNode(prefab: Prefab) {
        return this.getNode(this.bulletPool, prefab);
    }

    /**回收子弹节点并清理本次攻击数据 */
    putBulletNode(node: Node) {
        this.resetNode(node);
        this.putNodeWithLimit(this.bulletPool, node, BULLET_POOL_LIMIT);
    }

    /**获取游戏通用节点 */
    getGameNode(prefab: Prefab) {
        return this.getNode(this.gameNodePool, prefab);
    }

    /**回收游戏通用节点 */
    putGameNode(node: Node) {
        this.resetNode(node, true);
        this.putNodeWithLimit(this.gameNodePool, node, GAME_NODE_POOL_LIMIT);
    }

    /**获取游戏图片节点 */
    getGameSpriteNode(prefab: Prefab) {
        return this.getNode(this.gameSpriteNodePool, prefab);
    }

    /**回收游戏图片节点 */
    putGameSpriteNode(node: Node) {
        this.resetNode(node);
        let sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = null;
        }
        this.putNodeWithLimit(this.gameSpriteNodePool, node, GAME_SPRITE_POOL_LIMIT);
    }

    /**获取游戏Spine节点 */
    getGameSpineNode(prefab: Prefab) {
        let node = this.getNode(this.gameSpineNodePool, prefab);
        // UI引导会临时修改共享Spine节点的层级，复用时恢复预制体默认层级。
        if (prefab?.data) {
            node.layer = prefab.data.layer;
        }
        return node;
    }

    /**回收游戏Spine节点 */
    putGameSpineNode(node: Node) {
        this.resetNode(node);
        let skeleton = node.getComponent(sp.Skeleton);
        if (skeleton) {
            skeleton.setCompleteListener(null);
            skeleton.skeletonData = null;
        }
        this.putNodeWithLimit(this.gameSpineNodePool, node, GAME_SPINE_POOL_LIMIT);
    }

    getGameAnimNode(prefab: Prefab) {
        return this.getNode(this.gameAnimNodePool, prefab);
    }

    putGameAnimNode(node: Node) {
        node.getComponent(gameAnimController)?.clearData();
        this.resetNode(node);
        this.putNodeWithLimit(this.gameAnimNodePool, node, GAME_ANIM_POOL_LIMIT);
    }

    /**获取游戏图片节点Sprite组件 */
    getGameNodeSprite(node: Node) {
        if (!node || !node.isValid) {
            return null;
        }

        return node.getComponent(Sprite);
    }

    /**获取游戏Spine节点Skeleton组件 */
    getGameNodeSkeleton(node: Node) {
        if (!node || !node.isValid) {
            return null;
        }

        return node.getComponent(sp.Skeleton);
    }

    /**获取瓦片节点 */
    getTileItem(prefab: Prefab) {
        return this.getNode(this.tileItemPool, prefab);
    }

    /**回收瓦片节点 */
    putTileItem(node: Node) {
        this.resetNode(node);
        this.putNodeWithLimit(this.tileItemPool, node, TILE_ITEM_POOL_LIMIT);
    }

    /**获取道具节点 */
    getPropsNode(prefab: Prefab, poolKey: string, componentType: any) {
        let pool = this.getPropsNodePool(poolKey);
        let node = this.getNode(pool, prefab);
        // 同类型节点复用已有脚本，仅首次创建该类型节点时添加组件
        let component = node.getComponent(componentType) || node.addComponent(componentType);
        component.enabled = true;
        return node;
    }

    /**回收道具节点 */
    putPropsNode(node: Node, poolKey: string) {
        this.resetNode(node);
        this.putNodeWithLimit(this.getPropsNodePool(poolKey), node, PROPS_NODE_POOL_LIMIT);
    }

    /**按道具类型获取独立对象池，避免通用节点累积不同道具脚本 */
    private getPropsNodePool(poolKey: string) {
        let key = poolKey || "default";
        if (!this.propsNodePoolMap.has(key)) {
            this.propsNodePoolMap.set(key, new NodePool());
        }
        return this.propsNodePoolMap.get(key);
    }

    /**从指定对象池获取节点 */
    private getNode(pool: NodePool, prefab: Prefab) {
        let node = pool.get();
        if (!node) {
            // 池为空时允许创建新实例，回收时再按各池容量上限裁剪
            node = instantiate(prefab);
        }

        node.active = true;
        return node;
    }

    /**超过容量上限的回收对象直接销毁，避免对象池永久保留峰值实例 */
    private putNodeWithLimit(pool: NodePool, node: Node, limit: number) {
        if (!node || !node.isValid) {
            return;
        }
        if (pool.size() >= limit) {
            node.destroy();
            return;
        }

        pool.put(node);
    }

    /**通用节点复原 */
    private resetNode(node: Node, clearRootSprite: boolean = false) {
        if (!node || !node.isValid) {
            return;
        }

        this.resetNodeTree(node, true, clearRootSprite);
        node.removeFromParent();
        node.active = false;
    }

    /**递归停止动画、计时器并恢复运行时常改动状态 */
    private resetNodeTree(node: Node, isRoot: boolean = false, clearRootSprite: boolean = false) {
        Tween.stopAllByTarget(node);
        if (isRoot) {
            node.setPosition(Vec3.ZERO);
            node.setScale(Vec3.ONE);
            node.angle = 0;
            // 子弹以图片底部作为发射基准；其余通用节点仍保持居中锚点。
            const anchorY = node.getComponent(bulletController) ? 0 : 0.5;
            node.getComponent(UITransform)?.setAnchorPoint(0.5, anchorY);
        }

        let comps = node.getComponents(Component) || [];
        for (let i = 0; i < comps.length; i++) {
            let comp: any = comps[i];
            // 使回池前尚未完成的图片/Spine请求失效，避免异步结果污染复用节点
            comp.__asyncAssetLoadVersion = (Number(comp.__asyncAssetLoadVersion) || 0) + 1;
            // 各业务组件通过统一钩子清理目标引用、计时器等私有状态
            comp.onPoolPut?.();
            comp.unscheduleAllCallbacks?.();
            Tween.stopAllByTarget(comp);
        }

        let opacity = node.getComponent(UIOpacity);
        if (opacity) {
            opacity.opacity = 255;
        }

        if (isRoot && clearRootSprite) {
            this.clearGameNodeRenderComponents(node);
        }

        for (let i = 0; i < node.children.length; i++) {
            this.resetNodeTree(node.children[i]);
        }
    }

    /**清理通用节点运行时添加的渲染组件 */
    private clearGameNodeRenderComponents(node: Node) {
        let sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = null;
            sprite.destroy();
        }

        let skeleton = node.getComponent(sp.Skeleton);
        if (skeleton) {
            skeleton.skeletonData = null;
            skeleton.destroy();
        }
    }
}

export let poolMgr = new poolManager();
