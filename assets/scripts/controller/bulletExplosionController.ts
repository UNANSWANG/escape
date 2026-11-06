import { _decorator, Animation, Component } from 'cc';
import { poolMgr } from '../manager/poolManager';
const { ccclass } = _decorator;

/** 子弹命中特效，游戏暂停时继续播放，播放完成后自行回池。 */
@ccclass('bulletExplosionController')
export class bulletExplosionController extends Component {
    private animation: Animation = null;
    private isPlaying = false;

    protected onLoad(): void {
        this.animation = this.getComponent(Animation);
    }

    play(): void {
        this.animation ??= this.getComponent(Animation);
        if (!this.animation?.defaultClip) {
            poolMgr.putBulletExplosionNode(this.node);
            return;
        }
        this.animation.stop();
        this.animation.off(Animation.EventType.FINISHED, this.finish, this);
        this.animation.on(Animation.EventType.FINISHED, this.finish, this);
        this.isPlaying = true;
        this.animation.play();
    }

    private finish(): void {
        if (!this.isPlaying) return;
        poolMgr.putBulletExplosionNode(this.node);
    }

    onPoolPut(): void {
        this.isPlaying = false;
        this.animation?.off(Animation.EventType.FINISHED, this.finish, this);
        this.animation?.stop();
    }
}
