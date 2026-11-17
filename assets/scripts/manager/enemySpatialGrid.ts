import { Node, Rect } from 'cc';
import type { EnemyTarget } from './enemyManager';

interface EnemyEntry {
    enemy: EnemyTarget;
    bounds: Rect;
    order: number;
    seen: number;
    stamp: number;
    indexed: boolean;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    watched: Node[];
    dirty: () => void;
}

/** 运行时受击区域索引，不需要场景节点或额外碰撞组件。 */
export class EnemySpatialGrid {
    private readonly cellSize = 256;
    private cells = new Map<number, Map<number, Set<EnemyEntry>>>();
    private entries = new Map<EnemyTarget, EnemyEntry>();
    private dirtyEntries = new Set<EnemyEntry>();
    private revision = 0;
    private queryStamp = 0;

    /** 每帧首次查询同步名单和包围盒，后续查询仅更新发生变换的目标。 */
    sync(groups: ReadonlyArray<ReadonlyArray<EnemyTarget>>) {
        const revision = ++this.revision;
        let order = 0;
        for (const group of groups) {
            for (const enemy of group) {
                if (!enemy?.node?.isValid) continue;
                let entry = this.entries.get(enemy);
                if (!entry) {
                    entry = {
                        enemy, bounds: new Rect(), order: 0, seen: 0, stamp: 0,
                        indexed: false, minX: 0, minY: 0, maxX: 0, maxY: 0,
                        watched: [], dirty: null,
                    };
                    entry.dirty = () => this.dirtyEntries.add(entry);
                    this.entries.set(enemy, entry);
                }
                if (entry.seen === revision) continue;
                entry.seen = revision;
                entry.order = order++;
                this.watch(entry);
                this.refresh(entry);
            }
        }
        for (const [enemy, entry] of this.entries) {
            if (entry.seen === revision) continue;
            this.removeFromCells(entry);
            this.unwatch(entry);
            this.entries.delete(enemy);
        }
        this.dirtyEntries.clear();
    }

    query(bounds: Rect, out: EnemyTarget[]) {
        for (const entry of this.dirtyEntries) {
            this.watch(entry);
            this.refresh(entry);
        }
        this.dirtyEntries.clear();
        out.length = 0;
        const stamp = ++this.queryStamp;
        for (let x = Math.floor(bounds.xMin / this.cellSize); x <= Math.floor(bounds.xMax / this.cellSize); x++) {
            const column = this.cells.get(x);
            if (!column) continue;
            for (let y = Math.floor(bounds.yMin / this.cellSize); y <= Math.floor(bounds.yMax / this.cellSize); y++) {
                const cell = column.get(y);
                if (!cell) continue;
                for (const entry of cell) {
                    if (entry.stamp === stamp) continue;
                    entry.stamp = stamp;
                    const enemy = entry.enemy;
                    if (enemy.node.isValid && enemy.node.activeInHierarchy && enemy.hp > 0
                        && enemy.hitArea?.isValid && bounds.intersects(entry.bounds)) out.push(enemy);
                }
            }
        }
        out.sort((first, second) => this.entries.get(first).order - this.entries.get(second).order);
        return out;
    }

    clear() {
        for (const entry of this.entries.values()) this.unwatch(entry);
        this.entries.clear();
        this.cells.clear();
        this.dirtyEntries.clear();
    }

    private refresh(entry: EnemyEntry) {
        const enemy = entry.enemy;
        const hitArea = enemy.hitArea;
        if (!enemy.node.isValid || !enemy.node.activeInHierarchy || !hitArea?.isValid) {
            this.removeFromCells(entry);
            return;
        }
        entry.bounds.set(hitArea.getBoundingBoxToWorld());
        const minX = Math.floor(entry.bounds.xMin / this.cellSize);
        const minY = Math.floor(entry.bounds.yMin / this.cellSize);
        const maxX = Math.floor(entry.bounds.xMax / this.cellSize);
        const maxY = Math.floor(entry.bounds.yMax / this.cellSize);
        if (entry.indexed && minX === entry.minX && minY === entry.minY
            && maxX === entry.maxX && maxY === entry.maxY) return;
        this.removeFromCells(entry);
        entry.minX = minX; entry.minY = minY; entry.maxX = maxX; entry.maxY = maxY;
        for (let x = minX; x <= maxX; x++) {
            let column = this.cells.get(x);
            if (!column) this.cells.set(x, column = new Map());
            for (let y = minY; y <= maxY; y++) {
                let cell = column.get(y);
                if (!cell) column.set(y, cell = new Set());
                cell.add(entry);
            }
        }
        entry.indexed = true;
    }

    private removeFromCells(entry: EnemyEntry) {
        if (!entry.indexed) return;
        for (let x = entry.minX; x <= entry.maxX; x++) {
            const column = this.cells.get(x);
            if (!column) continue;
            for (let y = entry.minY; y <= entry.maxY; y++) {
                const cell = column.get(y);
                cell?.delete(entry);
                if (cell?.size === 0) column.delete(y);
            }
            if (!column.size) this.cells.delete(x);
        }
        entry.indexed = false;
    }

    private watch(entry: EnemyEntry) {
        let node = entry.enemy.hitArea?.node ?? entry.enemy.node;
        let index = 0;
        while (node && entry.watched[index] === node) {
            index++;
            node = node.parent;
        }
        if (!node && index === entry.watched.length) return;
        this.unwatch(entry);
        for (node = entry.enemy.hitArea?.node ?? entry.enemy.node; node; node = node.parent) {
            entry.watched.push(node);
            node.on(Node.EventType.TRANSFORM_CHANGED, entry.dirty);
            node.on(Node.EventType.SIZE_CHANGED, entry.dirty);
            node.on(Node.EventType.ANCHOR_CHANGED, entry.dirty);
            node.on(Node.EventType.PARENT_CHANGED, entry.dirty);
            node.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, entry.dirty);
        }
    }

    private unwatch(entry: EnemyEntry) {
        for (const node of entry.watched) {
            node.off(Node.EventType.TRANSFORM_CHANGED, entry.dirty);
            node.off(Node.EventType.SIZE_CHANGED, entry.dirty);
            node.off(Node.EventType.ANCHOR_CHANGED, entry.dirty);
            node.off(Node.EventType.PARENT_CHANGED, entry.dirty);
            node.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, entry.dirty);
        }
        entry.watched.length = 0;
    }
}
