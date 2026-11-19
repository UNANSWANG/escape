import { _decorator, Button } from 'cc';
import { audioMgr } from '../manager/audioManager';
import { audioPath } from '../manager/pathConfig';
const { ccclass } = _decorator;

@ccclass('zoomButton')
export class zoomButton extends Button {
    //函数回调
    onClick: Function = null;
    /**播放音效 */
    private playClickSound: boolean = true;

    protected onLoad(): void {
        this.transition = Button.Transition.SCALE;
        this.zoomScale = 0.9;
    }

    public onEnable(): void {
        super.onEnable();
        this.node.on(Button.EventType.CLICK, this.clickBtn, this);
    }

    public onDisable(): void {
        this.node.off(Button.EventType.CLICK, this.clickBtn, this);
        super.onDisable();
    }

    /**设置是否播放音效 */
    setPlayClickSound(play: boolean) {
        this.playClickSound = play;
    }

    clickBtn() {
        if (!this.interactable || !this.enabledInHierarchy) {
            return;
        }

        //点击音效
        if (this.playClickSound) {
            audioMgr.playEffect(audioPath.click);
        }
        this.onClick && this.onClick();
    }
}


