import { sys } from 'cc';

/** iOS 高性能模式下优先控制常驻资源和加载峰值。 */
export const memoryPolicy = {
    get lowMemory(): boolean {
        return sys.os === sys.OS.IOS;
    },
    get loadConcurrency(): number {
        // 加载并发与常驻内存策略分开，避免 iOS 的前台资源请求长期排队。
        return 4;
    },
};
