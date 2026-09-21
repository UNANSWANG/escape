import { _decorator, CCFloat, CCInteger, Color, Component, Enum, Graphics, Node } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
const { ccclass, executeInEditMode, property } = _decorator;

enum ScoutType {
    StandGuard = 0,
    AreaScout = 1,
    PathScout = 2,
}

const scoutTypeOptions = Enum({
    站岗: ScoutType.StandGuard,
    范围侦察: ScoutType.AreaScout,
    路径侦察: ScoutType.PathScout,
});

@ccclass('soldiersData')
@executeInEditMode
export class soldiersData extends Component {
    private rangeGraphics: Graphics = null;
    private isFocusedInEditor = false;

    @property({
        type: CCInteger,
        tooltip: '小兵编号'
    })
    soldierId: number = 0;

    private _scoutType: ScoutType = ScoutType.StandGuard;

    @property({ type: scoutTypeOptions, tooltip: '侦察类型' })
    get scoutType(): ScoutType {
        return this._scoutType;
    }

    set scoutType(value: ScoutType) {
        if (this._scoutType === value) return;
        this._scoutType = value;
        this.refreshRangePreview();
    }

    private _rangeRadius: number = 800;

    @property({
        type: CCFloat,
        tooltip: '范围巡逻半径',
        visible() {
            return this.scoutType == ScoutType.AreaScout;
        },
    })
    get rangeRadius(): number {
        return this._rangeRadius;
    }

    set rangeRadius(value: number) {
        if (this._rangeRadius === value) return;
        this._rangeRadius = value;
        this.refreshRangePreview();
    }

    @property({
        tooltip: '路径是否循环',
        visible() {
            return this.scoutType == ScoutType.PathScout;
        },
    })
    isLoop: boolean = false;

    @property({
        type: [Node],
        tooltip: '侦察路径',
        visible() {
            return this.scoutType == ScoutType.PathScout;
        },
    })
    scoutPath: Node[] = [];

    protected onLoad() {
        const graphics = this.getComponent(Graphics);
        if (graphics) graphics.enabled = false;
    }

    onFocusInEditor() {
        if (!EDITOR || PREVIEW) return;
        this.isFocusedInEditor = true;
        this.refreshRangePreview();
    }

    private refreshRangePreview() {
        if (!EDITOR || PREVIEW || !this.isFocusedInEditor) return;
        if (this.scoutType !== ScoutType.AreaScout || this.rangeRadius <= 0) {
            this.hideRange();
            return;
        }
        this.rangeGraphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
        this.rangeGraphics.enabled = true;
        this.drawRange();
    }

    onLostFocusInEditor() {
        this.isFocusedInEditor = false;
        this.hideRange();
    }

    protected onDisable() {
        this.isFocusedInEditor = false;
        this.hideRange();
    }

    private hideRange() {
        if (!this.rangeGraphics) return;
        this.rangeGraphics.clear();
        this.rangeGraphics.enabled = false;
        this.rangeGraphics.destroy();
        this.rangeGraphics = null;
    }

    private drawRange() {
        const graphics = this.rangeGraphics;
        if (!graphics) return;

        graphics.clear();
        if (this.scoutType !== ScoutType.AreaScout || this.rangeRadius <= 0) return;

        graphics.lineWidth = 6;
        graphics.strokeColor = new Color(89, 0, 255, 220);
        graphics.circle(0, 0, this.rangeRadius);
        graphics.stroke();
    }
}
