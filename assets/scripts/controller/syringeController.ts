import { _decorator, Component, Sprite, tween, Tween, Vec3 } from 'cc';
import { gm } from '../manager/gm';
import { GameEvent } from '../manager/configData';
const { ccclass } = _decorator;

@ccclass('syringeController')
export class syringeController extends Component {
    private img: Sprite = null;
    private animation: Tween<{}> = null;

    protected onLoad(): void {
        this.img = this.node.getChildByName('img')?.getComponent(Sprite);
        gm.Event.on(GameEvent.gamePause, this.pauseAnimation, this);
        gm.Event.on(GameEvent.gameResume, this.resumeAnimation, this);
    }

    /**重置并播放；总时长包含停留 0.1 秒和移动 0.2 秒。 */
    play(duration: number): void {
        this.hide();
        if (!this.img || !Number.isFinite(duration) || duration <= 0) return;
        this.node.setPosition(47, 34, 0);
        this.img.fillRange = 1;
        this.node.active = true;

        // 极短时长按剩余时间截断，避免出现负数 tween 时长。
        const stayTime = Math.min(0.1, duration);
        const moveTime = Math.min(0.2, Math.max(0, duration - stayTime));
        const fillTime = Math.max(0, duration - 0.3);
        this.animation = tween({})
            .then(tween(this.node)
                .delay(stayTime)
                .to(moveTime, { position: new Vec3(30, 27, 0) }))
            .then(tween(this.img).to(fillTime, { fillRange: 0 }))
            .call(() => this.hide())
            .start();
        if (gm.isGamePause) this.pauseAnimation();
    }

    /**完成或中断时停止动画并隐藏，节点保留供下次复用。 */
    hide(): void {
        this.animation?.stop();
        this.animation = null;
        this.node.active = false;
    }

    private pauseAnimation(): void {
        this.animation?.pause();
    }

    private resumeAnimation(): void {
        this.animation?.resume();
    }

    protected onDisable(): void {
        this.animation?.stop();
        this.animation = null;
    }

    protected onDestroy(): void {
        this.animation?.stop();
        gm.Event.off(GameEvent.gamePause, this.pauseAnimation, this);
        gm.Event.off(GameEvent.gameResume, this.resumeAnimation, this);
    }
}
