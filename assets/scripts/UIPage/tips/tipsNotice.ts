import { _decorator, Component, Node, Animation, Label, RichText } from 'cc';
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
        const textNode = this.node.getChildByName('lab');
        const text = textNode.getComponent(RichText) || textNode.getComponent(Label);
        text.string = str;
    }
}