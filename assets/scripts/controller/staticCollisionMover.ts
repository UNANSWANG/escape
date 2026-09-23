import { Node, UITransform, Vec3 } from 'cc';
import type { StaticCollisionShape, UIGame } from '../UIPage/UIGame';

/**
 * 让任意带脚底 UITransform 的节点在世界坐标中沿地图静态碰撞体移动。
 * 碰撞后会保留切线方向的位移，因此角色可以自然贴着墙边滑动。
 */
export class StaticCollisionMover {
    private candidates: StaticCollisionShape[] = [];
    private origin = new Vec3();
    private destination = new Vec3();
    private contactNormal = new Vec3();
    private mapMin = new Vec3();
    private mapMax = new Vec3();

    /**
     * 使用 A* 在整张地图的可通行网格中寻找路线。
     * 网格占用检测使用角色 colliderBox 的真实尺寸，而不是只检测角色中心点。
     */
    findPath(node: Node, collider: UITransform, game: UIGame, target: Vec3, out: Vec3[]) {
        out.length = 0;
        if (!node || !collider || !game) return false;

        node.getWorldPosition(this.origin);
        const bounds = collider.getBoundingBoxToWorld();
        const offsetX = bounds.x - this.origin.x;
        const offsetY = bounds.y - this.origin.y;
        const targetX = target.x;
        const targetY = target.y;
        if (this.canTraverse(game, this.origin.x, this.origin.y, targetX, targetY,
            offsetX, offsetY, bounds.width, bounds.height)) {
            out.push(new Vec3(targetX, targetY, this.origin.z));
            return true;
        }

        // clampWorldPointToMap 会按同一个 colliderBox 算出角色根节点可到达的边界。
        this.mapMin.set(-1000000000, -1000000000, this.origin.z);
        this.mapMax.set(1000000000, 1000000000, this.origin.z);
        game.clampWorldPointToMap(node, this.mapMin, this.mapMin);
        game.clampWorldPointToMap(node, this.mapMax, this.mapMax);

        let cellSize = Math.max(16, Math.min(32, Math.min(bounds.width, bounds.height)));
        let columns = Math.floor((this.mapMax.x - this.mapMin.x) / cellSize) + 1;
        let rows = Math.floor((this.mapMax.y - this.mapMin.y) / cellSize) + 1;
        const initialCellCount = columns * rows;
        // 极大地图限制搜索节点数量，避免多名 NPC 同时寻路造成明显卡顿。
        if (initialCellCount > 90000) {
            cellSize *= Math.sqrt(initialCellCount / 90000);
            columns = Math.floor((this.mapMax.x - this.mapMin.x) / cellSize) + 1;
            rows = Math.floor((this.mapMax.y - this.mapMin.y) / cellSize) + 1;
        }
        if (columns <= 0 || rows <= 0) return false;

        const total = columns * rows;
        const blocked = new Int8Array(total);
        blocked.fill(-1);
        const cellX = (index: number) => this.mapMin.x + index % columns * cellSize;
        const cellY = (index: number) => this.mapMin.y + Math.floor(index / columns) * cellSize;
        const isBlocked = (index: number) => {
            if (blocked[index] < 0) {
                blocked[index] = this.isPlacementBlocked(game, cellX(index) + offsetX,
                    cellY(index) + offsetY, bounds.width, bounds.height) ? 1 : 0;
            }
            return blocked[index] === 1;
        };
        const nearestCell = (x: number, y: number, connectFromPoint: boolean) => {
            const baseColumn = Math.max(0, Math.min(columns - 1, Math.round((x - this.mapMin.x) / cellSize)));
            const baseRow = Math.max(0, Math.min(rows - 1, Math.round((y - this.mapMin.y) / cellSize)));
            let best = -1;
            let bestDistance = Infinity;
            for (let radius = 0; radius <= 6; radius++) {
                for (let row = Math.max(0, baseRow - radius); row <= Math.min(rows - 1, baseRow + radius); row++) {
                    for (let column = Math.max(0, baseColumn - radius);
                        column <= Math.min(columns - 1, baseColumn + radius); column++) {
                        if (radius > 0 && Math.abs(column - baseColumn) !== radius
                            && Math.abs(row - baseRow) !== radius) continue;
                        const index = row * columns + column;
                        if (isBlocked(index)) continue;
                        const wx = cellX(index);
                        const wy = cellY(index);
                        const canConnect = connectFromPoint
                            ? this.canTraverse(game, x, y, wx, wy, offsetX, offsetY, bounds.width, bounds.height)
                            : this.canTraverse(game, wx, wy, x, y, offsetX, offsetY, bounds.width, bounds.height);
                        if (!canConnect) continue;
                        const distance = (wx - x) * (wx - x) + (wy - y) * (wy - y);
                        if (distance < bestDistance) {
                            best = index;
                            bestDistance = distance;
                        }
                    }
                }
                if (best >= 0) return best;
            }
            return -1;
        };

        const startIndex = nearestCell(this.origin.x, this.origin.y, true);
        const goalIndex = nearestCell(targetX, targetY, false);
        if (startIndex < 0 || goalIndex < 0) return false;

        const costs = new Float64Array(total);
        costs.fill(Infinity);
        const parents = new Int32Array(total);
        parents.fill(-1);
        const closed = new Uint8Array(total);
        const heapNodes: number[] = [];
        const heapScores: number[] = [];
        const pushHeap = (index: number, score: number) => {
            let position = heapNodes.length;
            heapNodes.push(index);
            heapScores.push(score);
            while (position > 0) {
                const parent = (position - 1) >> 1;
                if (heapScores[parent] <= score) break;
                heapNodes[position] = heapNodes[parent];
                heapScores[position] = heapScores[parent];
                position = parent;
            }
            heapNodes[position] = index;
            heapScores[position] = score;
        };
        const popHeap = () => {
            const result = heapNodes[0];
            const lastNode = heapNodes.pop();
            const lastScore = heapScores.pop();
            if (heapNodes.length && lastNode !== undefined && lastScore !== undefined) {
                let position = 0;
                while (true) {
                    const left = position * 2 + 1;
                    if (left >= heapNodes.length) break;
                    const right = left + 1;
                    const child = right < heapNodes.length && heapScores[right] < heapScores[left] ? right : left;
                    if (heapScores[child] >= lastScore) break;
                    heapNodes[position] = heapNodes[child];
                    heapScores[position] = heapScores[child];
                    position = child;
                }
                heapNodes[position] = lastNode;
                heapScores[position] = lastScore;
            }
            return result;
        };
        const goalColumn = goalIndex % columns;
        const goalRow = Math.floor(goalIndex / columns);
        const heuristic = (index: number) => {
            const columnDistance = Math.abs(index % columns - goalColumn);
            const rowDistance = Math.abs(Math.floor(index / columns) - goalRow);
            return 10 * (columnDistance + rowDistance) - 6 * Math.min(columnDistance, rowDistance);
        };

        costs[startIndex] = 0;
        pushHeap(startIndex, heuristic(startIndex));
        const directions = [
            [-1, 0, 10], [1, 0, 10], [0, -1, 10], [0, 1, 10],
            [-1, -1, 14], [1, -1, 14], [-1, 1, 14], [1, 1, 14],
        ];
        let found = false;
        while (heapNodes.length) {
            const current = popHeap();
            if (closed[current]) continue;
            if (current === goalIndex) {
                found = true;
                break;
            }
            closed[current] = 1;
            const column = current % columns;
            const row = Math.floor(current / columns);
            for (const direction of directions) {
                const nextColumn = column + direction[0];
                const nextRow = row + direction[1];
                if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
                const next = nextRow * columns + nextColumn;
                if (closed[next] || isBlocked(next)) continue;
                // 对角移动时两侧正交格都必须可走，防止从障碍物尖角穿过。
                if (direction[0] && direction[1]
                    && (isBlocked(row * columns + nextColumn) || isBlocked(nextRow * columns + column))) continue;
                if (!this.canTraverse(game, cellX(current), cellY(current), cellX(next), cellY(next),
                    offsetX, offsetY, bounds.width, bounds.height)) continue;
                const nextCost = costs[current] + direction[2];
                if (nextCost >= costs[next]) continue;
                costs[next] = nextCost;
                parents[next] = current;
                pushHeap(next, nextCost + heuristic(next));
            }
        }
        if (!found) return false;

        const rawPath: Vec3[] = [new Vec3(targetX, targetY, this.origin.z)];
        let pathIndex = goalIndex;
        while (pathIndex !== startIndex) {
            rawPath.push(new Vec3(cellX(pathIndex), cellY(pathIndex), this.origin.z));
            pathIndex = parents[pathIndex];
            if (pathIndex < 0) return false;
        }
        rawPath.reverse();

        // 删除能够直接跨越的中间格点，最终路线只保留障碍物转角附近的必要路点。
        let anchorX = this.origin.x;
        let anchorY = this.origin.y;
        let next = 0;
        while (next < rawPath.length) {
            let furthest = next;
            for (let candidate = rawPath.length - 1; candidate > next; candidate--) {
                const point = rawPath[candidate];
                if (this.canTraverse(game, anchorX, anchorY, point.x, point.y,
                    offsetX, offsetY, bounds.width, bounds.height)) {
                    furthest = candidate;
                    break;
                }
            }
            const waypoint = rawPath[furthest];
            out.push(waypoint);
            anchorX = waypoint.x;
            anchorY = waypoint.y;
            next = furthest + 1;
        }
        return out.length > 0;
    }

    private canTraverse(game: UIGame, startX: number, startY: number, endX: number, endY: number,
        offsetX: number, offsetY: number, width: number, height: number) {
        const left = startX + offsetX;
        const bottom = startY + offsetY;
        const dx = endX - startX;
        const dy = endY - startY;
        game.queryStaticColliders(Math.min(left, left + dx) - 0.01, Math.min(bottom, bottom + dy) - 0.01,
            Math.max(left + width, left + width + dx) + 0.01,
            Math.max(bottom + height, bottom + height + dy) + 0.01, this.candidates);
        return !this.sweepIntersectsStaticShape(left, bottom, width, height, dx, dy, 1);
    }

    private isPlacementBlocked(game: UIGame, left: number, bottom: number, width: number, height: number) {
        game.queryStaticColliders(left, bottom, left + width, bottom + height, this.candidates);
        return this.intersectsStaticShape(left, bottom, width, height);
    }

    moveWorld(node: Node, collider: UITransform, game: UIGame,
        deltaX: number, deltaY: number, out: Vec3) {
        out.set(0, 0, 0);
        if (!collider || (!deltaX && !deltaY)) return out;

        node.getWorldPosition(this.origin);
        if (!game) {
            this.destination.set(this.origin.x + deltaX, this.origin.y + deltaY, this.origin.z);
            node.setWorldPosition(this.destination);
            out.set(deltaX, deltaY, 0);
            return out;
        }

        const bounds = collider.getBoundingBoxToWorld();
        const reach = Math.hypot(deltaX, deltaY) + 1;
        game.queryStaticColliders(bounds.x - reach, bounds.y - reach,
            bounds.x + bounds.width + reach, bounds.y + bounds.height + reach, this.candidates);
        if (!this.candidates.length) {
            this.destination.set(this.origin.x + deltaX, this.origin.y + deltaY, this.origin.z);
            node.setWorldPosition(this.destination);
            game.keepNodeInsideMap(node);
            node.getWorldPosition(this.destination);
            out.set(this.destination.x - this.origin.x, this.destination.y - this.origin.y, 0);
            return out;
        }

        let x = bounds.x;
        let y = bounds.y;
        let remainingX = deltaX;
        let remainingY = deltaY;
        // 第一次接触后沿边滑动，并允许继续处理墙角处的相邻边。
        for (let contact = 0; contact < 3; contact++) {
            if (Math.abs(remainingX) + Math.abs(remainingY) < 0.0001) break;
            const fraction = this.allowedMoveFraction(x, y, bounds.width, bounds.height, remainingX, remainingY);
            x += remainingX * fraction;
            y += remainingY * fraction;
            if (fraction >= 1) break;
            remainingX *= 1 - fraction;
            remainingY *= 1 - fraction;
            if (!this.findSlideNormal(x, y, bounds.width, bounds.height,
                remainingX, remainingY, this.contactNormal)) break;
            const inward = remainingX * this.contactNormal.x + remainingY * this.contactNormal.y;
            if (inward >= -0.0001) break;
            remainingX -= inward * this.contactNormal.x;
            remainingY -= inward * this.contactNormal.y;
        }

        this.destination.set(this.origin.x + x - bounds.x, this.origin.y + y - bounds.y, this.origin.z);
        node.setWorldPosition(this.destination);
        game.keepNodeInsideMap(node);
        node.getWorldPosition(this.destination);
        out.set(this.destination.x - this.origin.x, this.destination.y - this.origin.y, 0);
        return out;
    }

    private allowedMoveFraction(x: number, y: number, width: number, height: number, dx: number, dy: number) {
        if (!this.sweepIntersectsStaticShape(x, y, width, height, dx, dy, 1)) return 1;
        if (this.intersectsStaticShape(x, y, width, height)) return 0;
        let low = 0;
        let high = 1;
        for (let i = 0; i < 12; i++) {
            const middle = (low + high) * 0.5;
            if (this.sweepIntersectsStaticShape(x, y, width, height, dx, dy, middle)) high = middle;
            else low = middle;
        }
        return low;
    }

    private sweepIntersectsStaticShape(x: number, y: number, width: number, height: number,
        dx: number, dy: number, fraction: number) {
        dx *= fraction;
        dy *= fraction;
        const left = Math.min(x, x + dx);
        const bottom = Math.min(y, y + dy);
        const right = Math.max(x + width, x + width + dx);
        const top = Math.max(y + height, y + height + dy);
        for (const shape of this.candidates) {
            if (right <= shape.minX || left >= shape.maxX || top <= shape.minY || bottom >= shape.maxY) continue;
            if (!shape.points) {
                if (this.sweptRectIntersectsRect(x, y, width, height, dx, dy, shape)) return true;
            } else if (this.sweptRectIntersectsPolygon(x, y, width, height, dx, dy, shape.points)) {
                return true;
            }
        }
        return false;
    }

    private sweptRectIntersectsRect(x: number, y: number, width: number, height: number,
        dx: number, dy: number, shape: StaticCollisionShape) {
        let enter = 0;
        let exit = 1;
        if (!dx) {
            if (x + width <= shape.minX || x >= shape.maxX) return false;
        } else {
            enter = Math.max(enter, Math.min((shape.minX - x - width) / dx, (shape.maxX - x) / dx));
            exit = Math.min(exit, Math.max((shape.minX - x - width) / dx, (shape.maxX - x) / dx));
        }
        if (!dy) {
            if (y + height <= shape.minY || y >= shape.maxY) return false;
        } else {
            enter = Math.max(enter, Math.min((shape.minY - y - height) / dy, (shape.maxY - y) / dy));
            exit = Math.min(exit, Math.max((shape.minY - y - height) / dy, (shape.maxY - y) / dy));
        }
        return enter + 0.000000001 < exit;
    }

    private sweptRectIntersectsPolygon(x: number, y: number, width: number, height: number,
        dx: number, dy: number, points: ReadonlyArray<{ x: number; y: number }>) {
        if (this.rectIntersectsPolygon(x, y, x + width, y + height, points)
            || this.rectIntersectsPolygon(x + dx, y + dy, x + width + dx, y + height + dy, points)) return true;
        for (const point of points) {
            if (this.pointInsideSweptRect(point.x, point.y, x, y, width, height, dx, dy)) return true;
        }
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            if (this.segmentsCross(x, y, x + dx, y + dy, a.x, a.y, b.x, b.y)
                || this.segmentsCross(x + width, y, x + width + dx, y + dy, a.x, a.y, b.x, b.y)
                || this.segmentsCross(x + width, y + height, x + width + dx, y + height + dy, a.x, a.y, b.x, b.y)
                || this.segmentsCross(x, y + height, x + dx, y + height + dy, a.x, a.y, b.x, b.y)) return true;
        }
        return false;
    }

    private pointInsideSweptRect(px: number, py: number, x: number, y: number,
        width: number, height: number, dx: number, dy: number) {
        let enter = 0;
        let exit = 1;
        if (!dx) {
            if (px <= x || px >= x + width) return false;
        } else {
            enter = Math.max(enter, Math.min((px - x - width) / dx, (px - x) / dx));
            exit = Math.min(exit, Math.max((px - x - width) / dx, (px - x) / dx));
        }
        if (!dy) {
            if (py <= y || py >= y + height) return false;
        } else {
            enter = Math.max(enter, Math.min((py - y - height) / dy, (py - y) / dy));
            exit = Math.min(exit, Math.max((py - y - height) / dy, (py - y) / dy));
        }
        return enter + 0.000000001 < exit;
    }

    private findSlideNormal(x: number, y: number, width: number, height: number,
        dx: number, dy: number, out: Vec3) {
        const centerX = x + width * 0.5;
        const centerY = y + height * 0.5;
        let bestProgress = 0;
        for (const shape of this.candidates) {
            if (x + width < shape.minX - 1 || x > shape.maxX + 1
                || y + height < shape.minY - 1 || y > shape.maxY + 1) continue;
            for (const edge of shape.edges) {
                if (dx * edge.nx + dy * edge.ny >= -0.0001) continue;
                const along = (centerX - edge.x) * edge.tx + (centerY - edge.y) * edge.ty;
                const tangentRadius = width * 0.5 * Math.abs(edge.tx) + height * 0.5 * Math.abs(edge.ty);
                if (along + tangentRadius < 0 || along - tangentRadius > edge.length) continue;
                const gap = (centerX - edge.x) * edge.nx + (centerY - edge.y) * edge.ny
                    - width * 0.5 * Math.abs(edge.nx) - height * 0.5 * Math.abs(edge.ny);
                if (gap < -0.01 || gap > 0.25) continue;
                const inward = dx * edge.nx + dy * edge.ny;
                const slideX = dx - inward * edge.nx;
                const slideY = dy - inward * edge.ny;
                const fraction = this.allowedMoveFraction(x, y, width, height, slideX, slideY);
                const progress = (slideX * slideX + slideY * slideY) * fraction * fraction;
                if (progress <= bestProgress) continue;
                bestProgress = progress;
                out.set(edge.nx, edge.ny, 0);
            }
        }
        return bestProgress > 0;
    }

    private intersectsStaticShape(x: number, y: number, width: number, height: number) {
        const right = x + width;
        const top = y + height;
        for (const shape of this.candidates) {
            if (right <= shape.minX || x >= shape.maxX || top <= shape.minY || y >= shape.maxY) continue;
            if (!shape.points || this.rectIntersectsPolygon(x, y, right, top, shape.points)) return true;
        }
        return false;
    }

    private rectIntersectsPolygon(left: number, bottom: number, right: number, top: number,
        points: ReadonlyArray<{ x: number; y: number }>) {
        for (const point of points) {
            if (point.x > left && point.x < right && point.y > bottom && point.y < top) return true;
        }
        if (this.pointInPolygon(left, bottom, points) || this.pointInPolygon(right, bottom, points)
            || this.pointInPolygon(right, top, points) || this.pointInPolygon(left, top, points)) return true;
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            if (this.segmentsCross(a.x, a.y, b.x, b.y, left, bottom, right, bottom)
                || this.segmentsCross(a.x, a.y, b.x, b.y, right, bottom, right, top)
                || this.segmentsCross(a.x, a.y, b.x, b.y, right, top, left, top)
                || this.segmentsCross(a.x, a.y, b.x, b.y, left, top, left, bottom)) return true;
        }
        return false;
    }

    private pointInPolygon(x: number, y: number, points: ReadonlyArray<{ x: number; y: number }>) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i];
            const b = points[j];
            const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
            if (Math.abs(cross) < 0.000001 && x >= Math.min(a.x, b.x) - 0.000001
                && x <= Math.max(a.x, b.x) + 0.000001 && y >= Math.min(a.y, b.y) - 0.000001
                && y <= Math.max(a.y, b.y) + 0.000001) return false;
            if ((a.y > y) !== (b.y > y)
                && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    private segmentsCross(ax: number, ay: number, bx: number, by: number,
        cx: number, cy: number, dx: number, dy: number) {
        const abC = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const abD = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
        const cdA = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
        const cdB = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
        const epsilon = 0.0000001;
        return ((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon))
            && ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon));
    }
}
