import { _decorator, Button, Component, Node } from 'cc';
import { audioMgr } from '../manager/audioManager';
import { audioPath } from '../manager/pathConfig';
const { ccclass, property } = _decorator;

@ccclass('zoomButton')
export class zoomButton extends Button {
    //函数回调
    onClick: Function = null;
    /**播放音效 */
    private playClickSound: boolean = true;

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_END, this.clickBtn, this);
        this.transition = Button.Transition.SCALE;
        this.zoomScale = 0.9;
    }

    /**设置是否播放音效 */
    setPlayClickSound(play: boolean) {
        this.playClickSound = play;
    }

    clickBtn() {
        if (!this.interactable) {
            return;
        }

        //点击音效
        if(this.playClickSound){
            audioMgr.playEffect(audioPath.click);
        }
        this.onClick && this.onClick();
    }
}


