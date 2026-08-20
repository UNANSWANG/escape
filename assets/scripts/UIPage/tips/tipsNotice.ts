import { _decorator, Component, Node, Animation, Label } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('tipsNotice')
export class tipsNotice extends Component {
    start() {
        let animation = this.getComponent(Animation);
        animation.play();

        animation.on(Animation.EventType.FINISHED, ()=>{
            this.node.removeFromParent();
            this.node.destroy();
        }, this);
    }

    initData(str){
        this.node.getChildByName('lab').getComponent(Label).string = str;
    }
}