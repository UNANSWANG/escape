import { _decorator, Animation, AnimationClip, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('gameAnimController')
export class gameAnimController extends Component {
    anim : Animation = null;
    private finishHandler: () => void = null;

    onLoad() {
        this.anim = this.getComponent(Animation);
    }

    clearData(){
        this.finishHandler = null;
        this.anim?.off(Animation.EventType.FINISHED, this.onAnimFinished, this);
        this.anim?.stop();
        this.clearClips();
    }

    startAnim(clip: AnimationClip, finishHandler?: () => void){
        if (!this.anim || !clip) {
            return;
        }

        this.finishHandler = finishHandler || null;
        this.clearClips();
        this.anim.addClip(clip, clip.name);
        this.anim.defaultClip = clip;
        this.anim.off(Animation.EventType.FINISHED, this.onAnimFinished, this);
        this.anim.on(Animation.EventType.FINISHED, this.onAnimFinished, this);
        this.anim?.stop();
        this.anim.play(clip.name);
    }

    private clearClips() {
        if (!this.anim) {
            return;
        }

        let clips = this.anim.clips;
        for (let i = 0; i < clips.length; i++) {
            this.anim.removeClip(clips[i], true);
        }
        this.anim.defaultClip = null;
    }

    private onAnimFinished() {
        this.anim?.off(Animation.EventType.FINISHED, this.onAnimFinished, this);
        this.finishHandler?.();
        this.finishHandler = null;
    }
}


