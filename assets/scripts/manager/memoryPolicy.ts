import { sys } from 'cc';

/** iOS 高性能模式下优先控制常驻资源和加载峰值。 */
export const memoryPolicy = {
    get lowMemory(): boolean {
        return sys.os === sys.OS.IOS;
    },
    get loadConcurrency(): number {
        return this.lowMemory ? 2 : 4;
    },
};
