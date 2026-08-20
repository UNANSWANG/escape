import { _decorator, CCBoolean, Component, Enum, Node, Tween, tween, UIOpacity, v3, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

export enum loop_anim {
    //摇动
    shake,
    //呼吸
    breathe,
    //旋转
    rotate,
    //循环下落
    drop,
    //鸡蛋跳动
    eggJump,
    //循环浮动
    floating,
    //放缩
    scaling,
}

@ccclass('loopAnimation')
export class loopAnimation extends Component {
    @property({
        type: Enum(loop_anim),
        tooltip: '选择循环动画类型'
    })
    animType: loop_anim = loop_anim.shake;

    @property({
        tooltip: '是否开局播放'
    })
    startPlay: Boolean = true;

    @property({
        visible() {
            return this.animType == loop_anim.drop;
        },
        tooltip: '循环下落的距离'
    })
    dropY: number = 300;

    @property({
        visible() {
            return this.animType == loop_anim.shake;
        },
        tooltip: '延迟时间'
    })
    delayTime: number = 1;

    @property({
        visible() {
            return this.animType == loop_anim.floating;
        },
        tooltip: 'Y轴偏移距离'
    })
    offsetY: number = 20;

    @property({
        visible() {
            return this.animType == loop_anim.rotate;
        },
        tooltip: '是否正向'
    })
    isForward: boolean = false;

    @property({
        visible() {
            return this.animType == loop_anim.rotate;
        },
        tooltip: '速度（单位：秒/圈）'
    })
    rotateSpeed: number = 5;

    @property({
        visible() {
            return this.animType == loop_anim.scaling;
        },
        tooltip: '放缩偏移量'
    })
    scaleOffset: number = 0.1;

    uiOpacity: UIOpacity = null;

    isPlaying = false;

    rootPos: Vec3 = null;

    receive;

    /**初始缩放 */
    baseScale: Vec3 = null;

    /**动画标签 */
    animTag = -1;

    protected onLoad(): void {
        this.initAnimData();
    }

    start() {
        if (this.animType == loop_anim.breathe) {
            this.uiOpacity = this.node.getComponent(UIOpacity);
            if (!this.uiOpacity) {
                this.uiOpacity = this.node.addComponent(UIOpacity);
            }
        }
        if (this.animType == loop_anim.drop || this.animType == loop_anim.floating) {
            this.rootPos = new Vec3(this.node.position);
        }
        if (this.startPlay) this.playAni();
    }

    playAni() {
        if (this.isPlaying) return;
        this.stopAni();
        //下帧执行，因为tag会停止当前帧所有tag相同的动画，包括后面执行的
        this.scheduleOnce(() => {
            this.isPlaying = true;
            switch (this.animType) {
                case loop_anim.shake:
                    this.shake();
                    break;
                case loop_anim.breathe:
                    this.breathe();
                    break;
                case loop_anim.rotate:
                    this.rotateTarget();
                    break;
                case loop_anim.drop:
                    this.drop();
                    break;
                case loop_anim.eggJump:
                    this.playFreeGiftAnimation();
                    break;
                case loop_anim.floating:
                    this.playFloatAni();
                    break;
                case loop_anim.scaling:
                    this.playLoopScale();
                    break;
                default:
                    break;
            }
        }, 0);
    }

    stopAni() {
        this.initAnimData();
        //只停止自身动画
        if (this.animTag == -1) {
            Tween.stopAllByTarget(this.node);
        } else {
            Tween.stopAllByTag(this.animTag);
        }
        this.isPlaying = false;
        if (this.animType == loop_anim.breathe) {
            this.uiOpacity.opacity = 255;
        } else {
            this.node.scale = new Vec3(this.baseScale);
            this.node.angle = 0;
        }
    }

    /**初始化动画依赖数据 */
    private initAnimData() {
        if (!this.baseScale) {
            this.baseScale = new Vec3(this.node.scale);
        }

        if ((this.animType == loop_anim.drop || this.animType == loop_anim.floating) && !this.rootPos) {
            this.rootPos = new Vec3(this.node.position);
        }

        if (this.animType == loop_anim.breathe && !this.uiOpacity) {
            this.uiOpacity = this.node.getComponent(UIOpacity);
            if (!this.uiOpacity) {
                this.uiOpacity = this.node.addComponent(UIOpacity);
            }
        }

        if (this.animTag == -1) {
            let randomMul = Math.floor(Math.random() * 100) + 10;
            let matchData = this.node.uuid.match(/\d+/);
            let firstNum = matchData ? matchData[0] : "1";
            //通过uuid获取随机倍数，保证每个对象动画不同步
            this.animTag = Number(firstNum) * randomMul;
        }
    }

    /** 摇动 */
    shake() {
        let repeatTw = tween(this.node)
            .parallel(
                tween(this.node).to(0.1, { angle: -8 }),
                tween(this.node).to(0.1, { scale: v3(1.03, 1.03) }),
            )
            .parallel(
                tween(this.node).to(0.1, { angle: 12 }),
                tween(this.node).to(0.1, { scale: v3(1.01, 1.01) }),
            )
            .parallel(
                tween(this.node).to(0.1, { angle: -10 }),
                tween(this.node).to(0.1, { scale: v3(1.05, 1.05) }),
            )
            .parallel(
                tween(this.node).to(0.1, { angle: 6 }),
                tween(this.node).to(0.1, { scale: v3(1.02, 1.02) }),
            )
            .parallel(
                tween(this.node).to(0.1, { angle: -8 }),
                tween(this.node).to(0.1, { scale: v3(1.03, 1.03) }),
            )
            .parallel(
                tween(this.node).to(0.1, { angle: 12 }),
                tween(this.node).to(0.1, { scale: v3(1.01, 1.01) }),
            )
            .parallel(
                tween(this.node).to(0.2, { angle: 0 }),
                tween(this.node).to(0.2, { scale: v3(1, 1, 1) }),
            )
            .delay(this.delayTime);
        tween(this.node)
            .tag(this.animTag)
            .repeatForever(repeatTw)
            .start();
    }

    /**闪烁 */
    breathe() {
        tween(this.uiOpacity)
            .tag(this.animTag)
            .to(1, { opacity: 50 }, { easing: 'sineInOut' })
            .to(1, { opacity: 255 }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    /**旋转 */
    rotateTarget() {
        if (this.isForward) {
            tween(this.node)
                .tag(this.animTag)
                .to(this.rotateSpeed, { angle: -360 })
                .to(0, { angle: 0 })
                .union()
                .repeatForever()
                .start();
        } else {
            tween(this.node)
                .tag(this.animTag)
                .to(this.rotateSpeed, { angle: 360 })
                .to(0, { angle: 0 })
                .union()
                .repeatForever()
                .start();
        }
    }

    /**掉落 */
    drop() {
        let targetPos = new Vec3(this.rootPos);
        targetPos.y = this.rootPos.y - this.dropY;
        let opacity = this.node.getComponent(UIOpacity);
        tween(this.node)
            .tag(this.animTag)
            .to(0, { position: this.rootPos })
            .to(1.5, { position: targetPos })
            .union()
            .repeatForever()
            .start();
        tween(opacity)
            .tag(this.animTag)
            .to(0, { opacity: 255 })
            .delay(0.5)
            .to(1, { opacity: 0 })
            .union()
            .repeatForever()
            .start();
    }

    /** 鸡蛋跳动动画 */
    playFreeGiftAnimation(canReceive: boolean = false) {
        if (this.receive == canReceive) {
            return
        } else {
            this.receive = canReceive;
        }
        console.log("播放鸡蛋动画：", canReceive);
        // 停止可能正在播放的之前的动画
        Tween.stopAllByTarget(this.node);
        // 重置节点状态
        this.node.setPosition(0, 0, 0);
        this.node.setScale(1, 1, 1);
        this.node.setRotationFromEuler(0, 0, 0);

        if (canReceive) {
            // 原有的可领取动画...
            const scaleSequence = tween(this.node)
                .to(0.2, { scale: new Vec3(1.08, 0.94, 1) })
                .to(0.13, { scale: new Vec3(0.96, 1.06, 1) })
                .to(0.13, { scale: new Vec3(1.05, 0.97, 1) })
                .to(0.18, { scale: new Vec3(0.97, 1.05, 1) })
                .to(0.1, { scale: new Vec3(1.02, 0.98, 1) })
                .to(0.12, { scale: new Vec3(0.98, 1.02, 1) })
                .to(0.13, { scale: new Vec3(1, 1, 1) });

            const positionSequence = tween(this.node)
                .to(0.13, { position: new Vec3(0, 21, 0) })
                .to(0.13, { position: new Vec3(0, 33.8, 0) })
                .to(0.18, { position: new Vec3(0, 0.6, 0) })
                .to(0.1, { position: new Vec3(0, 0.6, 0) })
                .to(0.12, { position: new Vec3(0, 4.2, 0) })
                .to(0.13, { position: new Vec3(0, 0.6, 0) });

            const rotationSequence = tween(this.node)
                .to(0.17, { eulerAngles: new Vec3(0, 0, 4) })
                .to(0.33, { eulerAngles: new Vec3(0, 0, -4) })
                .to(0.17, { eulerAngles: new Vec3(0, 0, 3) })
                .to(0.17, { eulerAngles: new Vec3(0, 0, -3) })
                .to(0.1, { eulerAngles: new Vec3(0, 0, 1.5) })
                .to(0.1, { eulerAngles: new Vec3(0, 0, -1.5) })
                .to(0.08, { eulerAngles: new Vec3(0, 0, 0) });

            const mainAnimation = tween(this.node)
                .parallel(
                    scaleSequence,
                    positionSequence,
                    rotationSequence
                );

            tween(this.node)
                .tag(this.animTag)
                .sequence(
                    mainAnimation,
                    tween().delay(1.0)
                )
                .repeatForever()
                .start();
        } else {
            // 不可领取时的呼吸浮动动画
            tween(this.node)
                .tag(this.animTag)
                .to(1.0, { position: new Vec3(0, 10, 0), scale: new Vec3(1.02, 1.02, 1) }, { easing: 'smooth' })
                // 向下浮动同时缩小
                .to(2.0, { position: new Vec3(0, -10, 0), scale: new Vec3(0.98, 0.98, 1) }, { easing: 'smooth' })
                // 确保循环播放
                .union()
                .repeatForever()
                .start();
        }
    }

    /**循环浮动 */
    playFloatAni() {
        let upPos = new Vec3(this.rootPos.x, this.rootPos.y + this.offsetY, 0);
        let downPos = new Vec3(this.rootPos.x, this.rootPos.y - this.offsetY, 0);
        this.node.setPosition(this.rootPos);
        tween(this.node)
            .tag(this.animTag)
            .to(0.1, { position: upPos })
            .to(0.2, { position: downPos })
            .to(0.1, { position: this.rootPos })
            .union()
            .repeatForever()
            .start();
    }

    /**循环放缩 */
    playLoopScale() {
        this.node.scale = this.baseScale;
        let scaleTime = 0.4;
        let upScale = this.baseScale.x + this.scaleOffset;
        let downScale = this.baseScale.x - this.scaleOffset;
        tween(this.node)
            .tag(this.animTag)
            .to(scaleTime, { scale: new Vec3(upScale, upScale, 1) })
            .to(scaleTime * 2, { scale: new Vec3(downScale, downScale, 1) })
            .to(scaleTime, { scale: new Vec3(this.baseScale.x, this.baseScale.y, 1) })
            .union()
            .repeatForever()
            .start();
    }
}
