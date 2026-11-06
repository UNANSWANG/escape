import { _decorator, Animation, Component } from 'cc';
import { poolMgr } from '../manager/poolManager';
import { gm } from '../manager/gm';
import { GameEvent } from '../manager/configData';
const { ccclass } = _decorator;

/** 子弹命中特效，播放完成后自行回池。 */
@ccclass('bulletExplosionController')
export class bulletExplosionController extends Component {
    private animation: Animation = null;
    private isPlaying = false;

    protected onLoad(): void {
        this.animation = this.getComponent(Animation);
    }

    protected onEnable(): void {
        gm.Event.on(GameEvent.gamePause, this.pauseAnimation, this);
        gm.Event.on(GameEvent.gameResume, this.resumeAnimation, this);
    }

    protected onDisable(): void {
        gm.Event.off(GameEvent.gamePause, this.pauseAnimation, this);
        gm.Event.off(GameEvent.gameResume, this.resumeAnimation, this);
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
        if (gm.isGamePause) this.pauseAnimation();
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

    private pauseAnimation(): void {
        if (this.isPlaying) this.animation?.pause();
    }

    private resumeAnimation(): void {
        if (this.isPlaying) this.animation?.resume();
    }
}
